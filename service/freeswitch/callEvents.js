// Reactive ESL event handlers. Listens to FreeSWITCH events and updates user state.
// CHANNEL_ANSWER: tracks new calls, rejects in-flight originates for kicked/inactive users.
// CHANNEL_HANGUP: cleans up call state, triggers auto-reconnect if user still online.
// conference::maintenance: tracks member join/leave/mute/unmute.
// ESL disconnect: resets all connected users. ESL reconnect: syncs with actual conference state.
import { getConnection, getConnectionHandlers, getMemberIdMap, onCustomEvent, onAnswerEvent, onHangupEvent, onEslDisconnect, onEslReconnect } from './connection.js';
import { initiateCall, canInitiateCall, unlockCalls } from './callGate.js';

// UUID → userName map — survives DB cleanup so hangup logs always show the user
const uuidUserMap = new Map();

onAnswerEvent(_handleChannelAnswer);
onHangupEvent(_handleChannelHangup);
onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'conference::maintenance') _handleConferenceEvent(event);
});

onEslDisconnect(() => {
    console.log('[ESL] Disconnected — marking all connected users as hangup');
    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' || u.connectionState === 'connecting'
    );
    for (const user of connectedUsers) {
        user.connectionState = 'hangup';
        user.fsChannelUUID = null;
        user.fsMemberId = null;
        user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
        global.db.setUserInfo(user.userName, user);
        global.db.logEvent('esl_disconnect', user.userName, user.room, 'ESL disconnected — call state unknown');
        console.log(`[ESL] RESET ${user.userName} -> hangup`);
    }
    getConnectionHandlers().clear();
    getMemberIdMap().clear();
    uuidUserMap.clear();
});

onEslReconnect(() => {
    console.log('[ESL] Reconnected — syncing state with FreeSWITCH');
    setTimeout(() => _syncConferenceState(), 3000);
});

// Also sync on initial ESL connect (after hupall in connection.js completes)
setTimeout(() => {
    if (getConnection()) _syncConferenceState();
}, 5000);

function _syncConferenceState() {
    const conn = getConnection();
    if (!conn) return;

    conn.api('conference xml_list', (response) => {
        const body = response.getBody().trim();

        if (!body || body.includes('No active conferences') || body.startsWith('-ERR')) {
            console.log('[ESL] SYNC no active conferences');
            // Mark any users showing connected as hangup
            const allUsers = global.db.getAllUserInfo();
            for (const user of allUsers) {
                if (user.connectionState === 'connected' || user.connectionState === 'connecting') {
                    user.connectionState = 'hangup';
                    user.fsChannelUUID = null;
                    user.fsMemberId = null;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    console.log(`[ESL] SYNC ${user.userName} -> hangup (no conferences)`);
                }
            }
            unlockCalls();
            return;
        }

        // Parse XML to extract uuid and callerIdName per member
        const activeMembers = new Map();
        const memberBlocks = body.split('<member>');
        for (let i = 1; i < memberBlocks.length; i++) {
            const block = memberBlocks[i];
            const uuidMatch = block.match(/<uuid>([^<]+)<\/uuid>/);
            const cidNameMatch = block.match(/<caller_id_name>([^<]+)<\/caller_id_name>/);
            const cidNumMatch = block.match(/<caller_id_number>([^<]+)<\/caller_id_number>/);
            const memberIdMatch = block.match(/<id>(\d+)<\/id>/);
            if (!uuidMatch) continue;

            const uuid = uuidMatch[1];
            const callerIdName = cidNameMatch ? cidNameMatch[1] : '';
            const callerIdNumber = cidNumMatch ? cidNumMatch[1] : '';
            const memberId = memberIdMatch ? memberIdMatch[1] : null;
            activeMembers.set(uuid, { callerIdName, callerIdNumber, memberId });
        }

        console.log(`[ESL] SYNC found ${activeMembers.size} active members in conferences`);

        const allUsers = global.db.getAllUserInfo();
        const matchedUuids = new Set();

        for (const user of allUsers) {
            // Try matching by existing UUID first
            if (user.fsChannelUUID && activeMembers.has(user.fsChannelUUID)) {
                matchedUuids.add(user.fsChannelUUID);
                if (user.connectionState !== 'connected') {
                    const member = activeMembers.get(user.fsChannelUUID);
                    user.connectionState = 'connected';
                    user.fsMemberId = member.memberId;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    uuidUserMap.set(user.fsChannelUUID, user.userName);
                    console.log(`[ESL] SYNC ${user.userName} -> connected (UUID match)`);
                }
                continue;
            }

            // Try matching by callerIdName (format: "CompanyName / DisplayName")
            for (const [uuid, member] of activeMembers) {
                if (matchedUuids.has(uuid)) continue;
                if (user.callerIdName && member.callerIdName === user.callerIdName) {
                    matchedUuids.add(uuid);
                    user.fsChannelUUID = uuid;
                    user.fsMemberId = member.memberId;
                    user.connectionState = 'connected';
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    uuidUserMap.set(uuid, user.userName);
                    console.log(`[ESL] SYNC ${user.userName} -> connected (callerIdName match, uuid=${uuid.slice(0, 8)})`);
                    break;
                }
            }

            // User not found in any conference
            if (!matchedUuids.has(user.fsChannelUUID) && (user.connectionState === 'connected' || user.connectionState === 'connecting')) {
                user.connectionState = 'hangup';
                user.fsChannelUUID = null;
                user.fsMemberId = null;
                user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(user.userName, user);
                console.log(`[ESL] SYNC ${user.userName} -> hangup (not in conference)`);
            }
        }

        unlockCalls();
    });
}

