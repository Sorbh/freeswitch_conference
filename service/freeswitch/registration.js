// Handles sofia::register, sofia::unregister, sofia::expire events from FreeSWITCH.
// Updates user table with registration state, online status, and client type.
// On unregister/expire: marks user offline, ends active calls, prevents reconnect loops.
import { onCustomEvent, getConnectionHandlers } from './connection.js';
import { clearOnlineTimer } from './onlineSync.js';
import { initiateCall, MAX_RETRIES, probeDeviceContact } from './callGate.js';
import { logUser, logBlocked } from '../logger.js';
import { sendClientEventToUser } from '../../modules/client/events.js';

const registrationFailures = new Map();

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'sofia::register') _handleRegistration(event);
    else if (subclass === 'sofia::expire') _handleExpire(event);
    else if (subclass === 'sofia::unregister') _handleUnregister(event);
});

// Which device does this event belong to? Same UA classifier as registration.
// Exception: socket-disconnection unregisters (web page closed/reloaded) carry
// NO user-agent header at all (FS sofia.c MY_EVENT_UNREGISTER socket path) —
// for those, fall back to the AOR form: web registers as user.at.domain.
function _deviceTypeFromEvent(event) {
    const uaType = _detectClientType(event.getHeader('user-agent') || '');
    if (uaType === 'web' || uaType === 'yealink') return uaType;
    const aor = event.getHeader('from-user') || event.getHeader('user') || '';
    return aor.includes('.at.') ? 'web' : 'yealink';
}

// True when the departing registration belongs to a device that is NOT the one
// holding the connected conference leg. Only trust clientType values written by
// callGate at originate time (web/yealink).
function _isNonHolderDeparture(existingUser, departedType) {
    // 'connecting' counts too: the web's own unregister (its reaction to the
    // monitor_mode push) lands while the reclaim INVITE is still in flight —
    // tearing down then would re-INVITE the same device into USER_BUSY.
    return (existingUser.connectionState === 'connected' || existingUser.connectionState === 'connecting')
        && (existingUser.clientType === 'web' || existingUser.clientType === 'yealink')
        && departedType !== existingUser.clientType;
}

