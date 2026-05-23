import esl from 'modesl';

const freeswitch = {};

let eslConnection = null;
let reconnectTimer = null;

const connectionHandlers = new Map();
const memberIdMap = new Map();

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

    // New user — validate against API
    try {
        const response = await (await fetch(`${global.config.USER_VALIDATION_API}?email=${email}`)).json();

        if (!response.status) {
            console.log(`User validation failed for ${email}`);
            return;
        }

        const userData = response.data;
        const room = parseInt(userData.rooms?.[0]?.code) || 123456701;

        const userInfo = {
            userId: userData.id,
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
            callerIdName: `${userData.company_name} / ${userData.representative_name}`,
            callerIdHtml: userData.caller_id_html,
            redlineData: userData,
        };

        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('registration', userName, null, 'User registered');
        global.db.logOnlineStatus(userName, 'online');
        console.log(`New user registered: ${userName} -> room ${global.config.ROOM_NAME[room]}`);
    } catch (err) {
        console.error(`User validation error for ${email}: ${err.message}`);
    }
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
        case 'stop-talking':
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
    const audioFile = '/root/sorbh/freeswitch_conference/public/redlinehonk.wav';
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
