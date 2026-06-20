// Direct (1:1) private calling via DTMF in conference.
// Flow: User A dials *102 → whisper to B → B presses 1 to accept → bridge A↔B → hangup → both return to conference.

import fs from 'fs';
import path from 'path';
import { logSystem } from '../logger.js';
import { getConnection, getConnectionHandlers, onCustomEvent, onDtmfEvent, onHangupEvent } from './connection.js';
import { playTone, showMessage, showMessageWithSoftKeys, speak, stopTone } from './notifications.js';

// Conference DTMF events (from <control action="event"> in conference.conf.xml)
onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;
    const action = event.getHeader('Action');
    if (action !== 'dtmf' && action !== 'dtmf-member') return;
    const uuid = event.getHeader('Unique-ID');
    const digit = event.getHeader('DTMF-Key') || event.getHeader('DTMF-Digit');
    if (uuid && digit) handleDTMF(uuid, digit);
});

// Direct ESL DTMF events (fallback for non-conference channels)
onDtmfEvent((event) => {
    const uuid = event.getHeader('Unique-ID');
    const digit = event.getHeader('DTMF-Digit');
    if (uuid && digit) handleDTMF(uuid, digit);
});

onHangupEvent((event) => {
    const uuid = event.getHeader('Unique-ID');
    if (uuid) handleHangup(uuid);
});

const ACCEPT_TIMEOUT_MS = 15000;
const RING_TONE = 'tone_stream://%(300,180,440,480);%(300,1800,440,480);loops=6';
const BUSY_TONE = 'tone_stream://%(500,500,480,620);loops=3';
const ACCEPT_TONE = 'tone_stream://%(200,0,600);%(200,0,800)';
const DECLINE_TONE = 'tone_stream://%(400,0,480,620);loops=2';
const WHISPER_TONE = 'tone_stream://%(200,100,600);%(200,100,800);%(200,100,1000);loops=3';

// Active sessions: userName -> session data (both caller and callee point to same session)
const activeSessions = new Map();
// DTMF digit buffers: channelUuid -> { digits, timer } (stays UUID — DTMF is per-channel)
const dtmfBuffers = new Map();
// Pending accepts: callee userName -> { callId, timer, ... }
const pendingAccepts = new Map();
const returnMutedUntil = new Map();
const recentHookEvents = new Map();

function _clientEvent(userName, event) {
    global.db?.eventEmitter?.emit('CLIENT_USER_EVENT', {
        userName,
        event: { ...event, ts: Date.now() },
    });
}

function _directCallPayload(type, callId, role, peerInfo, extra = {}) {
    return {
        type,
        callId,
        role,
        peer: {
            displayName: peerInfo.displayName,
            extension: peerInfo.extension,
            company: peerInfo.account?.company_name || '',
            room: peerInfo.room,
            roomName: peerInfo.roomName,
        },
        ...extra,
    };
}

function _publicApiBase() {
    return (process.env.HOTLINE_API_BASE_URL || process.env.PUBLIC_API_BASE_URL || 'https://hotline.redlineusedautoparts.com/fs').replace(/\/$/, '');
}

function _yealinkDeclineUrl() {
    return `${_publicApiBase()}/api/v1/yealink/direct-call/decline?mac=$mac`;
}

function _markReturnMuted(userName, reason) {
    const until = Date.now() + 10000;
    returnMutedUntil.set(userName, until);

    const userInfo = global.db.getUserInfo(userName);
    if (!userInfo || Object.keys(userInfo).length === 0) return;

    const activeRoom = userInfo.currentRoom || userInfo.room;
    userInfo.mute = true;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });

    if (userInfo.fsMemberId && activeRoom && global.freeswitch?.muteByMemberId) {
        logSystem('MUTE_TRACE', `directCall return-muted -> ${userName} room=${activeRoom} member=${userInfo.fsMemberId} reason=${reason}`);
        global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userName);
    }

    logSystem('DIRECT', `RETURN MUTED ${userName} (${reason})`);
}

export function shouldKeepDirectCallMuted(userName) {
    const until = returnMutedUntil.get(userName);
    if (!until) return false;
    if (Date.now() > until) {
        returnMutedUntil.delete(userName);
        return false;
    }
    return true;
}

export function noteDirectCallHookEvent(userName, event) {
    if (!userName || !activeSessions.has(userName)) return;
    recentHookEvents.set(userName, { event, at: Date.now() });
}

