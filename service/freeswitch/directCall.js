// Direct (1:1) private calling via DTMF in conference.
// Flow: User A dials *102 → whisper to B → B presses 1 to accept → bridge A↔B → hangup → both return to conference.

import fs from 'fs';
import path from 'path';
import { getConnection, onDtmfEvent, onHangupEvent } from './connection.js';
import { showMessage } from './notifications.js';
import { logSystem } from '../logger.js';

// Register ESL event handlers
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
const RING_TONE = 'tone_stream://%(400,200,440,480);loops=10';
const ACCEPT_TONE = 'tone_stream://%(200,0,600);%(200,0,800)';
const DECLINE_TONE = 'tone_stream://%(400,0,480,620);loops=2';
const WHISPER_TONE = 'tone_stream://%(200,100,600);%(200,100,800);%(200,100,1000);loops=10';

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

// Called by ESL DTMF event handler
export function handleDTMF(uuid, digit) {
    // Check if this UUID is a callee waiting to accept/decline
    if (pendingAccepts.has(uuid)) {
        if (digit === '1') {
            _acceptCall(uuid);
        } else if (digit === '2') {
            _declineCall(uuid);
        }
        return;
    }

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
        // Wait for more digits (up to 2s between digits)
        buf.timer = setTimeout(() => {
            const ext = parseInt(buf.digits);
            dtmfBuffers.delete(uuid);
            if (ext > 0) _initiateDirectCall(uuid, ext);
        }, 2000);

        // Auto-trigger at 3 digits (extensions are 3 digits: 101-999)
        if (buf.digits.length >= 3) {
            if (buf.timer) clearTimeout(buf.timer);
            const ext = parseInt(buf.digits);
            dtmfBuffers.delete(uuid);
            if (ext > 0) _initiateDirectCall(uuid, ext);
        }
    } else {
        // Non-digit after * — cancel
        if (buf.timer) clearTimeout(buf.timer);
        dtmfBuffers.delete(uuid);
    }
}

