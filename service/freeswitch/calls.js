import { getConnection, getConnectionHandlers, getMemberIdMap, onCustomEvent, onAnswerEvent, onHangupEvent } from './connection.js';

// --- Event handlers ---

onAnswerEvent(_handleChannelAnswer);
onHangupEvent(_handleChannelHangup);
onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'conference::maintenance') _handleConferenceEvent(event);
});

function _handleChannelAnswer(event) {
    const uuid = event.getHeader('Unique-ID');
    const callerIdName = event.getHeader('Caller-Caller-ID-Name');
    const callerUser = event.getHeader('Caller-Caller-ID-Number') || event.getHeader('variable_sip_from_user') || '';
    console.log(`[CALL] ANSWER ${callerIdName || callerUser} uuid=${uuid.slice(0, 8)}`);

    const connectionHandlers = getConnectionHandlers();
    if (callerUser && !connectionHandlers.has(uuid)) {
        const email = callerUser.includes('.at.') ? callerUser.replace('.at.', '@') : callerUser;
        const userName = `sip:${email}`;
        const userInfo = global.db.getUserInfo(userName);

        if (Object.keys(userInfo).length > 0) {
            userInfo.fsChannelUUID = uuid;
            userInfo.connectionState = 'connected';
            userInfo.authState = 'login';
            userInfo.login_expire = Math.floor(Date.now() / 1000) + global.config.loginExpireTime;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            global.db.setUserInfo(userName, userInfo);
            console.log(`[CALL] TRACK ${userName} uuid=${uuid.slice(0, 8)}`);

            connectionHandlers.set(uuid, (_hangupUuid, cause) => {
                _onCallHangup(userName, _hangupUuid, cause);
            });
        }
    }
}

function _handleChannelHangup(event) {
    const uuid = event.getHeader('Unique-ID');
    const cause = event.getHeader('Hangup-Cause');
    console.log(`[CALL] HANGUP uuid=${uuid.slice(0, 8)} cause=${cause}`);

    const connectionHandlers = getConnectionHandlers();
    if (connectionHandlers.has(uuid)) {
        const handler = connectionHandlers.get(uuid);
        connectionHandlers.delete(uuid);
        handler(uuid, cause);
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
        case 'add-member':
            console.log(`[CONF] JOIN ${callerIdName} -> ${roomName} (member ${memberId})`);
            _updateMemberMapping(conferenceName, memberId, callerIdName, event);
            global.db.logEvent('conference_join', callerIdName, room, 'Joined conference');
            break;
        case 'del-member':
            console.log(`[CONF] LEAVE ${callerIdName} <- ${roomName} (member ${memberId})`);
            global.db.logEvent('conference_leave', callerIdName, room, 'Left conference');
            break;
        case 'mute-member':
            global.db.logEvent('mute', null, room, 'Member muted');
            break;
        case 'unmute-member':
            global.db.logEvent('unmute', null, room, 'Member unmuted');
            _broadcastCallerIdToRoom(conferenceName);
            break;
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

// --- Call control ---

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
        console.log(`[CALL] RECONNECT ${userName}\n`);
        const service = global.callService;
        if (service) service.thirdPartyCallControl(userName);
    }
}

export function originateToConference(userName) {
    return new Promise((resolve, reject) => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) {
            reject(new Error(`User ${userName} not found`));
            return;
        }

        const roomName = global.config.ROOM_NAME[userInfo.room] || 'Unknown';
        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;

        const sipUser = userInfo.userName.replace('sip:', '');
        const sipUserEncoded = sipUser.includes('@') ? sipUser.replace('@', '.at.') : sipUser;
        const contactLookup = `sofia_contact ${profile}/${sipUserEncoded}@${global.config.FREESWITCH_PUBLIC_IP}`;

        const conn = getConnection();
        conn.api(contactLookup, (contactResponse) => {
            const contact = contactResponse.getBody().trim();

            if (!contact || contact.startsWith('-ERR') || contact === 'error/user_not_registered') {
                reject(new Error(`User ${userName} not registered on FreeSWITCH`));
                return;
            }

            const originateCmd = `originate {origination_caller_id_name='REDLINE-${roomName}',origination_caller_id_number='REDLINE',sip_h_Supported='timer',sip_h_Session-Expires='120;refresher=uas'}${contact} &conference(${userInfo.room}@${confProfile}++flags{mute})`;

            console.log(`[CALL] ORIGINATE ${userName} -> ${roomName}`);

            conn.api(originateCmd, (response) => {
                const body = response.getBody().trim();

                if (body.startsWith('+OK')) {
                    const uuid = body.replace('+OK ', '').trim();
                    console.log(`[CALL] OK ${userName} uuid=${uuid.slice(0, 8)}`);

                    userInfo.fsChannelUUID = uuid;
                    userInfo.connectionState = 'connected';
                    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    delete userInfo.error;
                    delete userInfo.retryCount;
                    global.db.setUserInfo(userName, userInfo);

                    getConnectionHandlers().set(uuid, (_hangupUuid, cause) => {
                        _onCallHangup(userName, _hangupUuid, cause);
                    });

                    resolve(userInfo);
                } else {
                    console.error(`[CALL] FAILED ${userName}: ${body}`);
                    reject(new Error(body));
                }
            });
        });
    });
}

export function hangupCall(uuid) {
    return new Promise((resolve) => {
        if (!uuid) {
            resolve();
            return;
        }
        getConnection().api(`uuid_kill ${uuid}`, (response) => {
            console.log(`[CALL] KILL uuid=${uuid.slice(0, 8)}`);
            resolve();
        });
    });
}

export function muteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;

    getConnection().api(`conference ${userInfo.room} mute ${userInfo.fsMemberId}`, (response) => {
        console.log(`[CONF] MUTE ${mac} member=${userInfo.fsMemberId}`);
    });
}

export function unmuteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;

    getConnection().api(`conference ${userInfo.room} unmute ${userInfo.fsMemberId}`, (response) => {
        console.log(`[CONF] UNMUTE ${mac} member=${userInfo.fsMemberId}`);
    });
}

export function honkRoom(room) {
    const audioFile = global.config.HONK_AUDIO_FILE;
    getConnection().api(`conference ${room} play ${audioFile}`, (response) => {
        console.log(`[CONF] HONK ${global.config.ROOM_NAME[room] || room}`);
    });
}

export function showMessage(contacts, message, timeout = 5) {
    if (!Array.isArray(contacts)) contacts = [contacts];
    for (const contact of contacts) {
        if (!contact) continue;
        console.log(`showMessage to ${contact}: ${message}`);
    }
}

export function getConferenceList() {
    return new Promise((resolve) => {
        getConnection().api('conference list', (response) => {
            resolve(response.getBody().trim());
        });
    });
}