export function hangupDirectCallByUserName(userName, reason = 'user_on_hook') {
    const session = activeSessions.get(userName);
    if (!session) return false;

    const uuid = userName === session.callerUserName ? session.callerUuid : session.calleeUuid;
    if (!uuid) return false;

    noteDirectCallHookEvent(userName, 'on_hook');
    logSystem('DIRECT', `HANGUP requested by ${userName} (${reason})`);
    _fsApi(`uuid_kill ${uuid}`).catch(err => {
        logSystem('DIRECT', `HANGUP request failed for ${userName}: ${err.message}`);
    });
    return true;
}

function _resolveEndAttribution(session, hangupUuid) {
    const now = Date.now();
    const candidates = [
        { role: 'caller', userName: session.callerUserName, uuid: session.callerUuid },
        { role: 'callee', userName: session.calleeUserName, uuid: session.calleeUuid },
    ];

    let latest = null;
    for (const candidate of candidates) {
        const hook = recentHookEvents.get(candidate.userName);
        if (!hook || now - hook.at > 5000) continue;
        if (!latest || hook.at > latest.hook.at) latest = { ...candidate, hook };
    }

    if (latest) {
        return {
            role: latest.role,
            reason: `${latest.role}_hangup`,
            source: `phone_${latest.hook.event}`,
        };
    }

    const role = hangupUuid === session.callerUuid ? 'caller' : 'callee';
    return {
        role,
        reason: `${role}_hangup`,
        source: 'bridge_uuid',
    };
}

function _recoverConferenceUser(userName, reason) {
    _markReturnMuted(userName, reason);
    setTimeout(() => {
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0 || !userInfo.online) return;

        if (userInfo.connectionState === 'connected' && userInfo.fsMemberId) {
            _markReturnMuted(userName, reason);
            return;
        }

        userInfo.mute = true;
        userInfo.connectionState = 'hangup';
        userInfo.fsChannelUUID = null;
        userInfo.fsMemberId = null;
        userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
        global.db.setUserInfo(userName, userInfo);
        logSystem('DIRECT', `RECOVER ${userName} -> conference (${reason})`);

        import('./callGate.js').then(({ initiateCall }) => {
            initiateCall(userName).catch(() => { });
        }).catch(() => { });
    }, 500);
}

function _setDirectCallState(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (!userInfo || Object.keys(userInfo).length === 0) return;

    userInfo.connectionState = 'direct_call';
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);
}

function _clearDirectCallState(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (!userInfo || Object.keys(userInfo).length === 0) return;

    userInfo.mute = true;
    userInfo.connectionState = 'hangup';
    userInfo.fsChannelUUID = null;
    userInfo.fsMemberId = null;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);
}

function _fsApi(command) {
    return new Promise((resolve, reject) => {
        const conn = getConnection();
        if (!conn) return reject(new Error('ESL not connected'));
        conn.api(command, (res) => {
            resolve(res?.getBody?.() || res?.body || '');
        });
    });
}

function _lineCheck(uuid) {
    const caller = _getConferenceInfo(uuid);
    if (!caller) return;

    const room = caller.room;
    const onlineCount = global.db.filter(u =>
        u.connectionState === 'connected' && (u.currentRoom || u.room) === room
    ).length;

    const roomName = caller.roomName;
    logSystem('DIRECT', `LINE CHECK by ${caller.displayName} in ${roomName} — ${onlineCount} online`);
    speak(`Line Check. Online user in ${roomName} is ${onlineCount}.`, { targets: [caller.userName] });
}

function _getConferenceInfo(uuid) {
    const users = global.db.getAllUserInfo();
    for (const u of users) {
        if (u.fsChannelUUID === uuid) {
            const email = u.userName.replace(/^sip:/, '');
            const account = global.db.getAccountByEmail(email);
            const room = u.currentRoom || u.room;
            return {
                userName: u.userName,
                email,
                account,
                displayName: u.callerIdName || email,
                room,
                roomName: global.config.ROOM_NAME?.[room] || String(room),
                memberId: u.fsMemberId,
                extension: account?.extension,
                uuid,
            };
        }
    }
    return null;
}

