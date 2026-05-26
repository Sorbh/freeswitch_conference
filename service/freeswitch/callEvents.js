// Reactive ESL event handlers. Listens to FreeSWITCH events and updates user state.
// CHANNEL_ANSWER: tracks new calls, rejects in-flight originates for kicked/inactive users.
// CHANNEL_HANGUP: cleans up call state, triggers auto-reconnect if user still online.
// conference::maintenance: tracks member join/leave/mute/unmute.
// ESL disconnect: resets all connected users. ESL reconnect: syncs with actual conference state.
import { getConnection, getConnectionHandlers, getMemberIdMap, onCustomEvent, onAnswerEvent, onHangupEvent, onEslDisconnect, onEslReconnect } from './connection.js';
import { initiateCall, canInitiateCall } from './callGate.js';

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
    setTimeout(() => _syncConferenceState(), 2000);
});

function _syncConferenceState() {
    const conn = getConnection();
    if (!conn) return;

    conn.api('conference list', (response) => {
        const body = response.getBody().trim();

        const activeUuids = new Set();
        if (body && !body.includes('No active conferences')) {
            for (const line of body.split('\n')) {
                const parts = line.split(';');
                if (parts.length > 2) {
                    const uuid = parts[2];
                    if (uuid && uuid.length > 8) activeUuids.add(uuid);
                }
            }
        }

        console.log(`[ESL] SYNC found ${activeUuids.size} active channels in conferences`);

        const allUsers = global.db.getAllUserInfo();
        for (const user of allUsers) {
            if (user.fsChannelUUID && activeUuids.has(user.fsChannelUUID)) {
                if (user.connectionState !== 'connected') {
                    user.connectionState = 'connected';
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    console.log(`[ESL] SYNC ${user.userName} -> connected (found in conference)`);
                }
            } else if (user.connectionState === 'connected' || user.connectionState === 'connecting') {
                user.connectionState = 'hangup';
                user.fsChannelUUID = null;
                user.fsMemberId = null;
                user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(user.userName, user);
                global.db.logEvent('esl_sync', user.userName, user.room, 'Not found in conference after ESL reconnect');
                console.log(`[ESL] SYNC ${user.userName} -> hangup (not in conference)`);
            }
        }
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
    delete userInfo.error;
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
            const muteKey = `${conferenceName}:${memberId}`;
            const muteMapping = getMemberIdMap().get(muteKey);
            if (muteMapping) {
                const users = global.db.filter(u => u.fsChannelUUID === muteMapping.uuid);
                if (users.length > 0) {
                    users[0].mute = true;
                    global.db.setUserInfo(users[0].userName, users[0]);
                }
            }
            global.db.logEvent('mute', null, room, 'Member muted');
            break;
        }
        case 'unmute-member': {
            const unmuteKey = `${conferenceName}:${memberId}`;
            const unmuteMapping = getMemberIdMap().get(unmuteKey);
            if (unmuteMapping) {
                const users = global.db.filter(u => u.fsChannelUUID === unmuteMapping.uuid);
                if (users.length > 0) {
                    users[0].mute = false;
                    global.db.setUserInfo(users[0].userName, users[0]);
                }
            }
            global.db.logEvent('unmute', null, room, 'Member unmuted');
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

function _broadcastCallerIdToRoom(conferenceName) {
    const room = parseInt(conferenceName);
    if (!room) return;

    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && u.room === room && !u.payment
    );

    console.log(`[CONF] CALLERID-UPDATE ${global.config.ROOM_NAME[room] || conferenceName} (${connectedUsers.length} users)`);
}
