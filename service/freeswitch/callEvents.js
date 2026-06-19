// Reactive ESL event handlers. Listens to FreeSWITCH events and updates user state.
// CHANNEL_ANSWER: tracks new calls, rejects in-flight originates for kicked/inactive users.
// CHANNEL_HANGUP: cleans up call state, triggers auto-reconnect if user still online.
// conference::maintenance: tracks member join/leave/mute/unmute.
// ESL disconnect: resets all connected users. ESL reconnect: syncs with actual conference state.
import { logSystem, logUser, logUserImmediate } from '../logger.js';
import { canInitiateCall, initiateCall, resumeFallbacks, unlockCalls } from './callGate.js';
import { syncAllUsers } from './conferenceSync.js';
import { getConnection, getConnectionHandlers, getMemberIdMap, onAnswerEvent, onCustomEvent, onEslDisconnect, onEslReconnect, onHangupEvent } from './connection.js';
import { isInDirectCall } from './directCall.js';
import { showMessage } from './notifications.js';

// UUID → userName map — survives DB cleanup so hangup logs always show the user
const uuidUserMap = new Map();
const _talkingUsers = new Set();
export function getTalkingUsers() { return _talkingUsers; }

onAnswerEvent(_handleChannelAnswer);
onHangupEvent(_handleChannelHangup);
onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'conference::maintenance') _handleConferenceEvent(event);
});

onEslDisconnect(() => {
    logSystem('ESL', 'Disconnected — marking all connected users as hangup');
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
        logSystem('ESL', `RESET ${user.userName} -> hangup`);
    }
    getConnectionHandlers().clear();
    getMemberIdMap().clear();
    uuidUserMap.clear();
    _talkingUsers.clear();
});

onEslReconnect(() => {
    logSystem('ESL', 'Reconnected — syncing state with FreeSWITCH');
    setTimeout(() => _runSync(), 3000);
});

function _runSync() {
    syncAllUsers({
        markHangup: true,
        logPrefix: 'ESL',
        onUserConnected: (user) => {
            if (user.fsChannelUUID) uuidUserMap.set(user.fsChannelUUID, user.userName);
        },
    }, () => {
        unlockCalls();
        resumeFallbacks();
    });
}

function _handleChannelAnswer(event) {
    const uuid = event.getHeader('Unique-ID');

    // Find user by UUID (set by _originateToConference on successful originate)
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    const userName = users.length > 0 ? users[0].userName : null;

    if (userName) uuidUserMap.set(uuid, userName);
    logUser(userName, 'CALL', 'ANSWER <-');

    // Check if this call should be allowed (catches in-flight originates after kickout/deactivation)
    if (userName) {
        const gate = canInitiateCall(userName);
        if (!gate.allowed && gate.reason !== 'already_in_call' && gate.reason !== 'not_found') {
            logUser(userName, 'CALL', `REJECT — ${gate.reason} (in-flight originate)`);
            getConnection().api(`uuid_kill ${uuid}`, () => { });
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
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            userInfo.error = null;
            userInfo.retryCount = 0;
            userInfo.errFallbackStage = 0;
            userInfo.errFallbackAt = null;
            global.db.setUserInfo(userName, userInfo);
            logUser(userName, 'CALL', 'TRACK');

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
        logUser(knownUser, 'CALL', `HANGUP <- cause=${cause}`);
        const handler = connectionHandlers.get(uuid);
        connectionHandlers.delete(uuid);
        uuidUserMap.delete(uuid);
        handler(uuid, cause);
        return;
    }

    // Try DB lookup by UUID
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    if (users.length > 0) {
        logUser(users[0].userName, 'CALL', `HANGUP <- cause=${cause}`);
        uuidUserMap.delete(uuid);
        _onCallHangup(users[0].userName, uuid, cause);
        return;
    }

    uuidUserMap.delete(uuid);
    if (knownUser) logUser(knownUser, 'CALL', `HANGUP <- cause=${cause} (already cleaned up)`);
}

function _onCallHangup(userName, _uuid, cause) {
    logUser(userName, 'CALL', `END cause=${cause}`);

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    userInfo.mute = true;
    userInfo.connectionState = 'hangup';
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    userInfo.error = null;
    userInfo.retryCount = 0;
    userInfo.errFallbackStage = 0;
    userInfo.errFallbackAt = null;
    global.db.setUserInfo(userName, userInfo);

    if (userInfo.online && !isInDirectCall(_uuid)) {
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
            const joinUuid2 = event.getHeader('Unique-ID');
            const joinUserName = uuidUserMap.get(joinUuid2) || null;
            logUserImmediate(joinUserName, 'CONF', `JOIN ${callerIdName} -> ${roomName} (member ${memberId})`);
            _updateMemberMapping(conferenceName, memberId, callerIdName, event);
            const joinUuid = event.getHeader('Unique-ID');
            if (joinUuid) {
                const joinUsers = global.db.filter(u => u.fsChannelUUID === joinUuid);
                if (joinUsers.length > 0) global.db.touchLastSeen(joinUsers[0].userName);
            }
            global.db.logEvent('conference_join', callerIdName, room, 'Joined conference');
            break;
        }
        case 'del-member': {
            logUser(null, 'CONF', `LEAVE ${callerIdName} <- ${roomName} (member ${memberId})`);
            const uuid = event.getHeader('Unique-ID');
            const delUser = uuid ? global.db.filter(u => u.fsChannelUUID === uuid)[0] : null;
            if (delUser) {
                delUser.mute = true;
                global.db.setUserInfo(delUser.userName, delUser);
            }
            _broadcastCallerIdToRoom(conferenceName);
            if (delUser) {
                if (_talkingUsers.delete(delUser.userName)) {
                    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: delUser.userName, talking: false });
                }
                delUser.fsMemberId = null;
                delUser.connectionState = 'hangup';
                delUser.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(delUser.userName, delUser);
                logUser(delUser.userName, 'CONF', 'LEAVE -> hangup');
            }
            getMemberIdMap().delete(`${conferenceName}:${memberId}`);
            global.db.logEvent('conference_leave', callerIdName, room, 'Left conference');
            break;
        }
        case 'mute-member': {
            const muteUser = findUserByMember(conferenceName, memberId) || findUserByUuid(event.getHeader('Unique-ID'));
            if (muteUser) {
                muteUser.mute = true;
                global.db.setUserInfo(muteUser.userName, muteUser);
                if (_talkingUsers.delete(muteUser.userName)) {
                    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: muteUser.userName, talking: false });
                }
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: muteUser.userName });
                logUser(muteUser.userName, 'CONF', `MUTE (member ${memberId})`);
            }
            global.db.logEvent('mute', muteUser?.userName || null, room, 'Member muted');
            _broadcastCallerIdToRoom(conferenceName);
            break;
        }
        case 'unmute-member': {
            const unmuteUser = findUserByMember(conferenceName, memberId);
            if (unmuteUser) {
                unmuteUser.mute = false;
                global.db.setUserInfo(unmuteUser.userName, unmuteUser);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: unmuteUser.userName });
                logUser(unmuteUser.userName, 'CONF', `UNMUTE (member ${memberId})`);
            }
            global.db.logEvent('unmute', unmuteUser?.userName || null, room, 'Member unmuted');
            _broadcastCallerIdToRoom(conferenceName);
            break;
        }
        case 'start-talking': {
            const talkUser = findUserByMember(conferenceName, memberId) || findUserByUuid(event.getHeader('Unique-ID'));
            if (talkUser && !talkUser.mute) {
                _talkingUsers.add(talkUser.userName);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: talkUser.userName, talking: true });
            }
            break;
        }
        case 'stop-talking': {
            const stopUser = findUserByMember(conferenceName, memberId) || findUserByUuid(event.getHeader('Unique-ID'));
            if (stopUser) {
                _talkingUsers.delete(stopUser.userName);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: stopUser.userName, talking: false });

            }
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