function _findUserByExtension(ext) {
    const account = global.db.getAccountByExtension(ext);
    if (!account) return null;
    const email = account.email;
    const users = global.db.getAllUserInfo();
    const user = users.find(u => {
        const uEmail = u.userName.replace(/^sip:/, '');
        return uEmail === email && u.connectionState === 'connected';
    });
    if (!user) return null;
    return {
        userName: user.userName,
        email,
        account,
        displayName: user.callerIdName || email,
        room: user.currentRoom || user.room,
        roomName: global.config.ROOM_NAME?.[user.currentRoom || user.room] || String(user.currentRoom || user.room),
        uuid: user.fsChannelUUID,
        memberId: user.fsMemberId,
        extension: account.extension,
    };
}

// Called by phoneEvents.js when callee lifts handset or web client unmutes
export function acceptByUserName(userName) {
    const pending = pendingAccepts.get(userName);
    if (pending) {
        _acceptCall(userName);
        return true;
    }
    return false;
}

export function hasPendingCall(userName) {
    return pendingAccepts.has(userName);
}

export function isPendingCaller(userName) {
    for (const pending of pendingAccepts.values()) {
        if (pending.callerUserName === userName) return true;
    }
    return false;
}

// Called by ESL DTMF event handler
export function handleDTMF(uuid, digit) {
    let buf = dtmfBuffers.get(uuid);

    if (digit === '*') {
        // Start collecting extension digits
        buf = { digits: '', timer: null };
        dtmfBuffers.set(uuid, buf);
        return;
    }

    if (!buf) return;

    if (digit >= '0' && digit <= '9') {
        buf.digits += digit;
        if (buf.timer) clearTimeout(buf.timer);
        // Auto-trigger *99 (line check) at 2 digits
        if (buf.digits === '99') {
            if (buf.timer) clearTimeout(buf.timer);
            dtmfBuffers.delete(uuid);
            _lineCheck(uuid);
            return;
        }

        // Wait for more digits (up to 2s between digits)
        buf.timer = setTimeout(() => {
            const ext = parseInt(buf.digits);
            dtmfBuffers.delete(uuid);
            if (ext > 0) initiateDirectCall(uuid, ext);
        }, 2000);

        // Auto-trigger at 3 digits (extensions are 3 digits: 101-999)
        if (buf.digits.length >= 3) {
            if (buf.timer) clearTimeout(buf.timer);
            const ext = parseInt(buf.digits);
            dtmfBuffers.delete(uuid);
            if (ext > 0) initiateDirectCall(uuid, ext);
        }
    } else {
        // Non-digit after * — cancel
        if (buf.timer) clearTimeout(buf.timer);
        dtmfBuffers.delete(uuid);
    }
}

