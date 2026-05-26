// Broadcast detection and logging. Tracks room-level talk sessions:
// - Recording starts when first person starts talking in a room
// - All speakers during the session are tracked
// - Recording stops when everyone is muted/stopped
// - Single speaker + no response in 5s = unanswered broadcast
// - Multiple speakers = answered broadcast
import fs from 'fs';
import path from 'path';
import { getConnection, getMemberIdMap, onCustomEvent } from './connection.js';

const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;

// Room-level active sessions: conferenceName -> { startTime, recordingPath, speakers: Map<memberId, {userName, displayName}>, room }
const roomSessions = new Map();
const pendingBroadcasts = new Map();

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;

    const action = event.getHeader('Action');
    const conferenceName = event.getHeader('Conference-Name');
    const memberId = event.getHeader('Member-ID');
    const room = parseInt(conferenceName) || null;

    if (action === 'start-talking') _handleStartTalking(conferenceName, memberId, room, event);
    else if (action === 'stop-talking') _handleMemberStopped(conferenceName, memberId, room);
    else if (action === 'mute-member') _handleMemberStopped(conferenceName, memberId, room);
    else if (action === 'del-member') _handleMemberStopped(conferenceName, memberId, room);
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

    return { userName: userName || callerIdName, displayName, uuid };
}

function _handleStartTalking(conferenceName, memberId, room, event) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const member = _resolveMember(memberId, event);

    console.log(`[BROADCAST] START-TALKING ${member.displayName} in ${roomName} (member ${memberId})`);

    // Check if this is a response to a pending broadcast
    if (pendingBroadcasts.has(conferenceName)) {
        const pending = pendingBroadcasts.get(conferenceName);
        clearTimeout(pending.timer);
        pendingBroadcasts.delete(conferenceName);

        console.log(`[BROADCAST] ${member.displayName} responded to ${pending.firstSpeaker.displayName} in ${roomName}`);
        _finalizeBroadcast(conferenceName, room, pending, true, member.displayName);
    }

    let session = roomSessions.get(conferenceName);

    if (!session) {
        // First talker — start a new room session + recording
        const recordingDir = global.config.RECORDING_DIR;
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const recordingFile = path.join(recordingDir, `${roomName}_${timestamp}.wav`);

        console.log(`[BROADCAST] SESSION START in ${roomName} — recording -> ${recordingFile}`);
        getConnection().api(`conference ${conferenceName} record ${recordingFile}`, () => {});

        session = {
            startTime: Date.now(),
            recordingPath: recordingFile,
            speakers: new Map(),
            allSpeakers: [],
            room,
        };
        roomSessions.set(conferenceName, session);
    }

    // Track this speaker (active + historical)
    if (!session.speakers.has(memberId)) {
        const speakerInfo = { userName: member.userName, displayName: member.displayName };
        session.speakers.set(memberId, speakerInfo);
        const alreadyTracked = session.allSpeakers.some(s => s.userName === speakerInfo.userName);
        if (!alreadyTracked) session.allSpeakers.push(speakerInfo);
    }
}

function _handleMemberStopped(conferenceName, memberId, room) {
    const session = roomSessions.get(conferenceName);
    if (!session) return;

    const speaker = session.speakers.get(memberId);
    const roomName = global.config.ROOM_NAME[room] || conferenceName;

    if (speaker) {
        console.log(`[BROADCAST] STOP-TALKING ${speaker.displayName} in ${roomName} (member ${memberId})`);
        session.speakers.delete(memberId);
    }

    // Still other people talking — session continues
    if (session.speakers.size > 0) return;

    // Everyone stopped — end the session
    const durationMs = Date.now() - session.startTime;
    roomSessions.delete(conferenceName);

    // Stop conference recording
    getConnection().api(`conference ${conferenceName} norecord ${session.recordingPath}`, () => {});
    console.log(`[BROADCAST] SESSION END in ${roomName} (${durationMs}ms)`);

    // Too short — delete recording and skip
    if (durationMs < BROADCAST_MIN_DURATION_MS) {
        console.log(`[BROADCAST] TOO SHORT (${durationMs}ms < ${BROADCAST_MIN_DURATION_MS}ms) — discarding`);
        try { fs.unlinkSync(session.recordingPath); } catch {}
        return;
    }

    // Collect all speakers that participated in this session
    // (they were already removed from session.speakers, so we need to track them separately)
    // We'll store them on the session object before deletion — let me refactor:
    // Actually we need a separate tracking. Let me use the session data we have.
    _evaluateSession(conferenceName, room, session, durationMs);
}

function _evaluateSession(conferenceName, room, session, durationMs) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;

    const totalSpeakers = session.allSpeakers || [];

    if (totalSpeakers.length <= 1) {
        // Single speaker — wait for response
        const firstSpeaker = totalSpeakers[0] || { userName: 'Unknown', displayName: 'Unknown' };

        console.log(`[BROADCAST] Detected: ${firstSpeaker.displayName} in ${roomName} (${durationMs}ms) — waiting for response`);

        const timer = setTimeout(() => {
            pendingBroadcasts.delete(conferenceName);
            console.log(`[BROADCAST] UNANSWERED in ${roomName} by ${firstSpeaker.displayName}`);
            _finalizeBroadcast(conferenceName, room, {
                firstSpeaker,
                allSpeakers: totalSpeakers,
                durationMs,
                recordingPath: session.recordingPath,
                startTime: session.startTime,
            }, false, null);
        }, BROADCAST_RESPONSE_WINDOW_MS);

        pendingBroadcasts.set(conferenceName, {
            timer,
            firstSpeaker,
            allSpeakers: totalSpeakers,
            durationMs,
            recordingPath: session.recordingPath,
            startTime: session.startTime,
        });
    } else {
        // Multiple speakers — answered broadcast
        const firstSpeaker = totalSpeakers[0];
        const responders = totalSpeakers.slice(1).map(s => s.displayName).join(', ');
        console.log(`[BROADCAST] ANSWERED in ${roomName} by ${firstSpeaker.displayName}, responders: ${responders}`);

        _finalizeBroadcast(conferenceName, room, {
            firstSpeaker,
            allSpeakers: totalSpeakers,
            durationMs,
            recordingPath: session.recordingPath,
            startTime: session.startTime,
        }, true, responders);
    }
}

function _finalizeBroadcast(conferenceName, room, broadcastData, answered, respondedBy) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const speaker = broadcastData.firstSpeaker || {};
    const speakers = broadcastData.allSpeakers || [speaker];

    global.db.logBroadcast({
        room,
        roomName,
        userName: speaker.userName,
        displayName: speaker.displayName,
        durationMs: broadcastData.durationMs,
        answered,
        respondedBy: respondedBy || null,
        participants: speakers,
        participantCount: speakers.length,
        recordingPath: broadcastData.recordingPath || null,
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        speaker.userName,
        room,
        `${speaker.displayName} broadcast ${broadcastData.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );
}
