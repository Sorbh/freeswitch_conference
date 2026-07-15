// Single entry point for initiating calls to SIP clients.
// Validates eligibility (online, active, kickout, connectionState),
// originates the call to FreeSWITCH conference, and handles retry logic.
import { logSystem, logUser } from '../logger.js';
import { isUserInConference } from './conferenceSync.js';
import { getConnection } from './connection.js';

export const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;
const FALLBACK_DELAYS = [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];
const FALLBACK_LABELS = ['15min', '30min', '1hr'];

let _locked = true;
logSystem('GATE', 'LOCKED — startup (waiting for ESL sync)');

export function lockCalls(reason) {
    _locked = true;
    logSystem('GATE', `LOCKED — ${reason}`);
}

export function unlockCalls() {
    _locked = false;
    logSystem('GATE', 'UNLOCKED — system ready');
}

export function canInitiateCall(userName) {
    if (_locked) {
        return { allowed: false, reason: 'system_locked', message: 'System is starting up or shutting down' };
    }

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) {
        return { allowed: false, reason: 'not_found', message: `${userName} not in user table` };
    }

    if (!userInfo.online) {
        return { allowed: false, reason: 'offline', message: `${userName} is offline` };
    }

    if (userInfo.connectionState === 'connected' || userInfo.connectionState === 'connecting') {
        return { allowed: false, reason: 'already_in_call', message: `${userName} already ${userInfo.connectionState}` };
    }

    if (userInfo.connectionState === 'error') {
        return { allowed: false, reason: 'error', message: `${userName} in error state: ${userInfo.error || 'unknown'}` };
    }

    if (userInfo.authState === 'logout') {
        return { allowed: false, reason: 'logged_out', message: `${userName} is logged out` };
    }

    const email = userName.replace('sip:', '');
    const account = global.db.getAccountByEmail(email);

    if (!account) {
        return { allowed: false, reason: 'no_account', message: `${userName} has no account` };
    }

    if (!account.active) {
        return { allowed: false, reason: 'inactive', message: `${userName} account inactive` };
    }

    if (account.kickout) {
        return { allowed: false, reason: 'kickout', message: `${userName} is kicked out` };
    }

    return { allowed: true, userInfo, account };
}

export async function initiateCall(userName) {
    const gate = canInitiateCall(userName);
    if (!gate.allowed) {
        if (gate.reason !== 'already_in_call') logUser(userName, 'GATE', `BLOCKED — ${gate.reason}`);
        return false;
    }

    const userInfo = global.db.getUserInfo(userName);

    if (userInfo.connectionState === 'retry') {
        if ((userInfo.retryCount || 0) >= MAX_RETRIES) {
            const stage = userInfo.errFallbackStage || 0;
            if (stage < FALLBACK_DELAYS.length) {
                const delay = FALLBACK_DELAYS[stage];
                const fallbackAt = Math.floor(Date.now() / 1000) + Math.floor(delay / 1000);
                userInfo.connectionState = 'error';
                userInfo.error = userInfo.error || 'Max retries exceeded';
                userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                userInfo.errFallbackStage = stage + 1;
                userInfo.errFallbackAt = fallbackAt;
                global.db.setUserInfo(userName, userInfo);
                logUser(userName, 'GATE', `max retries — fallback ${stage + 1}/${FALLBACK_DELAYS.length} in ${FALLBACK_LABELS[stage]}`);
                _scheduleFallback(userName, delay);
                return false;
            }
            userInfo.connectionState = 'error';
            userInfo.error = userInfo.error || 'Max retries exceeded';
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            userInfo.errFallbackAt = null;
            global.db.setUserInfo(userName, userInfo);
            logUser(userName, 'GATE', `max retries — all fallbacks exhausted, giving up`);
            return false;
        }
        userInfo.retryCount = (userInfo.retryCount || 0) + 1;
    }

    userInfo.connectionState = 'connecting';
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);

    const activeRoom = userInfo.currentRoom || userInfo.room;
    const roomName = global.config.ROOM_NAME[activeRoom] || activeRoom;
    logUser(userName, 'GATE', `ALLOW -> ${roomName}${userInfo.retryCount ? ` (retry ${userInfo.retryCount}/${MAX_RETRIES})` : ''}`);

    try {
        await _originateToConference(userName);
        return true;
    } catch (err) {
        logUser(userName, 'GATE', `FAILED: ${err.message}`);

        const updatedInfo = global.db.getUserInfo(userName);

        if (err.message.includes('USER_BUSY')) {
            const member = await isUserInConference(userName);
            if (member) {
                updatedInfo.connectionState = 'connected';
                updatedInfo.fsMemberId = member.memberId;
                updatedInfo.fsChannelUUID = member.uuid;
                updatedInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                updatedInfo.error = null;
                updatedInfo.retryCount = 0;
                updatedInfo.errFallbackStage = 0;
                updatedInfo.errFallbackAt = null;
                global.db.setUserInfo(userName, updatedInfo);
                logUser(userName, 'GATE', 'already in conference, syncing to connected');
                return true;
            }
        }

        if (updatedInfo.connectionState === 'hangup') {
            logUser(userName, 'GATE', 'hung up during connect, skip retry');
            return false;
        }

        updatedInfo.connectionState = 'retry';
        updatedInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
        updatedInfo.error = err.message;
        global.db.setUserInfo(userName, updatedInfo);

        logUser(userName, 'GATE', `retrying in ${RETRY_DELAY / 1000}s`);
        setTimeout(() => initiateCall(userName), RETRY_DELAY);

        return false;
    }
}

