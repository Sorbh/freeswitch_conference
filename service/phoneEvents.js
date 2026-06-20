// Phone hook event router.
//
// This file owns the meaning of phone hook events after the route/syslog layer has
// identified the user. Routes should log the API request, then call this handler.
//
// Inputs
// ┌────────────────┬───────────────────────────────┬──────────────────────────────┐
// │ Source         │ Raw signal                    │ Handler path                 │
// ├────────────────┼───────────────────────────────┼──────────────────────────────┤
// │ Yealink syslog │ key[off hook] / key[on hook]  │ _handleHookEvent(mac,event)  │
// │ Web client API │ { userName, event }           │ handleHttpHookEvent(...)      │
// └────────────────┴───────────────────────────────┴──────────────────────────────┘
//
// Event meaning
// ┌──────────┬────────────────────────────────────────────────────────────────────┐
// │ off_hook │ Handset is lifted. In conference this means unmute. For a pending │
// │          │ direct call, only the callee's off_hook accepts the call.         │
// ├──────────┼────────────────────────────────────────────────────────────────────┤
// │ on_hook  │ Handset is placed down. In conference this means mute. During an  │
// │          │ active direct_call, either party's on_hook ends the private call. │
// └──────────┴────────────────────────────────────────────────────────────────────┘
//
// Decision order for both HTTP and syslog hook events
// ┌────┬────────────────────────────────────────────┬─────────────────────────────┐
// │ #  │ Condition                                  │ Action                      │
// ├────┼────────────────────────────────────────────┼─────────────────────────────┤
// │ 1  │ event is not off_hook/on_hook              │ reject / ignore             │
// │ 2  │ user cannot be found                       │ reject / ignore             │
// │ 3  │ any valid hook event                       │ record recent hook for      │
// │    │                                            │ direct-call end attribution │
// │ 4  │ on_hook && user is in direct_call          │ kill private bridge; direct │
// │    │                                            │ call code reconnects muted  │
// │ 5  │ off_hook && user is pending callee         │ accept pending direct call  │
// │ 6  │ off_hook && user is pending caller         │ ignore; caller must wait    │
// │ 7  │ user has no fsMemberId                     │ not in conference; skip     │
// │ 8  │ off_hook && return-muted window is active  │ force mute, keep muted      │
// │ 9  │ normal on_hook in conference               │ mute by conference member   │
// │ 10 │ normal off_hook in conference              │ unmute by conference member │
// └────┴────────────────────────────────────────────┴─────────────────────────────┘
//
// State graph
// ┌─────────────────────┐
// │ connected+muted     │
// │ in conference       │
// └──────────┬──────────┘
//            │ off_hook, no pending direct call
//            ▼
// ┌─────────────────────┐       on_hook       ┌─────────────────────┐
// │ connected+unmuted   │ ──────────────────▶ │ connected+muted     │
// │ in conference       │                     │ in conference       │
// └─────────────────────┘                     └─────────────────────┘
//
// Direct-call graph
// ┌─────────────────────┐  callee off_hook   ┌─────────────────────┐
// │ pending direct call │ ─────────────────▶ │ direct_call         │
// │ caller waits        │                    │ private bridge      │
// └─────────────────────┘                    └──────────┬──────────┘
//                                                        │ either side on_hook
//                                                        ▼
//                                             ┌─────────────────────┐
//                                             │ reconnect to room   │
//                                             │ always muted        │
//                                             └─────────────────────┘
import SyslogServer from 'syslog-server';
import { acceptByUserName, handleDTMF, hangupDirectCallByUserName, hasPendingCall, isInDirectCall, isPendingCaller, noteDirectCallHookEvent, shouldKeepDirectCallMuted } from './freeswitch/directCall.js';
import { logSystem, logUser } from './logger.js';

let syslogServer = null;
const sipBlocks = new Map();
const SIP_BLOCK_TIMEOUT = 3000;
const macByIp = new Map();
const activeMac = new Map();
const SYSLOG_STALE_MS = 30000;

export function getMacByIp(ip) {
    return macByIp.get(ip) || null;
}

export function getActiveMacs() {
    return activeMac;
}