// unregister events carry from-user/from-host; expire events carry user/host
// (no from-* headers at all — sofia_reg.c emits them with different names).
function _parseEmailFromEvent(event) {
    const fromUser = event.getHeader('from-user') || event.getHeader('user');
    if (!fromUser) return null;
    const fromHost = event.getHeader('from-host') || event.getHeader('host') || '';
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

    const email = _parseEmailFromEvent(event);
    if (!email) return;

    const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
    const macMatch = userAgent.match(macRegex)
        || (contact || '').match(macRegex)
        || (event.getHeader('sip_contact_params') || '').match(macRegex);
    const mac = macMatch ? macMatch[0].toLowerCase() : null;
    const clientType = _detectClientType(userAgent);

    if (!_isAllowedUserAgent(userAgent)) {
        logBlocked('UA', `"${userAgent || 'empty'}" user=${fromUser}@${fromHost} ip=${networkIp}`);
        return;
    }

    const userName = `sip:${email}`;
    const regInfo = global.db.getUserInfo(userName);
    const regRoom = regInfo.currentRoom || regInfo.room;
    const regRoomName = regRoom ? (global.config.ROOM_NAME[regRoom] || regRoom) : 'no room';
    logUser(userName, 'REG', `${clientType} │ MAC: ${mac || 'none'} │ IP: ${networkIp}:${networkPort} │ ${regRoomName}`);

    const account = global.db.getAccountByEmail(email);
    if (!account || !account.active) {
        _trackFailure(userName);
        logUser(userName, 'REG', `REJECTED — no active account`);
        return;
    }

    _clearFailure(userName);

    const existingUser = global.db.getUserInfo(userName);

    if (Object.keys(existingUser).length > 0) {
        const wasOffline = !existingUser.online;

        // Web re-takeover: web_takeover is ON and the Yealink currently holds the
        // conference leg — the returning web client wins. Hard switch: kill the
        // Yealink leg here, then fall through to the normal update path whose
        // ensureInConference re-originates (resolveTargetContact picks web first).
        if (existingUser.webTakeover
            && clientType === 'web'
            && existingUser.connectionState === 'connected'
            && existingUser.clientType === 'yealink') {
            logUser(userName, 'REG', `web re-takeover — hanging up Yealink leg for web priority`);
            const yealinkUuid = existingUser.fsChannelUUID;
            existingUser.connectionState = 'ideal';
            existingUser.fsChannelUUID = null;
            existingUser.fsMemberId = null;
            existingUser.mute = true;
            // Intentional kill: drop the hangup handler so the old leg's
            // CHANNEL_HANGUP can't stomp the new leg's state (directCall.js pattern)
            if (yealinkUuid) getConnectionHandlers().delete(yealinkUuid);
            if (yealinkUuid && global.freeswitch?.hangupCall) {
                global.freeswitch.hangupCall(yealinkUuid, userName).catch(e => {
                    logUser(userName, 'REG', `Failed to hangup Yealink channel: ${e.message}`);
                });
            }
            global.db.logEvent('web_retakeover', userName, existingUser.currentRoom || existingUser.room, 'Web client returned — call moved from Yealink to web');
        }

        // Yealink reclaim: web_takeover is OFF and the web client holds the
        // conference leg (it was the fallback while the Yealink was offline).
        // The Yealink registering means the priority device is back — hard
        // switch: kill the web leg, tell the web client to enter monitor mode,
        // then fall through so ensureInConference re-originates
        // (resolveTargetContact picks Yealink first with the flag off).
        if (!existingUser.webTakeover
            && clientType === 'yealink'
            && existingUser.connectionState === 'connected'
            && existingUser.clientType === 'web') {
            logUser(userName, 'REG', `Yealink reclaim — web was fallback, hanging up web leg for Yealink priority`);
            const webUuid = existingUser.fsChannelUUID;
            existingUser.connectionState = 'ideal';
            existingUser.fsChannelUUID = null;
            existingUser.fsMemberId = null;
            existingUser.mute = true;
            if (webUuid) getConnectionHandlers().delete(webUuid);
            if (webUuid && global.freeswitch?.hangupCall) {
                global.freeswitch.hangupCall(webUuid, userName).catch(e => {
                    logUser(userName, 'REG', `Failed to hangup web channel: ${e.message}`);
                });
            }
            global.db.logEvent('yealink_reclaim', userName, existingUser.currentRoom || existingUser.room, 'Yealink back online — call moved from web to Yealink');
            sendClientEventToUser(userName, { type: 'monitor_mode', reason: 'yealink_reclaim' });
        }

        // Non-priority device registering while the OTHER device holds the leg
        // (flag ON + Yealink registers, or flag OFF + web registers): liveness
        // refresh only — it must not overwrite the leg holder's contact/clientType
        // (that would route hook-driven mute to the wrong leg) or trigger
        // ensureInConference. The priority device's registration is handled by
        // the two hard-switch guards above.
        if (existingUser.connectionState === 'connected'
            && existingUser.clientType
            && clientType !== existingUser.clientType) {
            // existingUser.online = true;
            // existingUser.registrationState = 'registered';
            // if (mac) existingUser.mac = mac;
            // existingUser.authState = 'login';
            // global.db.setUserInfo(userName, existingUser);
            // global.db.touchLastSeen(userName);
            // if (wasOffline) global.db.logOnlineStatus(userName, 'online');
            // if (global.alerting) global.alerting.stopCriticalAlert(userName);
            // if (wasOffline) global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });
            logUser(userName, 'REG', `${clientType} registered — ${existingUser.clientType} holds the call, liveness only`);
            return;
        }

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
        if (wasOffline) global.db.logOnlineStatus(userName, 'online');

        if (global.alerting) global.alerting.stopCriticalAlert(userName);

        if (existingUser.connectionState === 'error'
            && (existingUser.error || '').includes('RECOVERY_ON_TIMER_EXPIRE')
            && (existingUser.retryCount || 0) >= MAX_RETRIES) {
            logUser(userName, 'REG', 'RECOVERY — clearing RECOVERY_ON_TIMER_EXPIRE error');
            existingUser.connectionState = 'ideal';
            existingUser.error = null;
            existingUser.retryCount = 0;
            global.db.setUserInfo(userName, existingUser);
        }

        if (wasOffline) {
            global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });
        }
        ensureInConference(userName);
        return;
    }

    if (!account.room) {
        logUser(userName, 'REG', 'REJECTED — no room configured');
        return;
    }
    const room = account.room;
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
    global.db.logEvent('new_user', userName, room, 'First registration');
    global.db.logOnlineStatus(userName, 'online');
    logUser(userName, 'REG', `NEW -> ${global.config.ROOM_NAME[room] || room}`);

    global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });
    ensureInConference(userName);
}

async function _handleUnregister(event) {
    const email = _parseEmailFromEvent(event);
    if (!email) return;
    const userName = `sip:${email}`;

    const existingUser = global.db.getUserInfo(userName);
    if (Object.keys(existingUser).length === 0) return;

    // Same classifier as registration — unregister and expire both carry the
    // user-agent (expire emits the register-time UA from the FS reg table).
    const departedType = _deviceTypeFromEvent(event);

    // A device that doesn't hold the connected leg going away must not tear
    // down the active call (web page refresh while the Yealink talks, dormant
    // Yealink rebooting while web holds the call).
    if (_isNonHolderDeparture(existingUser, departedType)) {
        logUser(userName, 'REG', `UNREGISTER from ${departedType} — ${existingUser.clientType} connected, ignoring`);
        return;
    }

    logUser(userName, 'REG', 'UNREGISTER');

    // Mark offline BEFORE ending call — prevents _onCallHangup from retrying
    const wasConnected = existingUser.connectionState === global.ConnectionState.CONNECTED ||
        existingUser.connectionState === global.ConnectionState.CONNECTING;
    const savedUuid = existingUser.fsChannelUUID;

    existingUser.online = false;
    existingUser.mute = true;
    existingUser.registrationState = 'unregistered';
    existingUser.connectionState = 'ideal';
    existingUser.error = null;
    existingUser.retryCount = 0;
    existingUser.errFallbackStage = 0;
    existingUser.errFallbackAt = null;
    existingUser.fsChannelUUID = null;
    existingUser.fsMemberId = null;
    existingUser.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, existingUser);
    global.db.logEvent('unregister', userName, existingUser.room, 'Explicit unregistration');
    global.db.logOnlineStatus(userName, 'offline');
    clearOnlineTimer(userName);
    global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });

    // Now end the call on FreeSWITCH — BYE sent, but no reconnect attempt
    if (wasConnected && savedUuid) {
        try {
            await global.freeswitch.hangupCall(savedUuid, userName);
        } catch (e) {
            console.error(`[REG] Failed to hangup ${userName}: ${e.message}`);
        }
    }

    _fallbackToOtherDevice(userName, 'unregister', departedType);
}