export async function initiateDirectCall(callerUuid, calleeExtension) {
    const caller = _getConferenceInfo(callerUuid);
    if (!caller) {
        logSystem('DIRECT', `Caller UUID ${callerUuid} not found in DB`);
        return;
    }

    const callee = _findUserByExtension(calleeExtension);
    if (!callee) {
        logSystem('DIRECT', `Extension *${calleeExtension} not found or not in call`);
        playTone([caller.userName], DECLINE_TONE);
        showMessage([caller.userName], `Extension *${calleeExtension}\nNot available`, 3);
        _clientEvent(caller.userName, {
            type: 'direct_call_unavailable',
            role: 'caller',
            extension: calleeExtension,
            message: `Extension *${calleeExtension} is not available`,
        });
        return;
    }

    if (callee.userName === caller.userName) {
        logSystem('DIRECT', `${caller.displayName} tried to call themselves (*${calleeExtension})`);
        return;
    }

    // Check if either party is already in a direct call (by userName)
    if (activeSessions.has(caller.userName) || activeSessions.has(callee.userName)) {
        logSystem('DIRECT', `${caller.displayName} or ${callee.displayName} already in a direct call`);
        playTone([caller.userName], BUSY_TONE);
        showMessage([caller.userName], `${callee.displayName}\nBusy - in direct call`, 5);
        _clientEvent(caller.userName, _directCallPayload('direct_call_busy', null, 'caller', callee, {
            message: `${callee.displayName} is busy`,
        }));
        return;
    }

    // Check if callee is already unmuted (busy talking)
    const calleeUser = global.db.getUserInfo(callee.userName);
    if (calleeUser && !calleeUser.mute) {
        logSystem('DIRECT', `${callee.displayName} is busy (unmuted) — rejecting call from ${caller.displayName}`);
        playTone([caller.userName], BUSY_TONE);
        showMessage([caller.userName], `${callee.displayName}\nBusy`, 5);
        _clientEvent(caller.userName, _directCallPayload('direct_call_busy', null, 'caller', callee, {
            message: `${callee.displayName} is busy`,
        }));
        return;
    }

    logSystem('DIRECT', `┌─ CALL ── *${calleeExtension} ──────────────────────────────`);
    logSystem('DIRECT', `│  ${caller.displayName} (ext ${caller.extension || '?'}) → ${callee.displayName} (ext ${calleeExtension})`);
    logSystem('DIRECT', `│  caller room: ${caller.roomName} │ callee room: ${callee.roomName}`);

    // Log to DB
    const callId = global.db.logDirectCall({
        callerEmail: caller.email,
        callerExtension: caller.extension,
        callerDisplayName: caller.displayName,
        callerCompany: caller.account?.company_name || '',
        callerRoom: caller.room,
        callerRoomName: caller.roomName,
        calleeEmail: callee.email,
        calleeExtension: callee.extension,
        calleeDisplayName: callee.displayName,
        calleeCompany: callee.account?.company_name || '',
        calleeRoom: callee.room,
        calleeRoomName: callee.roomName,
        status: 'ringing',
    });

    // Play continuous ring tone to caller, whisper tone to callee
    playTone([caller.userName], RING_TONE);
    playTone([callee.userName], WHISPER_TONE);

    // Delay screen notifications so they arrive after any broadcast side-effects settle
    setTimeout(() => {
        showMessage(
            [caller.userName],
            `Calling :\n${callee.displayName}\nWaiting for answer...`,
            15
        );
        showMessageWithSoftKeys(
            [callee.userName],
            `Private call :\n${caller.displayName}\nLift handset to accept`,
            [{ name: 'Reject', url: _yealinkDeclineUrl(), position: 1 }],
            15
        );
    }, 1500);

    // Set up pending accept for callee (keyed by userName)
    const acceptTimer = setTimeout(() => {
        _timeoutCall(callee.userName, callId, caller, callee);
    }, ACCEPT_TIMEOUT_MS);

    pendingAccepts.set(callee.userName, {
        callId,
        callerUserName: caller.userName,
        callerUuid,
        callerInfo: caller,
        calleeInfo: callee,
        timer: acceptTimer,
    });

    _clientEvent(caller.userName, _directCallPayload('direct_call_outgoing', callId, 'caller', callee, {
        timeoutMs: ACCEPT_TIMEOUT_MS,
    }));
    _clientEvent(callee.userName, _directCallPayload('direct_call_incoming', callId, 'callee', caller, {
        timeoutMs: ACCEPT_TIMEOUT_MS,
    }));

    logSystem('DIRECT', `│  waiting for ${callee.displayName} to accept (${ACCEPT_TIMEOUT_MS / 1000}s timeout)`);
    logSystem('DIRECT', `└───────────────────────────────────────────────────────`);
}

