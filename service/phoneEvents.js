// Unified phone event handler. Two input paths, one output:
// 1. Yealink syslog (UDP) — parses key[off hook]/key[on hook] by MAC address
// 2. HTTP POST from web client — receives { userName, event: 'off_hook'|'on_hook' }
// Both call callAction.muteByMemberId / unmuteByMemberId via FreeSWITCH conference API.
import SyslogServer from 'syslog-server';

let syslogServer = null;

export function startSyslogServer(port = 514) {
    syslogServer = new SyslogServer();

    syslogServer.on('message', (value) => {
        const msg = value.message;

        const macRegex = /\[([0-9a-fA-F:]+)\]/;
        const levelRegex = /<(?:\d+\+)?(error|warn|info|debug|notice)>/i;
        const messageRegex = /SIP <[^>]+> (.*)/;
        const keyRegex = /key\[(.*?)\]/;

        const macMatch = msg.match(macRegex);
        const levelMatch = msg.match(levelRegex);
        const messageMatch = msg.match(messageRegex);

        const macAddress = macMatch ? macMatch[1].toLowerCase() : null;
        const logLevel = levelMatch ? levelMatch[1].toUpperCase() : 'INFO';
        const logMessage = messageMatch ? messageMatch[1] : msg;

        if (logLevel !== 'NOTICE' || !macAddress) return;

        const match = logMessage.match(keyRegex);
        if (!match || !match[1]) return;

        const keyEvent = match[1];
        console.log(`[PHONE] SYSLOG ${macAddress} key=${keyEvent}`);

        if (keyEvent === 'off hook') {
            _handleHookEvent(macAddress, 'off_hook');
        } else if (keyEvent === 'on hook') {
            _handleHookEvent(macAddress, 'on_hook');
        }
    });

    syslogServer.start({ port });
    console.log(`[PHONE] Syslog server listening on port ${port}`);
}

export function handleHttpHookEvent(userName, event) {
    if (event !== 'off_hook' && event !== 'on_hook') {
        console.log(`[PHONE] HTTP unknown event: ${event} for ${userName}`);
        return false;
    }

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) {
        console.log(`[PHONE] HTTP ${userName} not found`);
        return false;
    }

    if (!userInfo.fsMemberId) {
        console.log(`[PHONE] HTTP ${userName} not in conference`);
        return false;
    }

    console.log(`[PHONE] HTTP ${userName} event=${event}`);
    _applyMuteState(userName, userInfo, event);
    return true;
}

function _handleHookEvent(macAddress, event) {
    const userInfo = global.db.findUserInfo('mac', macAddress);
    if (Object.keys(userInfo).length === 0) {
        console.log(`[PHONE] MAC ${macAddress} not found in user table`);
        return;
    }

    if (!userInfo.fsMemberId) {
        console.log(`[PHONE] ${userInfo.userName} not in conference, skipping ${event}`);
        return;
    }

    _applyMuteState(userInfo.userName, userInfo, event);
}

function _applyMuteState(userName, userInfo, event) {
    const mute = event === 'on_hook';

    if (mute) {
        global.freeswitch.muteByMemberId(userInfo.room, userInfo.fsMemberId, userName);
    } else {
        global.freeswitch.unmuteByMemberId(userInfo.room, userInfo.fsMemberId, userName);
    }

    userInfo.mute = mute;
    global.db.setUserInfo(userName, userInfo);
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });
    console.log(`[PHONE] ${userName} -> ${mute ? 'MUTED' : 'UNMUTED'} (${event})`);
}

export function stopSyslogServer() {
    if (syslogServer) {
        syslogServer.stop();
        syslogServer = null;
        console.log('[PHONE] Syslog server stopped');
    }
}
