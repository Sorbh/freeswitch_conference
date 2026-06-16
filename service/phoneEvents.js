// Unified phone event handler. Two input paths, one output:
// 1. Yealink syslog (UDP) — parses key[off hook]/key[on hook] by MAC address
// 2. HTTP POST from web client — receives { userName, event: 'off_hook'|'on_hook' }
// Both call callAction.muteByMemberId / unmuteByMemberId via FreeSWITCH conference API.
import SyslogServer from 'syslog-server';
import { logSystem, logUser } from './logger.js';
import { acceptByUserName, hasPendingCall, handleDTMF } from './freeswitch/directCall.js';

let syslogServer = null;
const sipBlocks = new Map();
const SIP_BLOCK_TIMEOUT = 3000;
const macByIp = new Map();

export function getMacByIp(ip) {
    return macByIp.get(ip) || null;
}

function _extractSipPayload(msg) {
    return msg.replace(/.*?DLG\s*<\d+\+\w+\s*>\s*\[\d+\]\s?/, '');
}

function _finalizeSipBlock(block) {
    const lines = block.lines.map(l => _extractSipPayload(l)).filter(Boolean);
    const fullMessage = lines.join('\n');

    let method = null, callId = null, from = null, to = null;
    for (const line of lines) {
        if (!method) {
            const reqM = line.match(/^(INVITE|ACK|BYE|CANCEL|REGISTER|OPTIONS|NOTIFY|SUBSCRIBE|MESSAGE|INFO|UPDATE|REFER|PRACK|PUBLISH)\s/);
            if (reqM) method = reqM[1];
            const resM = line.match(/^SIP\/2\.0\s+(\d+\s+.*)/);
            if (resM) method = resM[1].trim();
        }
        if (!callId) { const m = line.match(/^Call-ID:\s*(\S+)/i); if (m) callId = m[1]; }
        if (!from) { const m = line.match(/^From:\s*(.+)/i); if (m) from = m[1].trim(); }
        if (!to) { const m = line.match(/^To:\s*(.+)/i); if (m) to = m[1].trim(); }
    }

    if (block.mac && method === 'REGISTER' && from) {
        _linkMacToUser(block.mac, from);
    }

    global.db.eventEmitter.emit('PHONE_LOG', {
        type: 'phone_log',
        timestamp: block.timestamp,
        mac: block.mac,
        level: 'INFO',
        message: fullMessage,
        raw: block.rawLines.join('\n'),
        isSip: true,
        direction: block.direction,
        dest: block.dest,
        method: method || null,
        callId: callId || null,
        from: from || null,
        to: to || null,
    });
}

