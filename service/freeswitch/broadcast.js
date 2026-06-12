// Broadcast detection and recording. Tracks room-level unmute sessions:
// - When someone unmutes, a broadcast session starts and recording begins.
// - If others unmute too, they join as participants in the same session.
// - When ALL participants mute (or leave), the session ends.
// - Single speaker: recording keeps running for 5s response window.
//   If someone responds, they join the same session (single recording).
//   If nobody responds, recording is stopped and trimmed (no trailing silence).
// - Sessions shorter than 3s are discarded (accidental unmutes).
import fs from 'fs';
import path from 'path';
import { getConnection, getMemberIdMap, onCustomEvent } from './connection.js';
import { logUser, logSystem, logBroadcast } from '../logger.js';
import { notifyBroadcast } from '../notifier.js';

const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;
const SILENCE_THRESHOLD_DB = -40;

function _hasVoiceActivity(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        if (buf.length <= 44) return false;
        const samples = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) / 2);
        let sumSq = 0;
        for (let i = 0; i < samples.length; i++) {
            const n = samples[i] / 32768;
            sumSq += n * n;
        }
        const rms = Math.sqrt(sumSq / samples.length);
        const rmsDb = 20 * Math.log10(rms || 1e-10);
        return rmsDb > SILENCE_THRESHOLD_DB;
    } catch {
        return true;
    }
}

function _trimWavSilence(filePath, trimMs) {
    try {
        const buf = fs.readFileSync(filePath);
        if (buf.length <= 44) return;

        // Find the 'data' chunk — don't assume 44-byte header (FS adds LIST metadata)
        let dataOffset = -1;
        let pos = 12;
        while (pos < buf.length - 8) {
            const chunkId = buf.subarray(pos, pos + 4).toString('ascii');
            const chunkSize = buf.readUInt32LE(pos + 4);
            if (chunkId === 'data') {
                dataOffset = pos;
                break;
            }
            pos += 8 + chunkSize;
        }
        if (dataOffset === -1) return;

        const dataStart = dataOffset + 8;
        const dataSize = buf.readUInt32LE(dataOffset + 4);
        const sampleRate = buf.readUInt32LE(24);
        const bitsPerSample = buf.readUInt16LE(34);
        const channels = buf.readUInt16LE(22);
        const bytesPerSample = (bitsPerSample / 8) * channels;
        const bytesToTrim = Math.floor((trimMs / 1000) * sampleRate * bytesPerSample);
        const newDataSize = Math.max(0, dataSize - bytesToTrim);
        if (newDataSize <= 0) return;

        const newFileSize = dataStart + newDataSize;
        const trimmed = buf.subarray(0, newFileSize);
        trimmed.writeUInt32LE(newDataSize, dataOffset + 4);
        trimmed.writeUInt32LE(newFileSize - 8, 4);
        fs.writeFileSync(filePath, trimmed);
    } catch (e) {
        logSystem('BCAST', `WAV trim failed: ${e.message}`);
    }
}

// Room-level active sessions: conferenceName -> session
const roomSessions = new Map();

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;

    const action = event.getHeader('Action');
    const conferenceName = event.getHeader('Conference-Name');
    const memberId = event.getHeader('Member-ID');
    const room = parseInt(conferenceName) || null;

    if (action === 'unmute-member') _handleUnmute(conferenceName, memberId, room, event);
    else if (action === 'mute-member') _handleParticipantLeft(conferenceName, memberId, room);
    else if (action === 'del-member') _handleParticipantLeft(conferenceName, memberId, room);
});

function _resolveMember(memberId, event) {
    const uuid = event.getHeader('Unique-ID');
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || 'Unknown';
    let userName = null;
    let displayName = callerIdName;

    if (uuid) {
        const users = global.db.filter(u => u.fsChannelUUID === uuid);
        if (users.length > 0) {
            userName = users[0].userName;
            displayName = users[0].callerIdName || callerIdName;
        }
    }

    if (!userName) {
        const mapping = getMemberIdMap().get(`${event.getHeader('Conference-Name')}:${memberId}`);
        if (mapping) {
            const users = global.db.filter(u => u.fsChannelUUID === mapping.uuid);
            if (users.length > 0) {
                userName = users[0].userName;
                displayName = users[0].callerIdName || callerIdName;
            }
        }
    }

    return { userName: userName || callerIdName, displayName, uuid };
}

function _handleUnmute(conferenceName, memberId, room, event) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const member = _resolveMember(memberId, event);

    let session = roomSessions.get(conferenceName);

    // If session is in response-wait mode, cancel the timer — someone responded
    if (session && session.responseTimer) {
        clearTimeout(session.responseTimer);
        session.responseTimer = null;
        if (session.responseTimeMs === null && session.speechEndTime) {
            session.responseTimeMs = Date.now() - session.speechEndTime;
        }
        session.speechEndTime = null;
        logSystem('BCAST', `${member.displayName} responded to ${session.allParticipants[0]?.displayName} in ${roomName} (${session.responseTimeMs}ms)`);
    }

    if (!session) {
        const recordingDir = global.config.RECORDING_DIR;
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const recordingFile = path.join(recordingDir, `${roomName}_${timestamp}.wav`);

        logSystem('BCAST', `SESSION START in ${roomName} by ${member.displayName} — recording`);
        getConnection().api(`conference ${conferenceName} record ${recordingFile}`, () => {});

        session = {
            startTime: Date.now(),
            recordingPath: recordingFile,
            participants: new Map(),
            allParticipants: [],
            room,
            responseTimer: null,
            speechEndTime: null,
            responseTimeMs: null,
        };
        roomSessions.set(conferenceName, session);
    }

    if (!session.participants.has(memberId)) {
        const info = { userName: member.userName, displayName: member.displayName };
        const isResponder = session.allParticipants.length > 0 && !session.allParticipants.some(p => p.userName === info.userName);
        session.participants.set(memberId, info);
        if (!session.allParticipants.some(p => p.userName === info.userName)) {
            session.allParticipants.push(info);
        }
        if (isResponder && session.responseTimeMs === null && !session.responseTimer) {
            session.responseTimeMs = 0;
        }
        logSystem('BCAST', `${member.displayName} UNMUTE in ${roomName} (${session.participants.size} active)`);
    }
}

