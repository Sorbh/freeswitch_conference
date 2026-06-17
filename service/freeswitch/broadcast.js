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
import { execFileSync } from 'child_process';
import { getConnection, getMemberIdMap, onCustomEvent } from './connection.js';
import { logUser, logSystem, logBroadcast } from '../logger.js';
import { isPlaying, stopAd } from '../announcements.js';
import { notifyBroadcast } from '../notifier.js';
import { shouldAutoTranscribe, transcribeBroadcast, whisperTranscribeBroadcast } from '../transcription.js';
import { isInDirectCall } from './directCall.js';

const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;
const SILENCE_THRESHOLD_DB = -40;

function _hasVoiceActivity(filePath) {
    try {
        // ffmpeg writes detection info to stderr and exits 0
        const result = execFileSync('ffmpeg', [
            '-i', filePath, '-af', `silencedetect=noise=${SILENCE_THRESHOLD_DB}dB:d=0.5`,
            '-f', 'null', '-'
        ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
        return true;
    } catch (e) {
        const stderr = (e.stderr || '').toString();
        // If the entire file is one silence region starting near 0, no voice activity
        const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)];
        const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)];
        if (starts.length === 1 && ends.length === 0 && parseFloat(starts[0][1]) < 0.5) return false;
        if (!starts.length) return true;
        return true;
    }
}

function _trimTrailingSilence(filePath) {
    try {
        const tmpPath = filePath.replace(/\.wav$/, '_trimmed.wav');
        execFileSync('ffmpeg', [
            '-y', '-i', filePath,
            '-af', `areverse,silenceremove=start_periods=1:start_silence=0.3:start_threshold=${SILENCE_THRESHOLD_DB}dB,areverse`,
            tmpPath
        ], { stdio: 'ignore', timeout: 15000 });

        const origSize = fs.statSync(filePath).size;
        const trimmedSize = fs.statSync(tmpPath).size;
        if (trimmedSize > 44 && trimmedSize < origSize) {
            fs.renameSync(tmpPath, filePath);
            logSystem('BCAST', `Trimmed trailing silence: ${Math.round(origSize/1024)}KB → ${Math.round(trimmedSize/1024)}KB`);
        } else {
            try { fs.unlinkSync(tmpPath); } catch {}
        }
    } catch (e) {
        logSystem('BCAST', `WAV trim failed: ${e.message}`);
    }
}

function _getFileDurationMs(filePath) {
    try {
        const out = execFileSync('ffprobe', [
            '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath
        ], { encoding: 'utf8', timeout: 5000 });
        const secs = parseFloat(out.trim());
        if (isFinite(secs) && secs > 0) return Math.round(secs * 1000);
    } catch {}
    return null;
}