// Device-priority fallback: the departing registration may not be the only
// device this account has. Probe FreeSWITCH for a surviving contact (in
// web_takeover priority order) and reconnect through it — e.g. web tab closed
// while takeover is on → Yealink takes the call; Yealink expired while flag is
// off → web takes the call.
async function _fallbackToOtherDevice(userName, trigger, departedType) {
    try {
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length === 0) return;

        // Never probe the device that just departed: its expire event fires
        // BEFORE FS purges the registration row, so sofia_contact can still
        // return a ghost contact for a few ms — and we'd "fall back" to the
        // very device that just left.
        const order = (userInfo.webTakeover ? ['web', 'yealink'] : ['yealink', 'web'])
            .filter(t => t !== departedType);
        let target = null;
        for (const deviceType of order) {
            const contact = await probeDeviceContact(userName, deviceType);
            if (contact) { target = { contact, deviceType }; break; }
        }
        if (!target) {
            // No surviving registration at all. A web tab in monitor mode is
            // invisible here (monitor mode unregisters the UA) but still holds
            // its SSE connection — wake it so it registers and becomes the
            // fallback; the register-time gate then originates to it.
            // Only when the YEALINK departed: a monitor tab is unregistered by
            // definition, so it can never be the departing device — if the web
            // itself left (tab closed/reloaded), there is no tab to wake.
            if (departedType === 'yealink') {
                logUser(userName, 'REG', `no surviving device after ${trigger} — sending exit_monitor to web SSE`);
                sendClientEventToUser(userName, { type: 'exit_monitor', reason: trigger });
            } else {
                logUser(userName, 'REG', `no surviving device after ${trigger} (${departedType} departed)`);
            }
            return;
        }

        const fresh = global.db.getUserInfo(userName);
        fresh.online = true;
        fresh.registrationState = 'registered';
        fresh.connectionState = 'ideal';
        fresh.mute = true;
        global.db.setUserInfo(userName, fresh);
        global.db.logOnlineStatus(userName, 'online');
        global.db.logEvent('device_fallback', userName, fresh.currentRoom || fresh.room, `Registration ${trigger} — falling back to ${target.deviceType}`);
        logUser(userName, 'REG', `fallback -> ${target.deviceType} (after ${trigger})`);
        global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });
        initiateCall(userName);
    } catch (e) {
        logUser(userName, 'REG', `fallback check failed: ${e.message}`);
    }
}

async function _handleExpire(event) {
    const email = _parseEmailFromEvent(event);
    if (!email) return;
    const userName = `sip:${email}`;

    const existingUser = global.db.getUserInfo(userName);
    if (Object.keys(existingUser).length === 0) return;

    const departedType = _deviceTypeFromEvent(event);

    if (_isNonHolderDeparture(existingUser, departedType)) {
        logUser(userName, 'REG', `EXPIRED from ${departedType} — ${existingUser.clientType} connected, ignoring`);
        return;
    }

    logUser(userName, 'REG', 'EXPIRED');

    // Mark offline BEFORE ending call — prevents _onCallHangup from retrying
    const wasConnected = existingUser.connectionState === global.ConnectionState.CONNECTED ||
        existingUser.connectionState === global.ConnectionState.CONNECTING;
    const savedUuid = existingUser.fsChannelUUID;

    existingUser.online = false;
    existingUser.mute = true;
    existingUser.registrationState = 'expired';
    existingUser.connectionState = 'ideal';
    existingUser.error = null;
    existingUser.retryCount = 0;
    existingUser.errFallbackStage = 0;
    existingUser.errFallbackAt = null;
    existingUser.fsChannelUUID = null;
    existingUser.fsMemberId = null;
    existingUser.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, existingUser);
    global.db.logEvent('expired', userName, existingUser.room, 'Registration expired');
    global.db.logOnlineStatus(userName, 'offline');
    clearOnlineTimer(userName);
    global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'users', userName });

    // Now end the call on FreeSWITCH
    if (wasConnected && savedUuid) {
        console.log(`[REG] EXPIRED ${email} — ending active call`);
        try {
            await global.freeswitch.hangupCall(savedUuid, userName);
        } catch (e) {
            console.error(`[REG] Failed to hangup ${userName}: ${e.message}`);
        }
    }

    _fallbackToOtherDevice(userName, 'expire', departedType);
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
