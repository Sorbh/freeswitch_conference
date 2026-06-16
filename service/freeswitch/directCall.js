// Direct (1:1) private calling via DTMF in conference.
// Flow: User A dials *102 → whisper to B → B presses 1 to accept → bridge A↔B → hangup → both return to conference.

import fs from 'fs';
import path from 'path';
import { logSystem } from '../logger.js';
import { getConnection, getConnectionHandlers, onCustomEvent, onDtmfEvent, onHangupEvent } from './connection.js';
import { playTone, showMessage, stopTone, speak } from './notifications.js';

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
const RING_TONE = 'tone_stream://%(400,200,440,480);loops=25';
const BUSY_TONE = 'tone_stream://%(500,500,480,620);loops=3';
const ACCEPT_TONE = 'tone_stream://%(200,0,600);%(200,0,800)';
const DECLINE_TONE = 'tone_stream://%(400,0,480,620);loops=2';
const WHISPER_TONE = 'tone_stream://%(200,100,600);%(200,100,800);%(200,100,1000);loops=3';

// Active sessions: callerUuid -> session data
const activeSessions = new Map();
// DTMF digit buffers: channelUuid -> { digits, timer, memberInfo }
const dtmfBuffers = new Map();
// Pending accepts: calleeUuid -> { callId, timer }
const pendingAccepts = new Map();

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

// Called by phoneEvents.js when callee lifts handset
export function acceptByUserName(userName) {
    for (const [calleeUuid, pending] of pendingAccepts) {
        if (pending.calleeInfo.userName === userName) {
            _acceptCall(calleeUuid);
            return true;
        }
    }
    return false;
}

export function hasPendingCall(userName) {
    for (const [, pending] of pendingAccepts) {
        if (pending.calleeInfo.userName === userName) return true;
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
        return;
    }

    if (callee.uuid === callerUuid) {
        logSystem('DIRECT', `${caller.displayName} tried to call themselves (*${calleeExtension})`);
        return;
    }

    // Check if either party is already in a direct call
    if (activeSessions.has(callerUuid) || activeSessions.has(callee.uuid)) {
        logSystem('DIRECT', `${caller.displayName} or ${callee.displayName} already in a direct call`);
        playTone([caller.userName], BUSY_TONE);
        showMessage([caller.userName], `${callee.displayName}\nBusy - in direct call`, 5);
        return;
    }

    // Check if callee is already unmuted (busy talking)
    const calleeUser = global.db.getUserInfo(callee.userName);
    if (calleeUser && !calleeUser.mute) {
        logSystem('DIRECT', `${callee.displayName} is busy (unmuted) — rejecting call from ${caller.displayName}`);
        playTone([caller.userName], BUSY_TONE);
        showMessage([caller.userName], `${callee.displayName}\nBusy`, 5);
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
            `Calling *${calleeExtension}...\n${callee.displayName}\n\nWaiting for answer...`,
            15
        );
        showMessage(
            [callee.userName],
            `Private call from:\n${caller.displayName}\n\nLift handset to accept`,
            15
        );
    }, 1500);

    // Set up pending accept for callee
    const acceptTimer = setTimeout(() => {
        _timeoutCall(callee.uuid, callId, caller, callee);
    }, ACCEPT_TIMEOUT_MS);

    pendingAccepts.set(callee.uuid, {
        callId,
        callerUuid,
        callerInfo: caller,
        calleeInfo: callee,
        timer: acceptTimer,
    });

    logSystem('DIRECT', `│  waiting for ${callee.displayName} to press 1 (${ACCEPT_TIMEOUT_MS / 1000}s timeout)`);
    logSystem('DIRECT', `└───────────────────────────────────────────────────────`);
}

async function _acceptCall(calleeUuid) {
    const pending = pendingAccepts.get(calleeUuid);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingAccepts.delete(calleeUuid);

    const { callId, callerUuid, callerInfo, calleeInfo } = pending;
    const now = Math.floor(Date.now() / 1000);

    logSystem('DIRECT', `┌─ ACCEPTED ── ${calleeInfo.displayName} ──────────────────`);

    global.db.updateDirectCall(callId, { status: 'answered', answered_at: now });

    try {
        // Register session BEFORE kick so isInDirectCall() suppresses auto-reconnect
        const recordingDir = path.join(global.config.RECORDING_DIR, 'direct');
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const callerShort = callerInfo.email.split('@')[0];
        const calleeShort = calleeInfo.email.split('@')[0];
        const recordingPath = path.join(recordingDir, `${callerShort}_to_${calleeShort}_${timestamp}.wav`);

        const session = {
            callId,
            callerUuid,
            calleeUuid,
            callerInfo,
            calleeInfo,
            answeredAt: Date.now(),
            recordingPath,
            bridging: true,
        };
        activeSessions.set(callerUuid, session);
        activeSessions.set(calleeUuid, session);

        // Remove connection handlers so conference kick doesn't trigger auto-reconnect
        const connectionHandlers = getConnectionHandlers();
        connectionHandlers.delete(callerUuid);
        connectionHandlers.delete(calleeUuid);

        // Stop ring/whisper tones
        stopTone([callerInfo.userName, calleeInfo.userName]);

        // Transfer both out of conference into park (keeps channels alive)
        await _fsApi(`uuid_transfer ${callerUuid} park inline`);
        await _fsApi(`uuid_transfer ${calleeUuid} park inline`);

        // Small delay for channels to settle
        await new Promise(r => setTimeout(r, 500));

        // Bridge the two parked channels
        await _fsApi(`uuid_bridge ${callerUuid} ${calleeUuid}`);
        session.bridging = false;

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
    }
}

