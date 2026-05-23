import esl from 'modesl';
import fs from 'fs';
import path from 'path';

const freeswitch = {};

let eslConnection = null;
let reconnectTimer = null;

const connectionHandlers = new Map();
const memberIdMap = new Map();

// Broadcast detection state
const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;
const activeTalkers = new Map();       // `room:memberId` → { startTime, userName, displayName, room }
const pendingBroadcasts = new Map();   // `room` → { timer, userName, displayName, startTime, durationMs }

async function connect() {
    return new Promise((resolve, reject) => {
        const { FREESWITCH_ESL_HOST, FREESWITCH_ESL_PORT, FREESWITCH_ESL_PASSWORD } = global.config;

        eslConnection = new esl.Connection(
            FREESWITCH_ESL_HOST,
            FREESWITCH_ESL_PORT,
            FREESWITCH_ESL_PASSWORD,
            () => {
                console.log('ESL connected to FreeSWITCH');

                eslConnection.subscribe('CHANNEL_ANSWER CHANNEL_HANGUP_COMPLETE');
                eslConnection.subscribe('CUSTOM sofia::register sofia::unregister sofia::expire conference::maintenance');

                eslConnection.on('esl::event::CUSTOM::*', _handleCustomEvent);
                eslConnection.on('esl::event::CHANNEL_ANSWER::*', _handleChannelAnswer);
                eslConnection.on('esl::event::CHANNEL_HANGUP_COMPLETE::*', _handleChannelHangup);

                console.log('ESL event subscriptions registered');

                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }

                resolve();
            }
        );

        eslConnection.on('error', (err) => {
            console.error('ESL connection error:', err.message);
            _scheduleReconnect();
            reject(err);
        });

        eslConnection.on('esl::end', () => {
            console.log('ESL connection closed');
            _scheduleReconnect();
        });
    });
}

function _scheduleReconnect() {
    if (reconnectTimer) return;
    console.log('ESL reconnecting in 2 seconds...');
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            await connect();
        } catch (err) {
            console.error('ESL reconnect failed:', err.message);
        }
    }, 2000);
}

function _handleCustomEvent(event) {
    const subclass = event.getHeader('Event-Subclass');

    if (subclass === 'sofia::register') {
        _handleRegistration(event);
    } else if (subclass === 'sofia::expire') {
        _handleExpire(event);
    } else if (subclass === 'conference::maintenance') {
        _handleConferenceEvent(event);
    }
}

async function _handleRegistration(event) {
    const fromUser = event.getHeader('from-user');
    const fromHost = event.getHeader('from-host');
    const contact = event.getHeader('contact');
    const networkIp = event.getHeader('network-ip');
    const networkPort = event.getHeader('network-port');
    const userAgent = event.getHeader('user-agent') || '';

    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    // Decode .at. encoding from browser clients, or reconstruct email from from-host
    let email = fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);

    const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
    const macMatch = userAgent.match(macRegex);
    const mac = macMatch ? macMatch[0].toLowerCase() : null;

    if (!mac) {
        console.log(`Registration without MAC (non-Yealink): ${email} (${userAgent})`);
    }

    const userName = `sip:${email}`;
    console.log(`Registration: ${userName} | MAC: ${mac} | IP: ${networkIp}:${networkPort}`);

    const existingUser = global.db.getUserInfo(userName);

    if (Object.keys(existingUser).length > 0) {
        existingUser.contact = contact;
        existingUser.ip = networkIp;
        existingUser.port = parseInt(networkPort);
        existingUser.online = true;
        existingUser.userAgent = userAgent;
        global.db.setUserInfo(userName, existingUser);
        global.db.logEvent('registration', userName, null, 'User registered');
        global.db.logOnlineStatus(userName, 'online');

        ensureInConference(userName);
        return;
    }

    const account = global.db.getAccountByEmail(email);
    if (!account || !account.active) {
        console.log(`Registration rejected: no active account for ${email}`);
        return;
    }

    const room = account.room || 123456701;
    const userInfo = {
        userId: account.id,
        contact: contact,
        mac: mac,
        ip: networkIp,
        port: parseInt(networkPort),
        room: room,
        connectionState: 'ideal',
        authState: 'logout',
        mute: true,
        online: true,
        payment: false,
        userAgent: userAgent,
        callerIdName: `${account.company_name || ''} / ${account.display_name || email}`,
    };

    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('registration', userName, null, 'User registered');
    global.db.logOnlineStatus(userName, 'online');
    console.log(`New user registered: ${userName} -> room ${global.config.ROOM_NAME[room]}`);
}