export function findUserByUuid(uuid) {
    if (!uuid) return null;
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    return users.length > 0 ? users[0] : null;
}

export function findUserByMember(conferenceName, memberId) {
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

const lastUnmutedCount = new Map();

function _broadcastCallerIdToRoom(conferenceName) {
    const room = parseInt(conferenceName);
    if (!room) return;
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && (u.currentRoom || u.room) === room && !u.payment
    );

    const unmutedUsers = connectedUsers.filter(u => !u.mute);
    const callerIdString = unmutedUsers.map(u => {
        const email = u.userName?.replace('sip:', '');
        const account = email ? global.db.getAccountByEmail(email) : null;
        if (account) return `${account.company_name || ''} / ${account.display_name || email}`;
        return u.callerIdName || u.userName;
    }).join(', ');

    const yealinkUsers = connectedUsers.filter(u => u.clientType === 'yealink');
    const yealinkUserNames = yealinkUsers.map(u => u.userName).filter(Boolean);

    const prevCount = lastUnmutedCount.get(conferenceName) || 0;

    if (unmutedUsers.length > 0) {
        lastUnmutedCount.set(conferenceName, unmutedUsers.length);
        if (yealinkUserNames.length > 0) showMessage(yealinkUserNames, callerIdString);
        logUser(roomName, 'CONF', `CALLERID ${callerIdString} (${unmutedUsers.length} unmuted, ${connectedUsers.length} connected, prev=${prevCount})`);
    } else if (prevCount > 0) {
        lastUnmutedCount.set(conferenceName, 0);
        if (yealinkUserNames.length > 0) showMessage(yealinkUserNames, '-', 1);
        logUser(roomName, 'CONF', `CALLERID (cleared) (0 unmuted, ${connectedUsers.length} connected, prev=${prevCount})`);
    } else {
        logUser(roomName, 'CONF', `CALLERID (skip) (0 unmuted, ${connectedUsers.length} connected, prev=${prevCount})`);
    }
    setImmediate(() => {
        global.db.eventEmitter.emit('STATE_CHANGE', {
            type: 'state_change',
            scope: 'callerid',
            room,
            callerIdString: unmutedUsers.length > 0 ? callerIdString : '',
            unmutedCount: unmutedUsers.length,
            ts: Date.now(),
        });
    });
}