async function _acceptCall(calleeUserName) {
    const pending = pendingAccepts.get(calleeUserName);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingAccepts.delete(calleeUserName);

    const { callId, callerInfo, calleeInfo } = pending;
    const now = Math.floor(Date.now() / 1000);

    // Re-read current UUIDs from DB (they may have changed since the call was initiated)
    const callerUser = global.db.getUserInfo(callerInfo.userName);
    const calleeUser = global.db.getUserInfo(calleeInfo.userName);
    const callerUuid = callerUser?.fsChannelUUID;
    const calleeUuid = calleeUser?.fsChannelUUID;

    if (!callerUuid || !calleeUuid) {
        logSystem('DIRECT', `ACCEPT FAILED — missing UUID: caller=${callerUuid || 'none'} callee=${calleeUuid || 'none'}`);
        global.db.updateDirectCall(callId, { status: 'failed', ended_at: now, end_reason: 'missing_uuid' });
        stopTone([callerInfo.userName, calleeInfo.userName]);
        playTone([callerInfo.userName], DECLINE_TONE);
        return;
    }

    logSystem('DIRECT', `┌─ ACCEPTED ── ${calleeInfo.displayName} ──────────────────`);

    global.db.updateDirectCall(callId, { status: 'answered', answered_at: now });
    _clientEvent(callerInfo.userName, _directCallPayload('direct_call_answered', callId, 'caller', calleeInfo));
    _clientEvent(calleeInfo.userName, _directCallPayload('direct_call_answered', callId, 'callee', callerInfo));

    try {
        const recordingDir = path.join(global.config.RECORDING_DIR, 'direct');
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const callerShort = callerInfo.email.split('@')[0];
        const calleeShort = calleeInfo.email.split('@')[0];
        const recordingPath = path.join(recordingDir, `${callerShort}_to_${calleeShort}_${timestamp}.wav`);

        const session = {
            callId,
            callerUserName: callerInfo.userName,
            calleeUserName: calleeInfo.userName,
            callerUuid,
            calleeUuid,
            callerInfo,
            calleeInfo,
            answeredAt: Date.now(),
            recordingPath,
        };
        activeSessions.set(callerInfo.userName, session);
        activeSessions.set(calleeInfo.userName, session);
        _setDirectCallState(callerInfo.userName);
        _setDirectCallState(calleeInfo.userName);

        // Remove connection handlers so conference kick doesn't trigger auto-reconnect
        const connectionHandlers = getConnectionHandlers();
        connectionHandlers.delete(callerUuid);
        connectionHandlers.delete(calleeUuid);

        // Stop ring/whisper tones, then replace waiting screens with a short connected notification
        stopTone([callerInfo.userName, calleeInfo.userName]);
        showMessage([callerInfo.userName], `Extension call connected\n${calleeInfo.displayName}`, 1);
        showMessage([calleeInfo.userName], `Extension call connected\n${callerInfo.displayName}`, 1);
        playTone([callerInfo.userName, calleeInfo.userName], ACCEPT_TONE);
        await new Promise(r => setTimeout(r, 450));

        // Transfer both out of conference into park (keeps channels alive)
        await _fsApi(`uuid_transfer ${callerUuid} park inline`);
        await _fsApi(`uuid_transfer ${calleeUuid} park inline`);

        // Small delay for channels to settle
        await new Promise(r => setTimeout(r, 500));

        // Bridge the two parked channels
        await _fsApi(`uuid_bridge ${callerUuid} ${calleeUuid}`);

        // Start recording
        await _fsApi(`uuid_record ${callerUuid} start ${recordingPath}`).catch(() => { });

        logSystem('DIRECT', `│  bridged: ${callerInfo.displayName} ↔ ${calleeInfo.displayName}`);
        logSystem('DIRECT', `│  recording: ${recordingPath.split('/').pop()}`);
        logSystem('DIRECT', `└───────────────────────────────────────────────────────`);

        global.db.updateDirectCall(callId, { recording_path: recordingPath });
    } catch (err) {
        logSystem('DIRECT', `│  BRIDGE FAILED: ${err.message}`);
        logSystem('DIRECT', `└───────────────────────────────────────────────────────`);
        global.db.updateDirectCall(callId, { status: 'failed', ended_at: now, end_reason: 'bridge_failed' });
        _cleanupSession(callerInfo.userName);
        _clearDirectCallState(callerInfo.userName);
        _clearDirectCallState(calleeInfo.userName);
        _recoverConferenceUser(callerInfo.userName, 'bridge_failed');
        _recoverConferenceUser(calleeInfo.userName, 'bridge_failed');
    }
}

export function declineByUserName(calleeUserName, reason = 'declined') {
    const pending = pendingAccepts.get(calleeUserName);
    if (!pending) {
        for (const [pendingCalleeUserName, callerPending] of pendingAccepts) {
            if (callerPending.callerUserName !== calleeUserName) continue;

            clearTimeout(callerPending.timer);
            pendingAccepts.delete(pendingCalleeUserName);

            const { callId, callerInfo, calleeInfo } = callerPending;
            const now = Math.floor(Date.now() / 1000);

            logSystem('DIRECT', `${callerInfo.displayName} CANCELLED call to ${calleeInfo.displayName} (${reason})`);

            global.db.updateDirectCall(callId, { status: 'cancelled', ended_at: now, end_reason: reason });
            stopTone([callerInfo.userName, calleeInfo.userName]);
            showMessage([calleeInfo.userName], `${callerInfo.displayName}\nCancelled private call`, 3);
            _recoverConferenceUser(calleeInfo.userName, reason);
            _clientEvent(callerInfo.userName, _directCallPayload('direct_call_cancelled', callId, 'caller', calleeInfo));
            _clientEvent(calleeInfo.userName, _directCallPayload('direct_call_cancelled', callId, 'callee', callerInfo));
            return true;
        }
        return false;
    }

    clearTimeout(pending.timer);
    pendingAccepts.delete(calleeUserName);

    const { callId, callerInfo, calleeInfo } = pending;
    const now = Math.floor(Date.now() / 1000);

    logSystem('DIRECT', `${calleeInfo.displayName} DECLINED call from ${callerInfo.displayName} (${reason})`);

    global.db.updateDirectCall(callId, { status: 'declined', ended_at: now, end_reason: reason });

    // Stop ring/whisper tones, play decline tone to caller
    stopTone([callerInfo.userName, calleeInfo.userName]);
    playTone([callerInfo.userName], DECLINE_TONE);
    showMessage([callerInfo.userName], `${calleeInfo.displayName}\nDeclined`, 3);
    showMessage([calleeInfo.userName], `Private call\nDeclined`, 2);
    _recoverConferenceUser(calleeInfo.userName, reason);
    _clientEvent(callerInfo.userName, _directCallPayload('direct_call_declined', callId, 'caller', calleeInfo));
    _clientEvent(calleeInfo.userName, _directCallPayload('direct_call_declined', callId, 'callee', callerInfo));
    return true;
}