async function _handleExpire(event) {
    const fromUser = event.getHeader('from-user');
    const fromHost = event.getHeader('from-host');
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    const email = isIp ? fromUser : `${fromUser}@${fromHost}`;
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    console.log(`Registration expired: ${userName}`);
    userInfo.online = false;
    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('offline', userName, null, 'Registration expired');
    global.db.logOnlineStatus(userName, 'offline');
}

function _handleChannelAnswer(event) {
    const uuid = event.getHeader('Unique-ID');
    const callerIdName = event.getHeader('Caller-Caller-ID-Name');
    const callerUser = event.getHeader('Caller-Caller-ID-Number') || event.getHeader('variable_sip_from_user') || '';
    const callerUsername = event.getHeader('Caller-Username') || '';
    const sipFromUser = event.getHeader('variable_sip_from_user') || '';
    console.log(`Channel answered: ${uuid} | name=${callerIdName} | number=${callerUser} | username=${callerUsername} | sip_from=${sipFromUser}`);

    // Track inbound calls (browser/phone initiated) so we can auto-reconnect on hangup
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
            console.log(`Tracking inbound call for ${userName} UUID=${uuid}`);

            connectionHandlers.set(uuid, (_hangupUuid, cause) => {
                _onCallHangup(userName, _hangupUuid, cause);
            });
        }
    }
}

function _handleChannelHangup(event) {
    const uuid = event.getHeader('Unique-ID');
    const cause = event.getHeader('Hangup-Cause');
    console.log(`Channel hangup: ${uuid} (${cause})`);

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

    switch (action) {
        case 'add-member':
            console.log(`Conference ${conferenceName}: ${callerIdName} joined (member ${memberId})`);
            _updateMemberMapping(conferenceName, memberId, callerIdName, event);
            global.db.logEvent('conference_join', callerIdName, room, 'Joined conference');
            break;
        case 'del-member':
            console.log(`Conference ${conferenceName}: ${callerIdName} left (member ${memberId})`);
            global.db.logEvent('conference_leave', callerIdName, room, 'Left conference');
            break;
        case 'mute-member':
            console.log(`Conference ${conferenceName}: member ${memberId} muted`);
            global.db.logEvent('mute', null, room, 'Member muted');
            break;
        case 'unmute-member':
            console.log(`Conference ${conferenceName}: member ${memberId} unmuted`);
            global.db.logEvent('unmute', null, room, 'Member unmuted');
            _broadcastCallerIdToRoom(conferenceName);
            break;
        case 'start-talking':
            _handleStartTalking(conferenceName, memberId, room, event);
            break;
        case 'stop-talking':
            _handleStopTalking(conferenceName, memberId, room);
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

    memberIdMap.set(`${conferenceName}:${memberId}`, { uuid, callerIdName });
}

function _broadcastCallerIdToRoom(conferenceName) {
    const room = parseInt(conferenceName);
    if (!room) return;

    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && u.room === room && !u.payment
    );

    console.log(`Caller ID update for room ${conferenceName}: ${connectedUsers.length} users to notify`);
}

