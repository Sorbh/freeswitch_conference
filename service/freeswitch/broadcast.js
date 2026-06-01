// Broadcast detection and recording. Tracks room-level unmute sessions:
// - When someone unmutes, a broadcast session starts and recording begins.
// - If others unmute too, they join as participants in the same session.
// - When ALL participants mute (or leave), the session ends.
// - Single speaker + no response (unmute) within 5s = unanswered broadcast.
// - Multiple participants = answered broadcast.
// - Sessions shorter than 3s are discarded (accidental unmutes).
import fs from 'fs';
import path from 'path';
import { getConnection, getMemberIdMap, onCustomEvent } from './connection.js';
import { logUser, logSystem } from '../logger.js';

const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;

// Room-level active sessions: conferenceName -> session
const roomSessions = new Map();
const pendingBroadcasts = new Map();

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

    // If there's a pending unanswered broadcast, this unmute is a response
    if (pendingBroadcasts.has(conferenceName)) {
        const pending = pendingBroadcasts.get(conferenceName);
        clearTimeout(pending.timer);
        pendingBroadcasts.delete(conferenceName);

        logUser(member.userName, 'BCAST', `responded to ${pending.firstSpeaker.displayName} in ${roomName}`);
    }

    let session = roomSessions.get(conferenceName);

    if (!session) {
        const recordingDir = global.config.RECORDING_DIR;
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const recordingFile = path.join(recordingDir, `${roomName}_${timestamp}.wav`);

        logUser(roomName, 'BCAST', `SESSION START by ${member.displayName} — recording`);
        getConnection().api(`conference ${conferenceName} record ${recordingFile}`, () => {});

        session = {
            startTime: Date.now(),
            recordingPath: recordingFile,
            participants: new Map(),
            allParticipants: [],
            room,
        };
        roomSessions.set(conferenceName, session);
    }

    if (!session.participants.has(memberId)) {
        const info = { userName: member.userName, displayName: member.displayName };
        session.participants.set(memberId, info);
        if (!session.allParticipants.some(p => p.userName === info.userName)) {
            session.allParticipants.push(info);
        }
        logUser(member.userName, 'BCAST', `UNMUTE in ${roomName} (${session.participants.size} active)`);
    }
}

function _handleParticipantLeft(conferenceName, memberId, room) {
    const session = roomSessions.get(conferenceName);
    if (!session) return;

    session.participants.delete(memberId);

    if (session.participants.size > 0) return;

    // All participants muted/left — end session
    const durationMs = Date.now() - session.startTime;
    roomSessions.delete(conferenceName);

    getConnection().api(`conference ${conferenceName} norecord ${session.recordingPath}`, () => {});

    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    logUser(roomName, 'BCAST', `SESSION END (${durationMs}ms, ${session.allParticipants.length} participants)`);

    if (durationMs < BROADCAST_MIN_DURATION_MS) {
        logUser(roomName, 'BCAST', `TOO SHORT (${durationMs}ms) — discarding`);
        try { fs.unlinkSync(session.recordingPath); } catch {}
        return;
    }

    _evaluateSession(conferenceName, room, session, durationMs);
}

function _evaluateSession(conferenceName, room, session, durationMs) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const participants = session.allParticipants || [];

    if (participants.length <= 1) {
        const firstSpeaker = participants[0] || { userName: 'Unknown', displayName: 'Unknown' };

        logUser(roomName, 'BCAST', `${firstSpeaker.displayName} (${durationMs}ms) — waiting for response`);

        const timer = setTimeout(() => {
            pendingBroadcasts.delete(conferenceName);
            logUser(roomName, 'BCAST', `UNANSWERED by ${firstSpeaker.displayName}`);
            _finalizeBroadcast(conferenceName, room, {
                firstSpeaker,
                allParticipants: participants,
                durationMs,
                recordingPath: session.recordingPath,
                startTime: session.startTime,
            }, false, null);
        }, BROADCAST_RESPONSE_WINDOW_MS);

        pendingBroadcasts.set(conferenceName, {
            timer,
            firstSpeaker,
            allParticipants: participants,
            durationMs,
            recordingPath: session.recordingPath,
            startTime: session.startTime,
        });
    } else {
        const firstSpeaker = participants[0];
        const responders = participants.slice(1).map(p => p.displayName).join(', ');
        logUser(roomName, 'BCAST', `ANSWERED by ${firstSpeaker.displayName}, responders: ${responders}`);

        _finalizeBroadcast(conferenceName, room, {
            firstSpeaker,
            allParticipants: participants,
            durationMs,
            recordingPath: session.recordingPath,
            startTime: session.startTime,
        }, true, responders);
    }
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
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        speaker.userName,
        room,
        `${speaker.displayName} broadcast ${data.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );
}
