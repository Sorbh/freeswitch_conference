// Shared conference state synchronization. Queries FreeSWITCH `conference {room} list`
// and reconciles DB user state with actual conference membership.
// Used by: callEvents (ESL reconnect), onlineSync (reg-poll), callGate (USER_BUSY check).
import { getConnection, isConnected } from './connection.js';
import { logSystem } from '../logger.js';

function _parseConferenceList(body) {
    const members = [];
    for (const line of body.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split(';');
        members.push({
            memberId: parts[0] || null,
            uuid: parts[2] || null,
            callerIdNumber: parts[4] || null,
            raw: line,
        });
    }
    return members;
}

export function getConferenceMembers(callback) {
    if (!isConnected()) { callback([]); return; }

    const allUsers = global.db.getAllUserInfo();
    const rooms = new Set(allUsers.map(u => u.currentRoom || u.room).filter(Boolean));
    if (rooms.size === 0) { callback([]); return; }

    const conn = getConnection();
    let pending = rooms.size;
    const allMembers = [];

    for (const room of rooms) {
        conn.api(`conference ${room} list`, (response) => {
            const body = response.getBody().trim();
            if (body && !body.startsWith('-ERR')) {
                allMembers.push(..._parseConferenceList(body));
            }
            pending--;
            if (pending === 0) callback(allMembers);
        });
    }
}

// Full sync: reconcile all users with actual conference state.
// markHangup=true (ESL reconnect): demote unmatched connected users to hangup.
// markHangup=false (reg-poll): only promote disconnected users found in conference.
// onUserConnected(user, member): optional callback when a user is synced to connected.
export function syncAllUsers({ markHangup = false, onUserConnected, logPrefix = 'SYNC' } = {}, callback) {
    getConferenceMembers((members) => {
        const allUsers = global.db.getAllUserInfo();
        const memberByUuid = new Map();
        for (const m of members) {
            if (m.uuid) memberByUuid.set(m.uuid, m);
        }
        const matchedUuids = new Set();
        let fixes = 0;

        for (const user of allUsers) {
            // Try UUID match first
            if (user.fsChannelUUID && memberByUuid.has(user.fsChannelUUID)) {
                matchedUuids.add(user.fsChannelUUID);
                if (user.connectionState !== 'connected') {
                    const member = memberByUuid.get(user.fsChannelUUID);
                    user.connectionState = 'connected';
                    user.fsMemberId = member.memberId;
                    user.error = null;
                    user.retryCount = 0;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    if (onUserConnected) onUserConnected(user, member);
                    logSystem(logPrefix, `${user.userName} -> connected (UUID match)`);
                    fixes++;
                }
                continue;
            }

            // Skip already-connected users for SIP match (UUID match above already validated them)
            if (user.connectionState === 'connected' || user.connectionState === 'connecting') {
                // If markHangup, we'll check below if they weren't matched
                if (!markHangup) continue;
            }

            // Try SIP username match
            const sipUser = user.userName.replace('sip:', '');
            const sipLocal = sipUser.split('@')[0];
            let matched = false;
            for (const member of members) {
                if (matchedUuids.has(member.uuid)) continue;
                if (member.callerIdNumber === sipLocal) {
                    matchedUuids.add(member.uuid);
                    user.fsChannelUUID = member.uuid;
                    user.fsMemberId = member.memberId;
                    user.connectionState = 'connected';
                    user.error = null;
                    user.retryCount = 0;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    if (onUserConnected) onUserConnected(user, member);
                    logSystem(logPrefix, `${user.userName} -> connected (SIP match)`);
                    matched = true;
                    fixes++;
                    break;
                }
            }

            // Not found in any conference — demote if markHangup is on
            if (!matched && markHangup &&
                !matchedUuids.has(user.fsChannelUUID) &&
                (user.connectionState === 'connected' || user.connectionState === 'connecting')) {
                user.connectionState = 'hangup';
                user.fsChannelUUID = null;
                user.fsMemberId = null;
                user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(user.userName, user);
                logSystem(logPrefix, `${user.userName} -> hangup (not in conference)`);
            }
        }

        if (fixes > 0) {
            logSystem(logPrefix, `fixed ${fixes} connection states`);
        }

        if (callback) callback(allUsers);
    });
}

// Check if a specific user is in their conference room. Returns Promise<{memberId, uuid} | null>.
export function isUserInConference(userName) {
    return new Promise((resolve) => {
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) { resolve(null); return; }

        const room = userInfo.currentRoom || userInfo.room;
        if (!room) { resolve(null); return; }
        if (!isConnected()) { resolve(null); return; }

        getConnection().api(`conference ${room} list`, (response) => {
            const body = response.getBody().trim();
            if (!body || body.startsWith('-ERR')) { resolve(null); return; }

            const sipUser = userName.replace('sip:', '');
            const sipLocal = sipUser.split('@')[0];
            const members = _parseConferenceList(body);

            for (const member of members) {
                if (member.callerIdNumber === sipLocal) {
                    resolve({ memberId: member.memberId, uuid: member.uuid });
                    return;
                }
            }
            resolve(null);
        });
    });
}