function _handleStartTalking(conferenceName, memberId, room, event) {
    const key = `${conferenceName}:${memberId}`;
    const memberInfo = memberIdMap.get(key);
    const uuid = event.getHeader('Unique-ID') || memberInfo?.uuid;
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || memberInfo?.callerIdName || 'Unknown';

    let userName = null;
    let displayName = callerIdName;
    if (uuid) {
        const users = global.db.filter(u => u.fsChannelUUID === uuid);
        if (users.length > 0) {
            userName = users[0].userName;
            displayName = users[0].callerIdName || callerIdName;
        }
    }

    activeTalkers.set(key, {
        startTime: Date.now(),
        userName: userName || callerIdName,
        displayName,
        room,
        uuid,
    });

    if (pendingBroadcasts.has(conferenceName)) {
        const pending = pendingBroadcasts.get(conferenceName);
        clearTimeout(pending.timer);
        pendingBroadcasts.delete(conferenceName);

        const respondedBy = userName || callerIdName;
        console.log(`[Broadcast] Room ${conferenceName}: ${respondedBy} responded to ${pending.displayName}'s broadcast`);
        _finalizeBroadcast(conferenceName, room, pending, true, respondedBy);
    }

    if (uuid) {
        const recordingDir = global.config.RECORDING_DIR;
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const roomName = global.config.ROOM_NAME[room] || conferenceName;
        const recordingFile = path.join(recordingDir, `${roomName}_${timestamp}_${memberId}.wav`);

        eslConnection.api(`uuid_record ${uuid} start ${recordingFile}`, (response) => {
            const body = response.getBody().trim();
            console.log(`[Broadcast] Recording started for member ${memberId} in room ${conferenceName}: ${body}`);
        });

        const talker = activeTalkers.get(key);
        if (talker) talker.recordingPath = recordingFile;
    }
}

function _handleStopTalking(conferenceName, memberId, room) {
    const key = `${conferenceName}:${memberId}`;
    const talker = activeTalkers.get(key);
    if (!talker) return;

    const durationMs = Date.now() - talker.startTime;
    activeTalkers.delete(key);

    if (talker.uuid && talker.recordingPath) {
        eslConnection.api(`uuid_record ${talker.uuid} stop ${talker.recordingPath}`, (response) => {
            console.log(`[Broadcast] Recording stopped for member ${memberId}: ${response.getBody().trim()}`);
        });

        if (durationMs < BROADCAST_MIN_DURATION_MS && talker.recordingPath) {
            try { fs.unlinkSync(talker.recordingPath); } catch {}
        }
    }

    if (durationMs < BROADCAST_MIN_DURATION_MS) {
        console.log(`[Broadcast] Member ${memberId} in room ${conferenceName} talked ${durationMs}ms (below threshold, ignoring)`);
        return;
    }

    console.log(`[Broadcast] Potential broadcast detected: ${talker.displayName} in room ${conferenceName} (${durationMs}ms)`);

    const timer = setTimeout(() => {
        pendingBroadcasts.delete(conferenceName);
        console.log(`[Broadcast] UNANSWERED broadcast in room ${conferenceName} by ${talker.displayName}`);
        _finalizeBroadcast(conferenceName, room, { ...talker, durationMs }, false, null);
    }, BROADCAST_RESPONSE_WINDOW_MS);

    pendingBroadcasts.set(conferenceName, {
        timer,
        userName: talker.userName,
        displayName: talker.displayName,
        startTime: talker.startTime,
        durationMs,
        recordingPath: talker.recordingPath,
    });
}