// Yealink registers as user@domain, web as user.at.domain@fsIp — two distinct
// AORs, so FreeSWITCH's registration DB is per-device truth. Probe one device.
export function probeDeviceContact(userName, deviceType) {
    return new Promise((resolve) => {
        const conn = getConnection();
        if (!conn) return resolve(null);
        const sipUser = userName.replace('sip:', '');
        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const fsIp = global.config.FREESWITCH_PUBLIC_IP;
        const key = deviceType === 'web'
            ? `${sipUser.includes('@') ? sipUser.replace('@', '.at.') : sipUser}@${fsIp}`
            : sipUser;
        conn.api(`sofia_contact ${profile}/${key}`, (res) => {
            const contact = (res.getBody() || '').trim();
            if (!contact || contact.startsWith('-ERR') || contact === 'error/user_not_registered') {
                resolve(null);
                return;
            }
            resolve(contact);
        });
    });
}

// Device priority: web_takeover on → web first, off → Yealink first.
// First registered device wins; the other is the automatic fallback.
export async function resolveTargetContact(userInfo) {
    const order = userInfo.webTakeover ? ['web', 'yealink'] : ['yealink', 'web'];
    for (const deviceType of order) {
        const contact = await probeDeviceContact(userInfo.userName, deviceType);
        if (contact) return { contact, deviceType };
    }
    return null;
}

function _originateToConference(userName) {
    return new Promise((resolve, reject) => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) {
            reject(new Error(`User ${userName} not found`));
            return;
        }

        const activeRoomId = userInfo.currentRoom || userInfo.room;
        const roomName = global.config.ROOM_NAME[activeRoomId] || activeRoomId || 'Unknown';
        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;

        resolveTargetContact(userInfo).then((target) => {
            if (!target) {
                reject(new Error(`User ${userName} not registered on FreeSWITCH`));
                return;
            }
            if (userInfo.webTakeover || target.deviceType !== (userInfo.clientType || 'yealink')) {
                logUser(userName, 'CALL', `device resolve -> ${target.deviceType} (web_takeover=${userInfo.webTakeover ? 'on' : 'off'})`);
            }
            const conn = getConnection();
            _originate(conn, target, userName, userInfo, roomName, confProfile, resolve, reject);
        });
    });
}

function _originate(conn, target, userName, userInfo, roomName, confProfile, resolve, reject) {
    const contact = target.contact;
    const activeRoom = userInfo.currentRoom || userInfo.room;
    const email = userName.replace('sip:', '');
    const account = global.db.getAccountByEmail(email);
    const room = global.db.getRoom(activeRoom);
    const shortCode = room?.short_code || roomName;
    const ext = account?.extension ? `-${account.extension}` : '';
    const callerId = `REDLINE-${shortCode}${ext}`;
    const originateVars = [
        `origination_caller_id_name='${callerId}'`,
        `origination_caller_id_number='${callerId}'`,
        'sofia_session_timeout=120',
        'sofia_session_refresher=remote',
    ];
    const originateCmd = `originate {${originateVars.join(',')}}${contact} &conference(${activeRoom}@${confProfile}++flags{mute})`;

    const originateAt = Date.now();
    logUser(userName, 'CALL', `INVITE -> ${roomName}`);

    conn.bgapi(originateCmd, (jobEvent) => {
        const body = (jobEvent.getBody() || '').trim();
        const elapsed = Date.now() - originateAt;

        if (body.startsWith('+OK')) {
            const uuid = body.replace('+OK ', '').trim();
            logUser(userName, 'CALL', `OK    <- ${roomName} (${elapsed}ms)`);

            userInfo.fsChannelUUID = uuid;
            userInfo.connectionState = 'connected';
            // clientType tracks the device that actually holds the conference leg
            userInfo.clientType = target.deviceType;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            userInfo.error = null;
            userInfo.retryCount = 0;
            userInfo.errFallbackStage = 0;
            userInfo.errFallbackAt = null;
            global.db.setUserInfo(userName, userInfo);

            resolve(userInfo);
        } else {
            logUser(userName, 'CALL', `FAILED: ${body}`);
            reject(new Error(body));
        }
    });
}

function _scheduleFallback(userName, delay) {
    setTimeout(() => {
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) return;
        if (!userInfo.online) return;
        if (userInfo.connectionState !== 'error') return;

        logUser(userName, 'GATE', `FALLBACK ${userInfo.errFallbackStage}/${FALLBACK_DELAYS.length} — retrying now`);
        userInfo.connectionState = 'ideal';
        userInfo.retryCount = 0;
        userInfo.error = null;
        userInfo.errFallbackAt = null;
        global.db.setUserInfo(userName, userInfo);
        initiateCall(userName);
    }, delay);
}

export function resumeFallbacks() {
    const users = global.db.getAllUserInfo();
    const now = Math.floor(Date.now() / 1000);
    let resumed = 0;

    for (const user of users) {
        if (user.connectionState !== 'error' || !user.online) continue;
        if (!user.errFallbackAt || user.errFallbackStage >= FALLBACK_DELAYS.length) continue;

        const delayMs = Math.max(0, (user.errFallbackAt - now) * 1000);
        if (delayMs > 0) {
            logSystem('GATE', `FALLBACK resume ${user.userName} — ${Math.round(delayMs / 1000)}s remaining`);
        } else {
            logSystem('GATE', `FALLBACK resume ${user.userName} — overdue, retrying now`);
        }
        _scheduleFallback(user.userName, delayMs);
        resumed++;
    }

    if (resumed > 0) logSystem('GATE', `FALLBACK resumed ${resumed} pending retries`);
}
