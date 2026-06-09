// Single entry point for initiating calls to SIP clients.
// Validates eligibility (online, active, kickout, connectionState),
// originates the call to FreeSWITCH conference, and handles retry logic.
import { getConnection } from './connection.js';
import { logUser, logSystem } from '../logger.js';

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
            const alreadyConnected = await _checkUserInConference(userName, updatedInfo);
            if (alreadyConnected) {
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

function _originateToConference(userName) {
    return new Promise((resolve, reject) => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) {
            reject(new Error(`User ${userName} not found`));
            return;
        }

        const activeRoomId = userInfo.currentRoom || userInfo.room;
        const roomName = global.config.ROOM_NAME[activeRoomId] || activeRoomId || 'Unknown';
        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;

        const sipUser = userInfo.userName.replace('sip:', '');
        const sipUserEncoded = sipUser.includes('@') ? sipUser.replace('@', '.at.') : sipUser;
        const fsIp = global.config.FREESWITCH_PUBLIC_IP;
        const lookupVariants = [
            `sofia_contact ${profile}/${sipUserEncoded}@${fsIp}`,
            `sofia_contact ${profile}/${sipUser}`,
        ];

        const conn = getConnection();
        const tryLookup = (idx) => {
            if (idx >= lookupVariants.length) {
                reject(new Error(`User ${userName} not registered on FreeSWITCH`));
                return;
            }
            conn.api(lookupVariants[idx], (contactResponse) => {
                const contact = contactResponse.getBody().trim();
                if (!contact || contact.startsWith('-ERR') || contact === 'error/user_not_registered') {
                    tryLookup(idx + 1);
                    return;
                }
                _originate(conn, contact, userName, userInfo, roomName, confProfile, resolve, reject);
            });
        };
        tryLookup(0);
    });
}

function _checkUserInConference(userName, userInfo) {
    return new Promise((resolve) => {
        const room = userInfo.currentRoom || userInfo.room;
        if (!room) { resolve(false); return; }

        getConnection().api(`conference ${room} list`, (response) => {
            const body = response.getBody().trim();
            if (!body || body.startsWith('-ERR')) { resolve(false); return; }

            const sipUser = userName.replace('sip:', '');
            const sipLocal = sipUser.split('@')[0];
            const lines = body.split('\n');
            for (const line of lines) {
                if (line.includes(sipLocal)) {
                    const parts = line.split(';');
                    const memberId = parts[0];
                    const uuid = parts[2];
                    userInfo.connectionState = 'connected';
                    userInfo.fsMemberId = memberId;
                    userInfo.fsChannelUUID = uuid;
                    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    userInfo.error = null;
                    userInfo.retryCount = 0;
                    userInfo.errFallbackStage = 0;
                    userInfo.errFallbackAt = null;
                    global.db.setUserInfo(userName, userInfo);
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        });
    });
}

function _originate(conn, contact, userName, userInfo, roomName, confProfile, resolve, reject) {
    const activeRoom = userInfo.currentRoom || userInfo.room;
    const originateCmd = `originate {origination_caller_id_name='REDLINE-${roomName}',origination_caller_id_number='REDLINE-${roomName}',sip_h_Supported='timer',sip_h_Session-Expires='600;refresher=uas'}${contact} &conference(${activeRoom}@${confProfile}++flags{mute})`;

    logUser(userName, 'CALL', `ORIGINATE -> ${roomName}`);

    conn.api(originateCmd, (response) => {
        const body = response.getBody().trim();

        if (body.startsWith('+OK')) {
            const uuid = body.replace('+OK ', '').trim();
            logUser(userName, 'CALL', 'OK');

            userInfo.fsChannelUUID = uuid;
            userInfo.connectionState = 'connected';
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