function _handleChannelAnswer(event) {
    const uuid = event.getHeader('Unique-ID');

    // Find user by UUID (set by _originateToConference on successful originate)
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    const userName = users.length > 0 ? users[0].userName : null;

    if (userName) uuidUserMap.set(uuid, userName);
    console.log(`[CALL] ANSWER ${userName || 'unknown'}`);

    // Check if this call should be allowed (catches in-flight originates after kickout/deactivation)
    if (userName) {
        const gate = canInitiateCall(userName);
        if (!gate.allowed && gate.reason !== 'already_in_call' && gate.reason !== 'not_found') {
            console.log(`[CALL] REJECT ${userName} — ${gate.reason} (in-flight originate)`);
            getConnection().api(`uuid_kill ${uuid}`, () => {});
            return;
        }
    }

    // Track the call if not already tracked via connectionHandlers
    const connectionHandlers = getConnectionHandlers();
    if (userName && !connectionHandlers.has(uuid)) {
        const userInfo = global.db.getUserInfo(userName);

        if (Object.keys(userInfo).length > 0) {
            userInfo.connectionState = 'connected';
            userInfo.authState = 'login';
            userInfo.login_expire = Math.floor(Date.now() / 1000) + global.config.loginExpireTime;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            userInfo.error = null;
            userInfo.retryCount = 0;
            global.db.setUserInfo(userName, userInfo);
            console.log(`[CALL] TRACK ${userName}`);

            connectionHandlers.set(uuid, (_hangupUuid, cause) => {
                _onCallHangup(userName, _hangupUuid, cause);
            });
        }
    }
}

function _handleChannelHangup(event) {
    const uuid = event.getHeader('Unique-ID');
    const cause = event.getHeader('Hangup-Cause');
    const knownUser = uuidUserMap.get(uuid) || null;

    // Try connectionHandlers first (fastest, has userName baked in)
    const connectionHandlers = getConnectionHandlers();
    if (connectionHandlers.has(uuid)) {
        const handler = connectionHandlers.get(uuid);
        connectionHandlers.delete(uuid);
        uuidUserMap.delete(uuid);
        handler(uuid, cause);
        return;
    }

    // Try DB lookup by UUID
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    if (users.length > 0) {
        console.log(`[CALL] HANGUP ${users[0].userName} cause=${cause}`);
        uuidUserMap.delete(uuid);
        _onCallHangup(users[0].userName, uuid, cause);
        return;
    }

    // UUID already cleared from DB — use the cached userName
    console.log(`[CALL] HANGUP ${knownUser || 'unknown'} cause=${cause} (already cleaned up)`);
    uuidUserMap.delete(uuid);
}