function _handleParticipantLeft(conferenceName, memberId, room) {
    const session = roomSessions.get(conferenceName);
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    if (!session) return;
    if (!session.participants.has(memberId)) return;

    const leaving = session.participants.get(memberId);
    session.participants.delete(memberId);
    logSystem('BCAST', `${leaving.displayName} left ${roomName} (${session.participants.size} remaining)`);

    if (session.participants.size > 0) return;

    // All participants muted/left
    const durationMs = Date.now() - session.startTime;

    // Too short — discard immediately
    if (durationMs < BROADCAST_MIN_DURATION_MS && !session.responseTimer) {
        roomSessions.delete(conferenceName);
        getConnection().api(`conference ${conferenceName} norecord ${session.recordingPath}`, () => {});
        logSystem('BCAST', `TOO SHORT in ${roomName} (${durationMs}ms) — discarding`);
        try { fs.unlinkSync(session.recordingPath); } catch {}
        return;
    }

    // Single speaker — keep session alive and recording running for response window
    if (session.allParticipants.length <= 1 && !session.responseTimer) {
        session.speechEndTime = Date.now();
        const firstSpeaker = session.allParticipants[0] || { userName: 'Unknown', displayName: 'Unknown' };
        logSystem('BCAST', `${firstSpeaker.displayName} in ${roomName} (${durationMs}ms) — waiting for response`);

        session.responseTimer = setTimeout(() => {
            roomSessions.delete(conferenceName);
            getConnection().api(`conference ${conferenceName} norecord ${session.recordingPath}`, () => {});

            if (!_hasVoiceActivity(session.recordingPath)) {
                logSystem('BCAST', `UNANSWERED by ${firstSpeaker.displayName} in ${roomName} (${durationMs}ms) — NO VOICE, discarding`);
                try { fs.unlinkSync(session.recordingPath); } catch {}
                return;
            }

            _trimWavSilence(session.recordingPath, BROADCAST_RESPONSE_WINDOW_MS);
            logSystem('BCAST', `UNANSWERED by ${firstSpeaker.displayName} in ${roomName} (${durationMs}ms) — sending notification`);

            _finalizeBroadcast(conferenceName, room, {
                firstSpeaker,
                allParticipants: session.allParticipants,
                durationMs,
                recordingPath: session.recordingPath,
                startTime: session.startTime,
                responseTimeMs: null,
            }, false, null);
        }, BROADCAST_RESPONSE_WINDOW_MS);

        return;
    }

    // Multi-participant session ended (or response-wait session with responder done)
    roomSessions.delete(conferenceName);
    getConnection().api(`conference ${conferenceName} norecord ${session.recordingPath}`, () => {});

    const firstSpeaker = session.allParticipants[0];
    const responders = session.allParticipants.slice(1).map(p => p.displayName).join(', ');

    if (!_hasVoiceActivity(session.recordingPath)) {
        logSystem('BCAST', `SESSION END in ${roomName} (${durationMs}ms) — NO VOICE, discarding`);
        try { fs.unlinkSync(session.recordingPath); } catch {}
        return;
    }

    logSystem('BCAST', `SESSION END in ${roomName} (${durationMs}ms, ${session.allParticipants.length} participants)`);
    logSystem('BCAST', `ANSWERED by ${firstSpeaker.displayName} in ${roomName}, responders: ${responders}`);

    _finalizeBroadcast(conferenceName, room, {
        firstSpeaker,
        allParticipants: session.allParticipants,
        durationMs,
        recordingPath: session.recordingPath,
        startTime: session.startTime,
        responseTimeMs: session.responseTimeMs,
    }, true, responders);
}

function _finalizeBroadcast(conferenceName, room, data, answered, respondedBy) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const speaker = data.firstSpeaker || {};
    const participants = data.allParticipants || [speaker];

    global.db.logBroadcast({
        room,
        roomName,
        userName: speaker.userName,
        displayName: speaker.displayName,
        durationMs: data.durationMs,
        answered,
        respondedBy: respondedBy || null,
        participants,
        participantCount: participants.length,
        recordingPath: data.recordingPath || null,
        responseTimeMs: data.responseTimeMs ?? null,
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        speaker.userName,
        room,
        `${speaker.displayName} broadcast ${data.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );

    notifyBroadcast({
        room, roomName,
        userName: speaker.userName,
        displayName: speaker.displayName,
        durationMs: data.durationMs,
        answered,
        respondedBy,
        participants,
        recordingPath: data.recordingPath,
    }).catch(err => logSystem('NOTIFY', `Failed: ${err.message}`));
}
