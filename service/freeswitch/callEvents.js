// Reactive ESL event handlers. Listens to FreeSWITCH events and updates user state.
// CHANNEL_ANSWER: tracks new calls, rejects in-flight originates for kicked/inactive users.
// CHANNEL_HANGUP: cleans up call state, triggers auto-reconnect if user still online.
// conference::maintenance: tracks member join/leave/mute/unmute.
// ESL disconnect: resets all connected users. ESL reconnect: syncs with actual conference state.
import { getConnection, getConnectionHandlers, getMemberIdMap, onCustomEvent, onAnswerEvent, onHangupEvent, onEslDisconnect, onEslReconnect } from './connection.js';
import { initiateCall, canInitiateCall, unlockCalls, resumeFallbacks } from './callGate.js';
import { showMessage } from './notifications.js';
import { logUser, logSystem } from '../logger.js';

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
            logSystem('ESL', 'SYNC no active conferences');
            // Mark any users showing connected as hangup
            const allUsers = global.db.getAllUserInfo();
            for (const user of allUsers) {
                if (user.connectionState === 'connected' || user.connectionState === 'connecting') {
                    user.connectionState = 'hangup';
                    user.fsChannelUUID = null;
                    user.fsMemberId = null;
                    user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(user.userName, user);
                    logSystem('ESL', `SYNC ${user.userName} -> hangup (no conferences)`);
                }
            }
            unlockCalls();
            resumeFallbacks();
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

        logSystem('ESL', `SYNC found ${activeMembers.size} active members in conferences`);

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
                    logSystem('ESL', `SYNC ${user.userName} -> connected (UUID match)`);
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
                    logSystem('ESL', `SYNC ${user.userName} -> connected (callerIdName match)`);
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
                logSystem('ESL', `SYNC ${user.userName} -> hangup (not in conference)`);
            }
        }

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
    logUser(userName, 'CALL', 'ANSWER');

    // Check if this call should be allowed (catches in-flight originates after kickout/deactivation)
    if (userName) {
        const gate = canInitiateCall(userName);
        if (!gate.allowed && gate.reason !== 'already_in_call' && gate.reason !== 'not_found') {
            logUser(userName, 'CALL', `REJECT — ${gate.reason} (in-flight originate)`);
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
        const handler = connectionHandlers.get(uuid);
        connectionHandlers.delete(uuid);
        uuidUserMap.delete(uuid);
        handler(uuid, cause);
        return;
    }

    // Try DB lookup by UUID
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    if (users.length > 0) {
        logUser(users[0].userName, 'CALL', `HANGUP cause=${cause}`);
        uuidUserMap.delete(uuid);
        _onCallHangup(users[0].userName, uuid, cause);
        return;
    }

    uuidUserMap.delete(uuid);
    if (knownUser) logUser(knownUser, 'CALL', `HANGUP cause=${cause} (already cleaned up)`);
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
            const joinUuid2 = event.getHeader('Unique-ID');
            const joinUserName = uuidUserMap.get(joinUuid2) || null;
            logUser(joinUserName, 'CONF', `JOIN ${callerIdName} -> ${roomName} (member ${memberId})`);
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
            const muteUser = _findUserByMember(conferenceName, memberId) || _findUserByUuid(event.getHeader('Unique-ID'));
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
        case 'start-talking': {
            const talkUser = _findUserByMember(conferenceName, memberId) || _findUserByUuid(event.getHeader('Unique-ID'));
            if (talkUser) {
                _talkingUsers.add(talkUser.userName);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: talkUser.userName, talking: true });

            }
            break;
        }
        case 'stop-talking': {
            const stopUser = _findUserByMember(conferenceName, memberId) || _findUserByUuid(event.getHeader('Unique-ID'));
            if (stopUser) {
                _talkingUsers.delete(stopUser.userName);
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'talking', userName: stopUser.userName, talking: false });

            }
            break;
        }
        case 'unmute-member': {
            const unmuteUser = _findUserByMember(conferenceName, memberId);
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

function _findUserByUuid(uuid) {
    if (!uuid) return null;
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    return users.length > 0 ? users[0] : null;
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

const lastUnmutedCount = new Map();

function _broadcastCallerIdToRoom(conferenceName) {
    const room = parseInt(conferenceName);
    if (!room) return;
    const roomName = global.config.ROOM_NAME[room] || conferenceName;

    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && u.room === room && !u.payment
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

    if (unmutedUsers.length > 0) {
        lastUnmutedCount.set(conferenceName, unmutedUsers.length);
        if (yealinkUserNames.length > 0) showMessage(yealinkUserNames, callerIdString);
        logUser(roomName, 'CONF', `CALLERID ${callerIdString}`);
    } else if ((lastUnmutedCount.get(conferenceName) || 0) > 0) {
        lastUnmutedCount.set(conferenceName, 0);
        if (yealinkUserNames.length > 0) showMessage(yealinkUserNames, '-', 1);
        logUser(roomName, 'CONF', `CALLERID (cleared)`);
    }

    global.db.eventEmitter.emit('STATE_CHANGE', {
        type: 'state_change',
        scope: 'callerid',
        room,
        callerIdString: unmutedUsers.length > 0 ? callerIdString : '',
        unmutedCount: unmutedUsers.length,
    });
}