function _timeoutCall(calleeUserName, callId, callerInfo, calleeInfo) {
    pendingAccepts.delete(calleeUserName);

    logSystem('DIRECT', `${calleeInfo.displayName} did not answer call from ${callerInfo.displayName} (timeout)`);

    const now = Math.floor(Date.now() / 1000);
    global.db.updateDirectCall(callId, { status: 'no_answer', ended_at: now, end_reason: 'timeout' });

    // Stop ring/whisper tones, play decline tone to caller
    stopTone([callerInfo.userName, calleeInfo.userName]);
    playTone([callerInfo.userName], DECLINE_TONE);
    showMessage([callerInfo.userName], `${calleeInfo.displayName}\nNo answer`, 3);
    showMessage([calleeInfo.userName], `Private call\nMissed`, 2);
    _recoverConferenceUser(calleeInfo.userName, 'timeout');
    _clientEvent(callerInfo.userName, _directCallPayload('direct_call_missed', callId, 'caller', calleeInfo));
    _clientEvent(calleeInfo.userName, _directCallPayload('direct_call_missed', callId, 'callee', callerInfo));
}

function _cleanupSession(userName) {
    const session = activeSessions.get(userName);
    if (!session) return;
    activeSessions.delete(session.callerUserName);
    activeSessions.delete(session.calleeUserName);
}