function _finalizeBroadcast(conferenceName, room, broadcastData, answered, respondedBy) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const participants = global.db.filter(u => u.connectionState === 'connected' && u.room === room);
    const participantList = participants.map(u => ({
        userName: u.userName,
        displayName: u.callerIdName,
        mute: u.mute,
    }));

    global.db.logBroadcast({
        room,
        roomName,
        userName: broadcastData.userName,
        displayName: broadcastData.displayName,
        durationMs: broadcastData.durationMs,
        answered,
        respondedBy,
        participants: participantList,
        participantCount: participantList.length,
        recordingPath: broadcastData.recordingPath || null,
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        broadcastData.userName,
        room,
        `${broadcastData.displayName} broadcast ${broadcastData.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );
}

function originateToConference(userName) {
    return new Promise((resolve, reject) => {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) {
            reject(new Error(`User ${userName} not found`));
            return;
        }

        const roomName = global.config.ROOM_NAME[userInfo.room] || 'Unknown';
        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;

        // Resolve registered contact via sofia_contact API
        const sipUser = userInfo.userName.replace('sip:', '');
        const sipUserEncoded = sipUser.includes('@') ? sipUser.replace('@', '.at.') : sipUser;
        const contactLookup = `sofia_contact ${profile}/${sipUserEncoded}@${global.config.FREESWITCH_PUBLIC_IP}`;

        eslConnection.api(contactLookup, (contactResponse) => {
            const contact = contactResponse.getBody().trim();

            if (!contact || contact.startsWith('-ERR') || contact === 'error/user_not_registered') {
                reject(new Error(`User ${userName} not registered on FreeSWITCH`));
                return;
            }

            console.log(`Resolved contact for ${userName}: ${contact}`);

            const originateCmd = `originate {origination_caller_id_name='REDLINE-${roomName}',origination_caller_id_number='REDLINE',sip_h_Supported='timer',sip_h_Session-Expires='120;refresher=uas'}${contact} &conference(${userInfo.room}@${confProfile}++flags{mute})`;

            console.log(`Originating call: ${userName} -> ${roomName}`);

            eslConnection.api(originateCmd, (response) => {
            const body = response.getBody().trim();

            if (body.startsWith('+OK')) {
                const uuid = body.replace('+OK ', '').trim();
                console.log(`Call originated: ${userName} UUID=${uuid}`);

                userInfo.fsChannelUUID = uuid;
                userInfo.connectionState = 'connected';
                userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                delete userInfo.error;
                delete userInfo.retryCount;
                global.db.setUserInfo(userName, userInfo);

                connectionHandlers.set(uuid, (_hangupUuid, cause) => {
                    _onCallHangup(userName, _hangupUuid, cause);
                });

                resolve(userInfo);
            } else {
                console.error(`Originate failed for ${userName}: ${body}`);
                reject(new Error(body));
            }
        });
        });
    });
}

function _onCallHangup(userName, _uuid, cause) {
    console.log(`Call hangup for ${userName}: ${cause}`);

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    userInfo.mute = true;
    userInfo.connectionState = 'hangup';
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    delete userInfo.error;
    global.db.setUserInfo(userName, userInfo);

    if (userInfo.authState === 'login') {
        console.log(`Auto-reconnecting ${userName}...`);
        const service = global.callService;
        if (service) service.thirdPartyCallControl(userName);
    }
}

function hangupCall(uuid) {
    return new Promise((resolve) => {
        if (!uuid) {
            resolve();
            return;
        }
        eslConnection.api(`uuid_kill ${uuid}`, (response) => {
            console.log(`Hangup ${uuid}: ${response.getBody().trim()}`);
            resolve();
        });
    });
}

function muteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;

    eslConnection.api(`conference ${userInfo.room} mute ${userInfo.fsMemberId}`, (response) => {
        console.log(`Mute ${mac} (member ${userInfo.fsMemberId}): ${response.getBody().trim()}`);
    });
}

function unmuteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;

    eslConnection.api(`conference ${userInfo.room} unmute ${userInfo.fsMemberId}`, (response) => {
        console.log(`Unmute ${mac} (member ${userInfo.fsMemberId}): ${response.getBody().trim()}`);
    });
}

function honkRoom(room) {
    const audioFile = global.config.HONK_AUDIO_FILE;
    eslConnection.api(`conference ${room} play ${audioFile}`, (response) => {
        console.log(`Honk room ${room}: ${response.getBody().trim()}`);
    });
}

function showMessage(contacts, message, timeout = 5) {
    if (!Array.isArray(contacts)) contacts = [contacts];

    for (const contact of contacts) {
        if (!contact) continue;
        // TODO: Implement SIP NOTIFY via FreeSWITCH sofia or mod_lua
        console.log(`showMessage to ${contact}: ${message}`);
    }
}

function getConferenceList() {
    return new Promise((resolve) => {
        eslConnection.api('conference list', (response) => {
            resolve(response.getBody().trim());
        });
    });
}

function ensureInConference(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;
    if (userInfo.authState !== 'login') return;
    if (!userInfo.online) return;
    if (userInfo.connectionState === 'connected' || userInfo.connectionState === 'connecting') return;

    console.log(`[KeepAlive] ${userName} is ${userInfo.connectionState} but should be in call — reconnecting`);
    const service = global.callService;
    if (service) service.thirdPartyCallControl(userName);
}

freeswitch.connect = connect;
freeswitch.originateToConference = originateToConference;
freeswitch.hangupCall = hangupCall;
freeswitch.muteUser = muteUser;
freeswitch.unmuteUser = unmuteUser;
freeswitch.honkRoom = honkRoom;
freeswitch.showMessage = showMessage;
freeswitch.getConferenceList = getConferenceList;
freeswitch.ensureInConference = ensureInConference;

export default { freeswitch };
