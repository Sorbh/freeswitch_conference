// Keeps user online status in sync with FreeSWITCH reality. Two mechanisms:
// 1. Keep-alive MESSAGE listener: processes SIP MESSAGEs from clients (web/Yealink),
//    resets online timers, checks login expiry, triggers auto-reconnect.
// 2. Registration poll (every 30s): queries sofia_contact for each user to detect
//    stale registrations and update online/registrationState accordingly.
import { onMessageEvent, getConnection, isConnected, onEslReconnect, onEslDisconnect, getConnectionHandlers } from './connection.js';
import { initiateCall } from './callGate.js';
import { syncAllUsers } from './conferenceSync.js';
import { invalidateContactCache } from './notifications.js';
import { logSystem, logUser } from '../logger.js';

const onlineTimers = new Map();
let regPollTimer = null;

// Poll FreeSWITCH every 30s to sync registration state with user table
function startRegPoll() {
    if (regPollTimer) return;
    regPollTimer = setInterval(() => _pollRegistrations(), 30000);
    logSystem('REG-POLL', 'Started (30s interval)');
}

function stopRegPoll() {
    if (regPollTimer) {
        clearInterval(regPollTimer);
        regPollTimer = null;
        logSystem('REG-POLL', 'Stopped');
    }
}

onEslReconnect(() => { startRegPoll(); _pollRegistrations(); });
onEslDisconnect(() => stopRegPoll());

function _pollRegistrations() {
    if (!isConnected()) return;

    const conn = getConnection();
    const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';

    conn.api(`sofia xmlstatus profile ${profile} reg`, (response) => {
        const body = response.getBody().trim();
        const fsUsers = _parseRegXml(body);
        const allUsers = global.db.getAllUserInfo();
        if (allUsers.length === 0) return;
        _applyRegSync(allUsers, fsUsers);
    });
}

function _parseRegXml(xml) {
    const users = new Map();
    const regBlocks = xml.split('<registration>');

    for (let i = 1; i < regBlocks.length; i++) {
        const block = regBlocks[i];
        const userMatch = block.match(/<user>([^<]+)<\/user>/);
        const statusMatch = block.match(/<status>([^<]+)<\/status>/);
        const pingStatusMatch = block.match(/<ping-status>([^<]+)<\/ping-status>/);

        if (!userMatch) continue;

        // Web client: user=apple.ricardo.at.gmail.com@50.28.84.57 (strip @serverIP, decode .at.)
        // Yealink: user=er.sorbh@gmail.com (use as-is, it's already the email)
        const raw = userMatch[1];
        const fsIp = global.config?.FREESWITCH_PUBLIC_IP || '50.28.84.57';
        let email;
        if (raw.endsWith(`@${fsIp}`)) {
            const rawUser = raw.slice(0, -(fsIp.length + 1));
            email = rawUser.includes('.at.') ? rawUser.replace('.at.', '@') : rawUser;
        } else {
            email = raw.includes('.at.') ? raw.replace('.at.', '@') : raw;
        }
        const userName = `sip:${email}`;

        const registered = statusMatch ? statusMatch[1].trim() === 'Registered(UDP-NAT)' || statusMatch[1].trim().startsWith('Registered') : false;
        const reachable = pingStatusMatch ? pingStatusMatch[1].trim() === 'Reachable' : false;

        users.set(userName, { registered, reachable });
    }

    return users;
}