setInterval(() => {
    const now = Date.now();
    for (const [mac, lastSeen] of activeMac.entries()) {
        if (now - lastSeen > SYSLOG_STALE_MS) {
            activeMac.delete(mac);
            const userInfo = global.db.findUserInfo('mac', mac);
            if (userInfo.userName) {
                logUser(userInfo.userName, 'PHONE', `Syslog stale (${mac})`);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: userInfo.userName });
            }
        }
    }
}, 5000);

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

        if (macAddress) {
            activeMac.set(macAddress, Date.now());
            const ip = value.address || value.host;
            if (ip) macByIp.set(ip, macAddress);
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
                const _name = hookUser.callerIdName || hookUserName || macAddress;
                logSystem('PHONE', `OFF HOOK ${_name}`);
                _handleHookEvent(macAddress, 'off_hook');
            } else if (keyEvent === 'on hook') {
                const _name = hookUser.callerIdName || hookUserName || macAddress;
                logSystem('PHONE', `ON HOOK ${_name}`);
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

    noteDirectCallHookEvent(userName, event);

    if (event === 'on_hook' && isInDirectCall(userName)) {
        logUser(userName, 'PHONE', 'HTTP ON HOOK → ending direct call');
        return hangupDirectCallByUserName(userName, 'http_on_hook');
    }

    // Off-hook: check for pending direct call before normal unmute
    if (event === 'off_hook' && hasPendingCall(userName)) {
        logUser(userName, 'PHONE', 'HTTP OFF HOOK → accepting direct call');
        acceptByUserName(userName);
        return true;
    }

    if (event === 'off_hook' && isPendingCaller(userName)) {
        logUser(userName, 'PHONE', 'HTTP OFF HOOK ignored — waiting for direct call answer');
        return true;
    }

    if (!userInfo.fsMemberId) {
        logUser(userName, 'PHONE', 'HTTP not in conference');
        return false;
    }

    if (event === 'off_hook' && shouldKeepDirectCallMuted(userName)) {
        const activeRoom = userInfo.currentRoom || userInfo.room;
        if (userInfo.fsMemberId && global.freeswitch?.muteByMemberId) {
            logUser(userName, 'MUTE_TRACE', `return-muted HTTP off_hook guard room=${activeRoom} member=${userInfo.fsMemberId}`);
            global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userName);
        }
        userInfo.mute = true;
        global.db.setUserInfo(userName, userInfo);
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });
        logUser(userName, 'PHONE', 'HTTP OFF HOOK ignored — direct call returned muted');
        return true;
    }

    const _name = userInfo.callerIdName || userName;
    logSystem('PHONE', `HTTP ${event === 'off_hook' ? 'OFF HOOK' : 'ON HOOK'} ${_name}`);
    _applyMuteState(userName, userInfo, event);
    return true;
}

function _handleHookEvent(macAddress, event) {
    const userInfo = global.db.findUserInfo('mac', macAddress);
    if (Object.keys(userInfo).length === 0) {
        logSystem('PHONE', `MAC ${macAddress} not found in user table`);
        return;
    }

    noteDirectCallHookEvent(userInfo.userName, event);

    if (event === 'on_hook' && isInDirectCall(userInfo.userName)) {
        logUser(userInfo.userName, 'PHONE', 'ON HOOK → ending direct call');
        hangupDirectCallByUserName(userInfo.userName, 'syslog_on_hook');
        return;
    }

    // Off-hook: check for pending direct call before normal unmute
    if (event === 'off_hook' && hasPendingCall(userInfo.userName)) {
        logUser(userInfo.userName, 'PHONE', 'OFF HOOK → accepting direct call');
        acceptByUserName(userInfo.userName);
        return;
    }

    if (event === 'off_hook' && isPendingCaller(userInfo.userName)) {
        logUser(userInfo.userName, 'PHONE', 'OFF HOOK ignored — waiting for direct call answer');
        return;
    }

    if (!userInfo.fsMemberId) {
        logUser(userInfo.userName, 'PHONE', `not in conference, skipping ${event}`);
        return;
    }

    if (event === 'off_hook' && shouldKeepDirectCallMuted(userInfo.userName)) {
        const activeRoom = userInfo.currentRoom || userInfo.room;
        if (userInfo.fsMemberId && global.freeswitch?.muteByMemberId) {
            logUser(userInfo.userName, 'MUTE_TRACE', `return-muted syslog off_hook guard room=${activeRoom} member=${userInfo.fsMemberId}`);
            global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userInfo.userName);
        }
        userInfo.mute = true;
        global.db.setUserInfo(userInfo.userName, userInfo);
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: userInfo.userName });
        logUser(userInfo.userName, 'PHONE', 'OFF HOOK ignored — direct call returned muted');
        return;
    }

    // Yealink on_hook: phone usually hangs up, but if it stays connected
    // FS must still get the mute command to avoid stuck unmuted members.
    if (event === 'on_hook') {
        const activeRoom = userInfo.currentRoom || userInfo.room;
        if (userInfo.fsMemberId) {
            logUser(userInfo.userName, 'MUTE_TRACE', `syslog on_hook mute room=${activeRoom} member=${userInfo.fsMemberId}`);
            global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userInfo.userName);
        }
        userInfo.mute = true;
        global.db.setUserInfo(userInfo.userName, userInfo);
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: userInfo.userName });
        logUser(userInfo.userName, 'PHONE', 'MUTED (on_hook)');
        return;
    }

    _applyMuteState(userInfo.userName, userInfo, event);
}

function _applyMuteState(userName, userInfo, event) {
    const mute = event === 'on_hook';
    const activeRoom = userInfo.currentRoom || userInfo.room;

    if (mute) {
        logUser(userName, 'MUTE_TRACE', `applyMuteState mute room=${activeRoom} member=${userInfo.fsMemberId}`);
        global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userName);
    } else {
        logUser(userName, 'MUTE_TRACE', `applyMuteState unmute room=${activeRoom} member=${userInfo.fsMemberId}`);
        global.freeswitch.unmuteByMemberId(activeRoom, userInfo.fsMemberId, userName);
    }

    userInfo.mute = mute;
    global.db.setUserInfo(userName, userInfo);
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });
}

export function stopSyslogServer() {
    if (syslogServer) {
        syslogServer.stop();
        syslogServer = null;
        logSystem('PHONE', 'Syslog server stopped');
    }
}