function _onCallHangup(userName, _uuid, cause) {
    console.log('');
    console.log(`[CALL] END ${userName} cause=${cause}`);

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    userInfo.mute = true;
    userInfo.connectionState = 'hangup';
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    userInfo.error = null;
    userInfo.retryCount = 0;
    global.db.setUserInfo(userName, userInfo);

    if (userInfo.online) {
        initiateCall(userName);
    }
}

function _handleConferenceEvent(event) {
    const action = event.getHeader('Action');
    const conferenceName = event.getHeader('Conference-Name');
    const memberId = event.getHeader('Member-ID');
    const callerIdName = event.getHeader('Caller-Caller-ID-Name');
    const room = parseInt(conferenceName) || null;
    const roomName = global.config.ROOM_NAME[room] || conferenceName;

    switch (action) {
        case 'add-member': {
            console.log(`[CONF] JOIN ${callerIdName} -> ${roomName} (member ${memberId})`);
            _updateMemberMapping(conferenceName, memberId, callerIdName, event);
            global.db.logEvent('conference_join', callerIdName, room, 'Joined conference');
            break;
        }
        case 'del-member': {
            console.log(`[CONF] LEAVE ${callerIdName} <- ${roomName} (member ${memberId})`);
            const uuid = event.getHeader('Unique-ID');
            if (uuid) {
                const users = global.db.filter(u => u.fsChannelUUID === uuid);
                if (users.length > 0) {
                    const user = users[0];
                    user.fsMemberId = null;
                    user.connectionState = 'hangup';
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    console.log(`[CONF] LEAVE updated ${user.userName} -> hangup`);
                }
            }
            getMemberIdMap().delete(`${conferenceName}:${memberId}`);
            global.db.logEvent('conference_leave', callerIdName, room, 'Left conference');
            break;
        }
        case 'mute-member': {
            const muteUser = _findUserByMember(conferenceName, memberId);
            if (muteUser) {
                muteUser.mute = true;
                global.db.setUserInfo(muteUser.userName, muteUser);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: muteUser.userName });
                console.log(`[CONF] MUTE ${muteUser.userName} (member ${memberId})`);
            }
            global.db.logEvent('mute', muteUser?.userName || null, room, 'Member muted');
            break;
        }
        case 'unmute-member': {
            const unmuteUser = _findUserByMember(conferenceName, memberId);
            if (unmuteUser) {
                unmuteUser.mute = false;
                global.db.setUserInfo(unmuteUser.userName, unmuteUser);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: unmuteUser.userName });
                console.log(`[CONF] UNMUTE ${unmuteUser.userName} (member ${memberId})`);
            }
            global.db.logEvent('unmute', unmuteUser?.userName || null, room, 'Member unmuted');
            _broadcastCallerIdToRoom(conferenceName);
            break;
        }
    }
}

function _updateMemberMapping(conferenceName, memberId, callerIdName, event) {
    const uuid = event.getHeader('Unique-ID');
    if (!uuid) return;

    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    if (users.length > 0) {
        const userInfo = users[0];
        userInfo.fsMemberId = memberId;
        global.db.setUserInfo(userInfo.userName, userInfo);
    }

    getMemberIdMap().set(`${conferenceName}:${memberId}`, { uuid, callerIdName });
}

function _findUserByMember(conferenceName, memberId) {
    // Try memberIdMap first
    const mapping = getMemberIdMap().get(`${conferenceName}:${memberId}`);
    if (mapping) {
        const users = global.db.filter(u => u.fsChannelUUID === mapping.uuid);
        if (users.length > 0) return users[0];
    }
    // Fallback: find by fsMemberId in DB
    const byMemberId = global.db.filter(u => u.fsMemberId === memberId || u.fsMemberId === String(memberId));
    if (byMemberId.length > 0) return byMemberId[0];
    return null;
}

function _broadcastCallerIdToRoom(conferenceName) {
    const room = parseInt(conferenceName);
    if (!room) return;

    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && u.room === room && !u.payment
    );

    console.log(`[CONF] CALLERID-UPDATE ${global.config.ROOM_NAME[room] || conferenceName} (${connectedUsers.length} users)`);
}