function _declineCall(calleeUuid) {
    const pending = pendingAccepts.get(calleeUuid);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingAccepts.delete(calleeUuid);

    const { callId, callerInfo, calleeInfo } = pending;
    const now = Math.floor(Date.now() / 1000);

    logSystem('DIRECT', `${calleeInfo.displayName} DECLINED call from ${callerInfo.displayName}`);

    global.db.updateDirectCall(callId, { status: 'declined', ended_at: now, end_reason: 'declined' });

    // Stop ring/whisper tones, play decline tone to caller
    stopTone([callerInfo.userName, calleeInfo.userName]);
    playTone([callerInfo.userName], DECLINE_TONE);
}

function _timeoutCall(calleeUuid, callId, callerInfo, calleeInfo) {
    pendingAccepts.delete(calleeUuid);

    logSystem('DIRECT', `${calleeInfo.displayName} did not answer call from ${callerInfo.displayName} (timeout)`);

    const now = Math.floor(Date.now() / 1000);
    global.db.updateDirectCall(callId, { status: 'no_answer', ended_at: now, end_reason: 'timeout' });

    // Stop ring/whisper tones, play decline tone to caller
    stopTone([callerInfo.userName, calleeInfo.userName]);
    playTone([callerInfo.userName], DECLINE_TONE);
    showMessage([callerInfo.userName], `${calleeInfo.displayName}\nNo answer`, 3);
}

// Called when a channel hangs up — clean up direct call session
export function handleHangup(uuid) {
    // Clean DTMF buffer
    const buf = dtmfBuffers.get(uuid);
    if (buf?.timer) clearTimeout(buf.timer);
    dtmfBuffers.delete(uuid);

    // Clean pending accept
    const pending = pendingAccepts.get(uuid);
    if (pending) {
        clearTimeout(pending.timer);
        pendingAccepts.delete(uuid);
        const now = Math.floor(Date.now() / 1000);
        global.db.updateDirectCall(pending.callId, { status: 'cancelled', ended_at: now, end_reason: 'hangup' });
    }

    // Clean active session — the other party will be reconnected by callGate
    const session = activeSessions.get(uuid);
    if (session && session.bridging) return;
    if (session) {
        const now = Math.floor(Date.now() / 1000);
        const durationMs = Date.now() - session.answeredAt;

        activeSessions.delete(session.callerUuid);
        activeSessions.delete(session.calleeUuid);

        // Stop recording
        if (session.recordingPath) {
            _fsApi(`uuid_record ${session.callerUuid} stop ${session.recordingPath}`).catch(() => { });
        }

        global.db.updateDirectCall(session.callId, {
            status: 'completed',
            ended_at: now,
            duration_ms: durationMs,
            end_reason: uuid === session.callerUuid ? 'caller_hangup' : 'callee_hangup',
        });

        logSystem('DIRECT', `┌─ ENDED ── ${Math.round(durationMs / 1000)}s ────────────────────────────`);
        logSystem('DIRECT', `│  ${session.callerInfo.displayName} ↔ ${session.calleeInfo.displayName}`);
        logSystem('DIRECT', `│  ended by: ${uuid === session.callerUuid ? 'caller' : 'callee'}`);
        if (session.recordingPath) logSystem('DIRECT', `│  recording: ${session.recordingPath.split('/').pop()}`);
        logSystem('DIRECT', `└───────────────────────────────────────────────────────`);

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
    }
}

export function isInDirectCall(uuid) {
    return activeSessions.has(uuid) || pendingAccepts.has(uuid) || [...pendingAccepts.values()].some(p => p.callerUuid === uuid);
}

export function getActiveCalls() {
    const seen = new Set();
    const calls = [];
    for (const [uuid, session] of activeSessions) {
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