async function _initiateDirectCall(callerUuid, calleeExtension) {
    const caller = _getConferenceInfo(callerUuid);
    if (!caller) {
        logSystem('DIRECT', `Caller UUID ${callerUuid} not found in DB`);
        return;
    }

    const callee = _findUserByExtension(calleeExtension);
    if (!callee) {
        logSystem('DIRECT', `Extension *${calleeExtension} not found or not in call`);
        // Play error tone to caller
        try {
            const callerRoom = caller.room;
            await _fsApi(`conference ${callerRoom} play ${DECLINE_TONE} ${caller.memberId}`);
        } catch {}
        return;
    }

    if (callee.uuid === callerUuid) {
        logSystem('DIRECT', `${caller.displayName} tried to call themselves (*${calleeExtension})`);
        return;
    }

    // Check if either party is already in a direct call
    if (activeSessions.has(callerUuid) || activeSessions.has(callee.uuid)) {
        logSystem('DIRECT', `${caller.displayName} or ${callee.displayName} already in a direct call`);
        try {
            await _fsApi(`conference ${caller.room} play ${DECLINE_TONE} ${caller.memberId}`);
        } catch {}
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

    // Play continuous ring tone to caller
    try {
        await _fsApi(`conference ${caller.room} play ${RING_TONE} ${caller.memberId}`);
    } catch {}

    // Play continuous whisper tone to callee
    try {
        await _fsApi(`conference ${callee.room} play ${WHISPER_TONE} ${callee.memberId}`);
    } catch {}

    // Delay screen notifications so they arrive after any broadcast side-effects settle
    setTimeout(() => {
        showMessage(
            [caller.userName],
            `Calling *${calleeExtension}...\n${callee.displayName}\n\nWaiting for answer...`,
            30
        );
        showMessage(
            [callee.userName],
            `Private call from:\n${caller.displayName}\n\nPress 1 = Accept\nPress 2 = Decline`,
            30
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
        // Stop ring/whisper tones
        await _fsApi(`conference ${callerInfo.room} stop ${callerInfo.memberId}`).catch(() => {});
        await _fsApi(`conference ${calleeInfo.room} stop ${calleeInfo.memberId}`).catch(() => {});

        // Play accept tone to both
        await _fsApi(`conference ${callerInfo.room} play ${ACCEPT_TONE} ${callerInfo.memberId}`);

        // Kick both from their conferences
        await _fsApi(`conference ${callerInfo.room} kick ${callerInfo.memberId}`);
        await _fsApi(`conference ${calleeInfo.room} kick ${calleeInfo.memberId}`);

        // Small delay for channels to settle after kick
        await new Promise(r => setTimeout(r, 300));

        // Bridge the two channels
        await _fsApi(`uuid_bridge ${callerUuid} ${calleeUuid}`);

        // Start recording
        const recordingDir = path.join(global.config.RECORDING_DIR, 'direct');
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const callerShort = callerInfo.email.split('@')[0];
        const calleeShort = calleeInfo.email.split('@')[0];
        const recordingPath = path.join(recordingDir, `${callerShort}_to_${calleeShort}_${timestamp}.wav`);
        await _fsApi(`uuid_record ${callerUuid} start ${recordingPath}`).catch(() => {});

        logSystem('DIRECT', `│  bridged: ${callerInfo.displayName} ↔ ${calleeInfo.displayName}`);
        logSystem('DIRECT', `│  recording: ${recordingPath.split('/').pop()}`);
        logSystem('DIRECT', `└───────────────────────────────────────────────────────`);

        global.db.updateDirectCall(callId, { recording_path: recordingPath });

        // Track active session
        const session = {
            callId,
            callerUuid,
            calleeUuid,
            callerInfo,
            calleeInfo,
            answeredAt: Date.now(),
            recordingPath,
        };
        activeSessions.set(callerUuid, session);
        activeSessions.set(calleeUuid, session);
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
    _fsApi(`conference ${callerInfo.room} stop ${callerInfo.memberId}`).catch(() => {});
    _fsApi(`conference ${calleeInfo.room} stop ${calleeInfo.memberId}`).catch(() => {});
    _fsApi(`conference ${callerInfo.room} play ${DECLINE_TONE} ${callerInfo.memberId}`).catch(() => {});
}

function _timeoutCall(calleeUuid, callId, callerInfo, calleeInfo) {
    pendingAccepts.delete(calleeUuid);

    logSystem('DIRECT', `${calleeInfo.displayName} did not answer call from ${callerInfo.displayName} (timeout)`);

    const now = Math.floor(Date.now() / 1000);
    global.db.updateDirectCall(callId, { status: 'no_answer', ended_at: now, end_reason: 'timeout' });

    // Stop ring/whisper tones, play decline tone to caller
    _fsApi(`conference ${callerInfo.room} stop ${callerInfo.memberId}`).catch(() => {});
    _fsApi(`conference ${calleeInfo.room} stop ${calleeInfo.memberId}`).catch(() => {});
    _fsApi(`conference ${callerInfo.room} play ${DECLINE_TONE} ${callerInfo.memberId}`).catch(() => {});
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
    if (session) {
        const now = Math.floor(Date.now() / 1000);
        const durationMs = Date.now() - session.answeredAt;

        activeSessions.delete(session.callerUuid);
        activeSessions.delete(session.calleeUuid);

        // Stop recording
        if (session.recordingPath) {
            _fsApi(`uuid_record ${session.callerUuid} stop ${session.recordingPath}`).catch(() => {});
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

        // Auto-transcribe if enabled for either party's room
        if (session.recordingPath) {
            import('../transcription.js').then(({ shouldAutoTranscribe, transcribeDirectCall }) => {
                if (shouldAutoTranscribe(session.callerInfo.room) || shouldAutoTranscribe(session.calleeInfo.room)) {
                    transcribeDirectCall(session.callId).catch(err =>
                        logSystem('DIRECT', `Auto-transcribe failed for call #${session.callId}: ${err.message}`)
                    );
                }
            }).catch(() => {});
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