export function startSyslogServer(port = 515) {
    syslogServer = new SyslogServer();

    syslogServer.on('message', (value) => {
        const msg = value.message;

        const macRegex = /\[([0-9a-fA-F:]+)\]/;
        const levelRegex = /<(?:\d+\+)?(error|warn|info|debug|notice)>/i;
        const keyRegex = /key\[(.*?)\]/;

        const macMatch = msg.match(macRegex);
        const levelMatch = msg.match(levelRegex);

        const macAddress = macMatch ? macMatch[1].toLowerCase() : null;
        const logLevel = levelMatch ? levelMatch[1].toUpperCase() : 'INFO';

        if (macAddress && value.address) {
            macByIp.set(value.address, macAddress);
        }

        // SIP block detection (Yealink multi-line format)
        const sendStart = msg.match(/Sending Packet\s*:to dest=(\S+)/);
        const recvStart = msg.match(/Data Received\s*:from src=(\S+)/);
        const isBlockEnd = /End of Sending Packet|End of Data Received/.test(msg);
        const isBlockContent = /DLG\s*<\d+\+info/.test(msg);
        const blockKey = macAddress || '__noMac';

        if (sendStart || recvStart) {
            // Finalize any open block for this MAC
            if (sipBlocks.has(blockKey)) {
                clearTimeout(sipBlocks.get(blockKey).timer);
                _finalizeSipBlock(sipBlocks.get(blockKey));
            }
            const block = {
                mac: macAddress,
                direction: sendStart ? 'send' : 'recv',
                dest: (sendStart || recvStart)[1],
                timestamp: new Date().toISOString(),
                lines: [],
                rawLines: [msg],
                timer: setTimeout(() => {
                    if (sipBlocks.get(blockKey) === block) {
                        _finalizeSipBlock(block);
                        sipBlocks.delete(blockKey);
                    }
                }, SIP_BLOCK_TIMEOUT),
            };
            sipBlocks.set(blockKey, block);
            // Don't emit this line as a plain log
        } else if (sipBlocks.has(blockKey) && (isBlockContent || isBlockEnd)) {
            const block = sipBlocks.get(blockKey);
            block.rawLines.push(msg);
            if (isBlockContent) {
                block.lines.push(msg);
            }
            if (isBlockEnd) {
                clearTimeout(block.timer);
                _finalizeSipBlock(block);
                sipBlocks.delete(blockKey);
            }
        } else {
            // Not part of a SIP block — emit as plain log
            // Close any stale open block for this MAC
            if (sipBlocks.has(blockKey)) {
                clearTimeout(sipBlocks.get(blockKey).timer);
                _finalizeSipBlock(sipBlocks.get(blockKey));
                sipBlocks.delete(blockKey);
            }

            const messageRegex = /(?:SIP\s*<[^>]+>\s*|DLG\s*<[^>]+>\s*\[\d+\]\s*)(.*)/;
            const messageMatch = msg.match(messageRegex);
            const logMessage = messageMatch ? messageMatch[1] : msg;

            global.db.eventEmitter.emit('PHONE_LOG', {
                type: 'phone_log',
                timestamp: new Date().toISOString(),
                mac: macAddress,
                level: logLevel,
                message: logMessage,
                raw: msg,
                isSip: false,
            });

            // Hook detection for mute/unmute
            if (logLevel !== 'NOTICE' || !macAddress) return;
            const match = logMessage.match(keyRegex);
            if (!match || !match[1]) return;
            const keyEvent = match[1];
            const hookUser = global.db.findUserInfo('mac', macAddress);
            const hookUserName = Object.keys(hookUser).length > 0 ? hookUser.userName : null;

            if (keyEvent === 'off hook') {
                logUser(hookUserName, 'PHONE', `OFF HOOK (${macAddress})`);
                _handleHookEvent(macAddress, 'off_hook');
            } else if (keyEvent === 'on hook') {
                logUser(hookUserName, 'PHONE', `ON HOOK (${macAddress})`);
                _handleHookEvent(macAddress, 'on_hook');
            } else if (/^[0-9*#]$/.test(keyEvent) && hookUser.fsChannelUUID) {
                logUser(hookUserName, 'PHONE', `KEY [${keyEvent}] (${macAddress})`);
                handleDTMF(hookUser.fsChannelUUID, keyEvent);
            }
        }
    });

    syslogServer.start({ port });
    logSystem('PHONE', `Syslog server listening on port ${port}`);
}

function _linkMacToUser(mac, fromHeader) {
    const emailMatch = fromHeader.match(/sip:([^>;@]+@[^>;]+)/);
    if (!emailMatch) return;
    const email = emailMatch[1];
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;
    if (userInfo.mac === mac) return;

    userInfo.mac = mac;
    global.db.setUserInfo(userName, userInfo);
    logUser(userName, 'PHONE', `MAC ${mac} linked via syslog`);
}


export function handleHttpHookEvent(userName, event) {
    if (event !== 'off_hook' && event !== 'on_hook') {
        logUser(userName, 'PHONE', `HTTP unknown event: ${event}`);
        return false;
    }

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) {
        logUser(userName, 'PHONE', 'HTTP not found');
        return false;
    }

    if (!userInfo.fsMemberId) {
        logUser(userName, 'PHONE', 'HTTP not in conference');
        return false;
    }

    // Off-hook: check for pending direct call before normal unmute
    if (event === 'off_hook' && hasPendingCall(userName)) {
        logUser(userName, 'PHONE', 'HTTP OFF HOOK → accepting direct call');
        acceptByUserName(userName);
        return true;
    }

    logUser(userName, 'PHONE', `HTTP event=${event}`);
    _applyMuteState(userName, userInfo, event);
    return true;
}

function _handleHookEvent(macAddress, event) {
    const userInfo = global.db.findUserInfo('mac', macAddress);
    if (Object.keys(userInfo).length === 0) {
        logSystem('PHONE', `MAC ${macAddress} not found in user table`);
        return;
    }

    if (!userInfo.fsMemberId) {
        logUser(userInfo.userName, 'PHONE', `not in conference, skipping ${event}`);
        return;
    }

    // Off-hook: check for pending direct call before normal unmute
    if (event === 'off_hook' && hasPendingCall(userInfo.userName)) {
        logUser(userInfo.userName, 'PHONE', 'OFF HOOK → accepting direct call');
        acceptByUserName(userInfo.userName);
        return;
    }

    // Yealink on_hook: phone will hang up the SIP call (del-member handles cleanup).
    // Skip the FS mute command — it's redundant and causes double events.
    // But update DB so UI reflects muted state immediately.
    if (event === 'on_hook') {
        userInfo.mute = true;
        global.db.setUserInfo(userInfo.userName, userInfo);
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: userInfo.userName });
        logUser(userInfo.userName, 'PHONE', 'MUTED (on_hook — waiting for hangup)');
        return;
    }

    _applyMuteState(userInfo.userName, userInfo, event);
}

function _applyMuteState(userName, userInfo, event) {
    const mute = event === 'on_hook';
    const activeRoom = userInfo.currentRoom || userInfo.room;

    if (mute) {
        global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userName);
    } else {
        global.freeswitch.unmuteByMemberId(activeRoom, userInfo.fsMemberId, userName);
    }

    userInfo.mute = mute;
    global.db.setUserInfo(userName, userInfo);
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });
    logUser(userName, 'PHONE', `${mute ? 'MUTED' : 'UNMUTED'} (${event}) room=${activeRoom}`);
}

export function stopSyslogServer() {
    if (syslogServer) {
        syslogServer.stop();
        syslogServer = null;
        logSystem('PHONE', 'Syslog server stopped');
    }
}