function _applyRegSync(allUsers, fsUsers) {
    let changes = 0;

    for (const user of allUsers) {
        const fsState = fsUsers.get(user.userName);
        const isRegistered = fsState ? fsState.registered : false;
        const isReachable = fsState ? fsState.reachable : false;
        let changed = false;

        // Registration state
        if (isRegistered && !user.online) {
            user.online = true;
            user.registrationState = 'registered';
            invalidateContactCache(user.userName);
            global.db.logOnlineStatus(user.userName, 'online');
            logUser(user.userName, 'POLL', 'online (registered)');
            changed = true;
            global.db.setUserInfo(user.userName, user);
            initiateCall(user.userName);
            changes++;
            continue;
        } else if (isRegistered && user.registrationState !== 'registered') {
            user.registrationState = 'registered';
            invalidateContactCache(user.userName);
            changed = true;
        } else if (!isRegistered && user.online) {
            user.online = false;
            user.registrationState = 'unregistered';
            invalidateContactCache(user.userName);
            global.db.logOnlineStatus(user.userName, 'offline');
            logUser(user.userName, 'POLL', 'offline (unregistered)');
            changed = true;
        } else if (!isRegistered && user.registrationState === 'registered') {
            user.registrationState = 'unregistered';
            invalidateContactCache(user.userName);
            changed = true;
        }

        // Reachability
        if (isReachable !== !!user.reachable) {
            user.reachable = isReachable;
            if (!changed) logUser(user.userName, 'POLL', `reachable=${isReachable}`);
            changed = true;
        }

        if (changed) {
            global.db.setUserInfo(user.userName, user);
            changes++;
        }
    }

    syncAllUsers({ markHangup: false, logPrefix: 'REG-POLL' });
    const cleaned = _cleanupDeadHandlers(allUsers);
    _syncMuteState();

    if (changes > 0 || cleaned > 0) {
        const parts = [];
        if (changes > 0) parts.push(`${fsUsers.size} registered, ${changes} changes`);
        if (cleaned > 0) parts.push(`cleaned ${cleaned} dead handlers`);
        logUser('REG-POLL', 'SYNC', parts.join(' | '));
    }
}

function _syncMuteState() {
    if (!isConnected()) return;
    const conn = getConnection();
    const rooms = global.db.getAllRooms ? global.db.getAllRooms() : [];
    for (const room of rooms) {
        conn.api(`conference ${room.id} list`, (response) => {
            const body = response.getBody().trim();
            if (!body || body.startsWith('-ERR') || body.includes('not found')) return;
            for (const line of body.split('\n')) {
                const parts = line.split(';');
                if (parts.length < 6) continue;
                const memberId = parts[0];
                const flags = parts[5] || '';
                const uuid = parts[2];
                if (!flags.includes('speak')) continue;
                // This member is unmuted in FS — check DB
                const users = global.db.filter(u => u.fsChannelUUID === uuid);
                if (users.length === 0) continue;
                const user = users[0];
                if (user.mute) {
                    logSystem('MUTE-SYNC', `${user.callerIdName || user.userName} muted in DB but unmuted in FS (member ${memberId}) — fixing`);
                    conn.api(`conference ${room.id} mute ${memberId}`, () => {});
                }
            }
        });
    }
}

function _cleanupDeadHandlers(allUsers) {
    const handlers = getConnectionHandlers();
    if (handlers.size === 0) return 0;

    const activeUuids = new Set();
    for (const user of allUsers) {
        if (user.fsChannelUUID) activeUuids.add(user.fsChannelUUID);
    }

    let cleaned = 0;
    for (const uuid of handlers.keys()) {
        if (!activeUuids.has(uuid)) {
            handlers.delete(uuid);
            cleaned++;
        }
    }

    return cleaned;
}

onMessageEvent((event) => {
    const fromUser = event.getHeader('from_user') || event.getHeader('from-user') || '';
    const fromHost = event.getHeader('from_host') || event.getHeader('from-host') || '';

    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    const email = fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    logUser(`sip:${email}`, 'ALIVE', 'keep-alive');

    global.db.touchLastSeen(userName);
    _resetOnlineTimer(userName);
    _autoReconnect(userName);

    if (!userInfo.online) {
        userInfo.online = true;
        global.db.setUserInfo(userName, userInfo);
        global.db.logOnlineStatus(userName, 'online');
    }
});


function _resetOnlineTimer(userName) {
    if (onlineTimers.has(userName)) {
        clearTimeout(onlineTimers.get(userName));
    }

    const timeout = setTimeout(() => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) return;

        logUser(userName, 'ALIVE', 'TIMEOUT — marking offline');
        userInfo.online = false;
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('offline', userName, null, 'Keep-alive timeout');
        global.db.logOnlineStatus(userName, 'offline');
        onlineTimers.delete(userName);

        _triggerCriticalAlert(userName);
    }, 60000);

    onlineTimers.set(userName, timeout);
}

function _autoReconnect(userName) {
    initiateCall(userName);
}

function _triggerCriticalAlert(userName) {
    if (global.alerting && global.alerting.checkCriticalUser(userName)) {
        global.alerting.startCriticalAlert(userName);
    }
}

export function clearOnlineTimer(userName) {
    if (onlineTimers.has(userName)) {
        clearTimeout(onlineTimers.get(userName));
        onlineTimers.delete(userName);
    }
    if (global.alerting) {
        global.alerting.stopCriticalAlert(userName);
    }
}
