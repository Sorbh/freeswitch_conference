// Handles sofia::register, sofia::unregister, sofia::expire events from FreeSWITCH.
// Updates user table with registration state, online status, and client type.
// On unregister/expire: marks user offline, ends active calls, prevents reconnect loops.
import { onCustomEvent } from './connection.js';
import { clearOnlineTimer } from './onlineSync.js';
import { initiateCall } from './callGate.js';

const registrationFailures = new Map();

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'sofia::register') _handleRegistration(event);
    else if (subclass === 'sofia::expire') _handleExpire(event);
    else if (subclass === 'sofia::unregister') _handleUnregister(event);
});

function _parseEmailFromEvent(event) {
    const fromUser = event.getHeader('from-user');
    if (!fromUser) return null;
    const fromHost = event.getHeader('from-host');
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    return fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);
}

async function _handleRegistration(event) {
    const fromUser = event.getHeader('from-user');
    const fromHost = event.getHeader('from-host');
    const contact = event.getHeader('contact');
    const networkIp = event.getHeader('network-ip');
    const networkPort = event.getHeader('network-port');
    const userAgent = event.getHeader('user-agent') || '';

    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    let email = fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);

    const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
    const macMatch = userAgent.match(macRegex)
        || (contact || '').match(macRegex)
        || (event.getHeader('sip_contact_params') || '').match(macRegex);
    const mac = macMatch ? macMatch[0].toLowerCase() : null;
    const clientType = _detectClientType(userAgent);

    if (!_isAllowedUserAgent(userAgent)) {
        console.log(`[REG] BLOCKED ${fromUser}@${fromHost} — unknown UA: ${userAgent || 'empty'} | IP: ${networkIp}`);
        return;
    }

    const userName = `sip:${email}`;
    console.log('');
    console.log(`[REG] ${email} | ${clientType} | MAC: ${mac || 'none'} | IP: ${networkIp}:${networkPort} | UA: ${userAgent.split(' ')[0] || 'unknown'}`);

    const account = global.db.getAccountByEmail(email);
    if (!account || !account.active) {
        _trackFailure(userName);
        console.log(`[REG] REJECTED ${email} — no active account`);
        return;
    }

    _clearFailure(userName);

    const existingUser = global.db.getUserInfo(userName);

    if (Object.keys(existingUser).length > 0) {
        existingUser.contact = contact;
        existingUser.ip = networkIp;
        existingUser.port = parseInt(networkPort);
        existingUser.online = true;
        existingUser.userAgent = userAgent;
        existingUser.clientType = clientType;
        existingUser.registrationState = 'registered';
        if (mac) existingUser.mac = mac;
        existingUser.authState = 'login';
        global.db.setUserInfo(userName, existingUser);
        global.db.touchLastSeen(userName);
        global.db.logEvent('registration', userName, null, 'User registered');
        global.db.logOnlineStatus(userName, 'online');

        if (global.alerting) global.alerting.stopCriticalAlert(userName);

        ensureInConference(userName);
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
        authState: 'login',
        mute: true,
        online: true,
        payment: false,
        userAgent: userAgent,
        clientType: clientType,
        registrationState: 'registered',
        callerIdName: `${account.company_name || ''} / ${account.display_name || email}`,
    };

    global.db.setUserInfo(userName, userInfo);
    global.db.touchLastSeen(userName);
    global.db.logEvent('registration', userName, null, 'User registered');
    global.db.logOnlineStatus(userName, 'online');
    console.log(`[REG] NEW ${email} -> ${global.config.ROOM_NAME[room] || room}`);

    ensureInConference(userName);
}

async function _handleUnregister(event) {
    const email = _parseEmailFromEvent(event);
    if (!email) return;
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    console.log(`[REG] UNREGISTER ${email}`);

    // Mark offline BEFORE ending call — prevents _onCallHangup from retrying
    const wasConnected = userInfo.connectionState === global.ConnectionState.CONNECTED ||
        userInfo.connectionState === global.ConnectionState.CONNECTING;
    const savedUuid = userInfo.fsChannelUUID;

    userInfo.online = false;
    userInfo.registrationState = 'unregistered';
    userInfo.connectionState = wasConnected ? 'hangup' : userInfo.connectionState;
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('unregister', userName, userInfo.room, 'Explicit unregistration');
    global.db.logOnlineStatus(userName, 'offline');
    clearOnlineTimer(userName);

    // Now end the call on FreeSWITCH — BYE sent, but no reconnect attempt
    if (wasConnected && savedUuid) {
        try {
            await global.freeswitch.hangupCall(savedUuid, userName);
        } catch (e) {
            console.error(`[REG] Failed to hangup ${userName}: ${e.message}`);
        }
    }
}

async function _handleExpire(event) {
    const email = _parseEmailFromEvent(event);
    if (!email) return;
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    console.log(`[REG] EXPIRED ${email}`);

    // Mark offline BEFORE ending call — prevents _onCallHangup from retrying
    const wasConnected = userInfo.connectionState === global.ConnectionState.CONNECTED ||
        userInfo.connectionState === global.ConnectionState.CONNECTING;
    const savedUuid = userInfo.fsChannelUUID;

    userInfo.online = false;
    userInfo.registrationState = 'expired';
    userInfo.connectionState = wasConnected ? 'hangup' : userInfo.connectionState;
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('expired', userName, userInfo.room, 'Registration expired');
    global.db.logOnlineStatus(userName, 'offline');
    clearOnlineTimer(userName);

    // Now end the call on FreeSWITCH
    if (wasConnected && savedUuid) {
        console.log(`[REG] EXPIRED ${email} — ending active call`);
        try {
            await global.freeswitch.hangupCall(savedUuid, userName);
        } catch (e) {
            console.error(`[REG] Failed to hangup ${userName}: ${e.message}`);
        }
    }
}

const ALLOWED_UA_PATTERNS = [
    'yealink',
    'redline-webclient',
];

function _isAllowedUserAgent(userAgent) {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return ALLOWED_UA_PATTERNS.some(pattern => ua.includes(pattern));
}

function _detectClientType(userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('yealink')) return 'yealink';
    if (ua.includes('redline-webclient')) return 'web';
    if (ua.includes('obi') || ua.includes('obihai')) return 'obihai';
    if (ua.includes('polycom')) return 'polycom';
    if (ua.includes('grandstream')) return 'grandstream';
    if (ua.includes('cisco')) return 'cisco';
    if (ua.includes('linphone')) return 'linphone';
    return 'unknown';
}

function _trackFailure(userName) {
    const count = (registrationFailures.get(userName) || 0) + 1;
    registrationFailures.set(userName, count);

    if (count >= 5) {
        console.log(`[REG] ${userName} — ${count} consecutive failures`);
        registrationFailures.delete(userName);
    }
}

function _clearFailure(userName) {
    if (registrationFailures.has(userName)) {
        registrationFailures.delete(userName);
    }
}

export function ensureInConference(userName) {
    initiateCall(userName);
}