function _trimToduration(filePath, durationMs) {
    try {
        const durationSec = (durationMs / 1000).toFixed(3);
        const tmpPath = filePath.replace(/\.wav$/, '_cut.wav');
        execFileSync('ffmpeg', [
            '-y', '-i', filePath, '-t', durationSec, '-c', 'copy', tmpPath
        ], { stdio: 'ignore', timeout: 10000 });
        const trimmedSize = fs.statSync(tmpPath).size;
        if (trimmedSize > 44) {
            fs.renameSync(tmpPath, filePath);
            logSystem('BCAST', `Trimmed response window: cut to ${durationSec}s`);
        } else {
            try { fs.unlinkSync(tmpPath); } catch {}
        }
    } catch (e) {
        logSystem('BCAST', `Duration trim failed: ${e.message}`);
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

    // Skip broadcast tracking for members involved in a direct call
    const uuid = event.getHeader('Unique-ID');
    if (uuid && isInDirectCall(uuid)) return;

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

    if (userName) {
        const email = userName.replace(/^sip:/, '');
        const account = global.db.getAccountByEmail(email);
        if (account) {
            displayName = `${account.company_name || ''} / ${account.display_name || email}`;
        }
    }

    return { userName: userName || callerIdName, displayName, uuid };
}

function _handleUnmute(conferenceName, memberId, room, event) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const member = _resolveMember(memberId, event);

    // Stop any active announcement in this room
    if (isPlaying(room)) {
        stopAd(room, member.userName || member.displayName);
    }

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

        const listenerCount = global.db.filter(u =>
            u.connectionState === 'connected' && (u.currentRoom || u.room) === room
        ).length;

        logSystem('BCAST', `SESSION START in ${roomName} by ${member.displayName} — recording (${listenerCount} listeners)`);
        getConnection().api(`conference ${conferenceName} record ${recordingFile}`, () => {});

        session = {
            startTime: Date.now(),
            recordingPath: recordingFile,
            participants: new Map(),
            allParticipants: [],
            room,
            listenerCount,
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

            _trimToduration(session.recordingPath, durationMs);
            _trimTrailingSilence(session.recordingPath);
            const actualDurationMs = _getFileDurationMs(session.recordingPath) || durationMs;
            logSystem('BCAST', `UNANSWERED by ${firstSpeaker.displayName} in ${roomName} (${actualDurationMs}ms) — sending notification`);

            _finalizeBroadcast(conferenceName, room, {
                firstSpeaker,
                allParticipants: session.allParticipants,
                durationMs: actualDurationMs,
                recordingPath: session.recordingPath,
                startTime: session.startTime,
                responseTimeMs: null,
                listenerCount: session.listenerCount,
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

    const actualDurationMs = _getFileDurationMs(session.recordingPath) || durationMs;
    logSystem('BCAST', `SESSION END in ${roomName} (speech ${durationMs}ms, file ${actualDurationMs}ms, ${session.allParticipants.length} participants)`);
    logSystem('BCAST', `ANSWERED by ${firstSpeaker.displayName} in ${roomName}, responders: ${responders}`);

    _finalizeBroadcast(conferenceName, room, {
        firstSpeaker,
        allParticipants: session.allParticipants,
        durationMs: actualDurationMs,
        recordingPath: session.recordingPath,
        startTime: session.startTime,
        responseTimeMs: session.responseTimeMs,
        listenerCount: session.listenerCount,
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
        listenerCount: data.listenerCount || 0,
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        speaker.userName,
        room,
        `${speaker.displayName} broadcast ${data.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );

    const broadcastNotifyData = {
        room, roomName,
        userName: speaker.userName,
        displayName: speaker.displayName,
        durationMs: data.durationMs,
        answered,
        respondedBy,
        participants,
        recordingPath: data.recordingPath,
    };

    // Run local whisper transcription on every broadcast (fast, ~1s)
    if (data.recordingPath) {
        const row = global.db.getBroadcastByRecordingPath(data.recordingPath);
        if (row) {
            try {
                const whisperResult = whisperTranscribeBroadcast(row.id);
                if (whisperResult) {
                    broadcastNotifyData.hasPartsRequest = whisperResult.hasPartsRequest;
                }
            } catch (err) {
                logSystem('BCAST', `Whisper local failed for #${row.id}: ${err.message}`);
            }
        }
    }

    // If auto-transcribe is enabled, transcribe with API then notify (so {{transcription}} is available)
    if (data.recordingPath && shouldAutoTranscribe(room)) {
        const row = global.db.getBroadcastByRecordingPath(data.recordingPath);
        if (row) {
            transcribeBroadcast(row.id)
                .catch(err => logSystem('BCAST', `Auto-transcribe failed for broadcast #${row.id}: ${err.message}`))
                .finally(() => {
                    notifyBroadcast(broadcastNotifyData).catch(err => logSystem('NOTIFY', `Failed: ${err.message}`));
                });
            return;
        }
    }

    // No auto-transcribe — notify immediately
    notifyBroadcast(broadcastNotifyData).catch(err => logSystem('NOTIFY', `Failed: ${err.message}`));
}
