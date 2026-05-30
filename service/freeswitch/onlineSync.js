// Keeps user online status in sync with FreeSWITCH reality. Two mechanisms:
// 1. Keep-alive MESSAGE listener: processes SIP MESSAGEs from clients (web/Yealink),
//    resets online timers, checks login expiry, triggers auto-reconnect.
// 2. Registration poll (every 30s): queries sofia_contact for each user to detect
//    stale registrations and update online/registrationState accordingly.
import { onMessageEvent, getConnection, isConnected, onEslReconnect, onEslDisconnect, getConnectionHandlers } from './connection.js';
import { initiateCall } from './callGate.js';

const onlineTimers = new Map();
let regPollTimer = null;

// Poll FreeSWITCH every 30s to sync registration state with user table
function startRegPoll() {
    if (regPollTimer) return;
    regPollTimer = setInterval(() => _pollRegistrations(), 30000);
    console.log('[REG-POLL] Started (30s interval)');
}

function stopRegPoll() {
    if (regPollTimer) {
        clearInterval(regPollTimer);
        regPollTimer = null;
        console.log('[REG-POLL] Stopped');
    }
}

onEslReconnect(() => { startRegPoll(); _pollRegistrations(); });
onEslDisconnect(() => stopRegPoll());

// Start polling on module load if already connected
setTimeout(() => { if (isConnected()) startRegPoll(); }, 5000);

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
            global.db.logOnlineStatus(user.userName, 'online');
            console.log(`[REG-POLL] ${user.userName} -> online (registered)`);
            changed = true;
            global.db.setUserInfo(user.userName, user);
            initiateCall(user.userName);
            changes++;
            continue;
        } else if (isRegistered && user.registrationState !== 'registered') {
            user.registrationState = 'registered';
            changed = true;
        } else if (!isRegistered && user.online) {
            user.online = false;
            user.registrationState = 'unregistered';
            global.db.logOnlineStatus(user.userName, 'offline');
            console.log(`[REG-POLL] ${user.userName} -> offline (unregistered)`);
            changed = true;
        } else if (!isRegistered && user.registrationState === 'registered') {
            user.registrationState = 'unregistered';
            changed = true;
        }

        // Reachability
        if (isReachable !== !!user.reachable) {
            user.reachable = isReachable;
            if (!changed) console.log(`[REG-POLL] ${user.userName} reachable=${isReachable}`);
            changed = true;
        }

        if (changed) {
            global.db.setUserInfo(user.userName, user);
            changes++;
        }
    }

    if (changes > 0) {
        console.log(`[REG-POLL] Synced: ${fsUsers.size} registered, ${changes} changes`);
    }

    _syncConferenceState(allUsers);
    _cleanupDeadHandlers(allUsers);
}

function _syncConferenceState(allUsers) {
    if (!isConnected()) return;

    getConnection().api('conference xml_list', (response) => {
        const body = response.getBody().trim();
        if (!body || body.includes('No active conferences') || body.startsWith('-ERR')) return;

        const activeByUuid = new Map();
        const memberBlocks = body.split('<member>');
        for (let i = 1; i < memberBlocks.length; i++) {
            const block = memberBlocks[i];
            const uuidMatch = block.match(/<uuid>([^<]+)<\/uuid>/);
            const memberIdMatch = block.match(/<id>(\d+)<\/id>/);
            const cidMatch = block.match(/<caller_id_number>([^<]+)<\/caller_id_number>/);
            if (!uuidMatch) continue;
            activeByUuid.set(uuidMatch[1], {
                memberId: memberIdMatch ? memberIdMatch[1] : null,
                callerIdNumber: cidMatch ? cidMatch[1] : '',
            });
        }

        let fixes = 0;
        for (const user of allUsers) {
            if (user.connectionState === 'connected' || user.connectionState === 'connecting') continue;

            // Check by existing UUID
            if (user.fsChannelUUID && activeByUuid.has(user.fsChannelUUID)) {
                const member = activeByUuid.get(user.fsChannelUUID);
                user.connectionState = 'connected';
                user.fsMemberId = member.memberId;
                user.error = null;
                user.retryCount = 0;
                user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(user.userName, user);
                console.log(`[REG-POLL] CONF-SYNC ${user.userName} -> connected (UUID match)`);
                fixes++;
                continue;
            }

            // Check by SIP URI in caller_id_number
            const sipUser = user.userName.replace('sip:', '');
            for (const [uuid, member] of activeByUuid) {
                if (member.callerIdNumber === sipUser) {
                    user.connectionState = 'connected';
                    user.fsChannelUUID = uuid;
                    user.fsMemberId = member.memberId;
                    user.error = null;
                    user.retryCount = 0;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    console.log(`[REG-POLL] CONF-SYNC ${user.userName} -> connected (SIP match)`);
                    fixes++;
                    break;
                }
            }
        }

        if (fixes > 0) {
            console.log(`[REG-POLL] CONF-SYNC fixed ${fixes} stale connection states`);
        }
    });
}

function _cleanupDeadHandlers(allUsers) {
    const handlers = getConnectionHandlers();
    if (handlers.size === 0) return;

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

    if (cleaned > 0) {
        console.log(`[REG-POLL] Cleaned ${cleaned} dead connection handlers`);
    }
}

onMessageEvent((event) => {
    const fromUser = event.getHeader('from_user') || event.getHeader('from-user') || '';
    const fromHost = event.getHeader('from_host') || event.getHeader('from-host') || '';

    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    const email = fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    console.log(`[KEEP-ALIVE] ${email}`);

    _checkLoginExpiry(userName, userInfo);
    _resetOnlineTimer(userName);
    _autoReconnect(userName);

    if (!userInfo.online) {
        userInfo.online = true;
        global.db.setUserInfo(userName, userInfo);
        global.db.logOnlineStatus(userName, 'online');
    }
});

function _checkLoginExpiry(userName, userInfo) {
    if (userInfo.authState === global.AuthState.LOGOUT) return;
    if (!userInfo.login_expire) return;

    const now = Math.floor(Date.now() / 1000);
    if (now < userInfo.login_expire) return;

    console.log(`[KEEP-ALIVE] EXPIRED login for ${userName}`);

    if (userInfo.connectionState === global.ConnectionState.CONNECTED) {
        const service = global.callService;
        if (service) service.endCall(userName);
    }

    global.db.updateUserInfo(userName, {
        authState: global.AuthState.LOGOUT,
        login_expire: null,
        mute: true,
    });
}

function _resetOnlineTimer(userName) {
    if (onlineTimers.has(userName)) {
        clearTimeout(onlineTimers.get(userName));
    }

    const timeout = setTimeout(() => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) return;

        console.log(`[KEEP-ALIVE] TIMEOUT ${userName} — marking offline`);
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