// Called when a channel hangs up — clean up direct call session
export function handleHangup(uuid) {
    // Clean DTMF buffer
    const buf = dtmfBuffers.get(uuid);
    if (buf?.timer) clearTimeout(buf.timer);
    dtmfBuffers.delete(uuid);

    // Clean pending accept — find by caller UUID
    for (const [calleeUserName, pending] of pendingAccepts) {
        if (pending.callerUuid === uuid) {
            clearTimeout(pending.timer);
            pendingAccepts.delete(calleeUserName);
            const now = Math.floor(Date.now() / 1000);
            global.db.updateDirectCall(pending.callId, { status: 'cancelled', ended_at: now, end_reason: 'caller_hangup' });
            stopTone([pending.callerInfo.userName, pending.calleeInfo.userName]);
            showMessage([pending.calleeInfo.userName], `${pending.callerInfo.displayName}\nCancelled private call`, 3);
            _recoverConferenceUser(pending.calleeInfo.userName, 'caller_cancelled_pending_call');
            _clientEvent(pending.callerInfo.userName, _directCallPayload('direct_call_cancelled', pending.callId, 'caller', pending.calleeInfo));
            _clientEvent(pending.calleeInfo.userName, _directCallPayload('direct_call_cancelled', pending.callId, 'callee', pending.callerInfo));
            return;
        }
    }

    // Clean pending accept — callee hung up before accepting
    const userName = _uuidToUserName(uuid);
    if (userName && pendingAccepts.has(userName)) {
        const pending = pendingAccepts.get(userName);
        clearTimeout(pending.timer);
        pendingAccepts.delete(userName);
        const now = Math.floor(Date.now() / 1000);
        global.db.updateDirectCall(pending.callId, { status: 'cancelled', ended_at: now, end_reason: 'callee_hangup' });
        stopTone([pending.callerInfo.userName, pending.calleeInfo.userName]);
        showMessage([pending.callerInfo.userName], `${pending.calleeInfo.displayName}\nCancelled private call`, 3);
        _recoverConferenceUser(pending.calleeInfo.userName, 'callee_cancelled_pending_call');
        _clientEvent(pending.callerInfo.userName, _directCallPayload('direct_call_cancelled', pending.callId, 'caller', pending.calleeInfo));
        _clientEvent(pending.calleeInfo.userName, _directCallPayload('direct_call_cancelled', pending.callId, 'callee', pending.callerInfo));
        return;
    }

    // Clean active session — find by UUID stored in session
    for (const [key, session] of activeSessions) {
        if (session.callerUuid === uuid || session.calleeUuid === uuid) {
            const now = Math.floor(Date.now() / 1000);
            const durationMs = Date.now() - session.answeredAt;
            const endedBy = _resolveEndAttribution(session, uuid);

            activeSessions.delete(session.callerUserName);
            activeSessions.delete(session.calleeUserName);
            recentHookEvents.delete(session.callerUserName);
            recentHookEvents.delete(session.calleeUserName);

            // Stop recording
            if (session.recordingPath) {
                _fsApi(`uuid_record ${session.callerUuid} stop ${session.recordingPath}`).catch(() => { });
            }

            global.db.updateDirectCall(session.callId, {
                status: 'completed',
                ended_at: now,
                duration_ms: durationMs,
                end_reason: endedBy.reason,
            });
            _clearDirectCallState(session.callerInfo.userName);
            _clearDirectCallState(session.calleeInfo.userName);

            logSystem('DIRECT', `┌─ ENDED ── ${Math.round(durationMs / 1000)}s ────────────────────────────`);
            logSystem('DIRECT', `│  ${session.callerInfo.displayName} ↔ ${session.calleeInfo.displayName}`);
            logSystem('DIRECT', `│  ended by: ${endedBy.role} (${endedBy.source})`);
            if (session.recordingPath) logSystem('DIRECT', `│  recording: ${session.recordingPath.split('/').pop()}`);
            logSystem('DIRECT', `└───────────────────────────────────────────────────────`);
            _clientEvent(session.callerInfo.userName, _directCallPayload('direct_call_ended', session.callId, 'caller', session.calleeInfo, {
                durationMs,
            }));
            _clientEvent(session.calleeInfo.userName, _directCallPayload('direct_call_ended', session.callId, 'callee', session.callerInfo, {
                durationMs,
            }));
            _markReturnMuted(session.callerInfo.userName, 'direct_call_ended');
            _markReturnMuted(session.calleeInfo.userName, 'direct_call_ended');

            // Reconnect both parties to conference
            import('./callGate.js').then(({ initiateCall }) => {
                initiateCall(session.callerInfo.userName).catch(() => { });
                initiateCall(session.calleeInfo.userName).catch(() => { });
            }).catch(() => { });

            // Auto-transcribe if enabled for either party's room
            if (session.recordingPath) {
                import('../transcription.js').then(({ shouldAutoTranscribe, transcribeDirectCall }) => {
                    if (shouldAutoTranscribe(session.callerInfo.room) || shouldAutoTranscribe(session.calleeInfo.room)) {
                        transcribeDirectCall(session.callId).catch(err =>
                            logSystem('DIRECT', `Auto-transcribe failed for call #${session.callId}: ${err.message}`)
                        );
                    }
                }).catch(() => { });
            }
            return;
        }
    }
}

function _uuidToUserName(uuid) {
    const users = global.db.filter(u => u.fsChannelUUID === uuid);
    return users.length > 0 ? users[0].userName : null;
}

export function isInDirectCall(uuidOrUserName) {
    // Check by userName first
    if (activeSessions.has(uuidOrUserName) || pendingAccepts.has(uuidOrUserName)) return true;
    // Check pending caller userName
    for (const pending of pendingAccepts.values()) {
        if (pending.callerUserName === uuidOrUserName) return true;
    }
    // Fallback: check by UUID in active sessions
    for (const session of activeSessions.values()) {
        if (session.callerUuid === uuidOrUserName || session.calleeUuid === uuidOrUserName) return true;
    }
    return false;
}

export function getActiveCalls() {
    const seen = new Set();
    const calls = [];
    for (const [userName, session] of activeSessions) {
        if (seen.has(session.callId)) continue;
        seen.add(session.callId);
        calls.push({
            callId: session.callId,
            caller: session.callerInfo.displayName,
            callee: session.calleeInfo.displayName,
            duration: Date.now() - session.answeredAt,
        });
    }
    return calls;
}
