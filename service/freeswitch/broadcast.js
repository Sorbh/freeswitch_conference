// Broadcast detection and logging. Monitors conference events for unmuted speakers,
// detects broadcast sessions (single speaker addressing a room), and logs them
// with duration, participants, and optional transcription/recording paths.
import fs from 'fs';
import path from 'path';
import { getConnection, getMemberIdMap, onCustomEvent } from './connection.js';

const BROADCAST_MIN_DURATION_MS = 3000;
const BROADCAST_RESPONSE_WINDOW_MS = 5000;
const activeTalkers = new Map();
const pendingBroadcasts = new Map();

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;

    const action = event.getHeader('Action');
    const conferenceName = event.getHeader('Conference-Name');
    const memberId = event.getHeader('Member-ID');
    const room = parseInt(conferenceName) || null;

    if (action === 'start-talking') _handleStartTalking(conferenceName, memberId, room, event);
    else if (action === 'stop-talking') _handleStopTalking(conferenceName, memberId, room);
});

function _handleStartTalking(conferenceName, memberId, room, event) {
    const key = `${conferenceName}:${memberId}`;
    const memberInfo = getMemberIdMap().get(key);
    const uuid = event.getHeader('Unique-ID') || memberInfo?.uuid;
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || memberInfo?.callerIdName || 'Unknown';

    let userName = null;
    let displayName = callerIdName;
    if (uuid) {
        const users = global.db.filter(u => u.fsChannelUUID === uuid);
        if (users.length > 0) {
            userName = users[0].userName;
            displayName = users[0].callerIdName || callerIdName;
        }
    }

    activeTalkers.set(key, {
        startTime: Date.now(),
        userName: userName || callerIdName,
        displayName,
        room,
        uuid,
    });

    if (pendingBroadcasts.has(conferenceName)) {
        const pending = pendingBroadcasts.get(conferenceName);
        clearTimeout(pending.timer);
        pendingBroadcasts.delete(conferenceName);

        const respondedBy = userName || callerIdName;
        console.log(`[BROADCAST] ${respondedBy} responded to ${pending.displayName} in ${global.config.ROOM_NAME[room] || conferenceName}`);
        _finalizeBroadcast(conferenceName, room, pending, true, respondedBy);
    }

    if (uuid) {
        const recordingDir = global.config.RECORDING_DIR;
        if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const roomName = global.config.ROOM_NAME[room] || conferenceName;
        const recordingFile = path.join(recordingDir, `${roomName}_${timestamp}_${memberId}.wav`);

        getConnection().api(`uuid_record ${uuid} start ${recordingFile}`, () => {});

        const talker = activeTalkers.get(key);
        if (talker) talker.recordingPath = recordingFile;
    }
}

function _handleStopTalking(conferenceName, memberId, room) {
    const key = `${conferenceName}:${memberId}`;
    const talker = activeTalkers.get(key);
    if (!talker) return;

    const durationMs = Date.now() - talker.startTime;
    activeTalkers.delete(key);

    if (talker.uuid && talker.recordingPath) {
        getConnection().api(`uuid_record ${talker.uuid} stop ${talker.recordingPath}`, () => {});

        if (durationMs < BROADCAST_MIN_DURATION_MS && talker.recordingPath) {
            try { fs.unlinkSync(talker.recordingPath); } catch {}
        }
    }

    if (durationMs < BROADCAST_MIN_DURATION_MS) return;

    console.log(`[BROADCAST] Detected: ${talker.displayName} in ${global.config.ROOM_NAME[room] || conferenceName} (${durationMs}ms)`);

    const timer = setTimeout(() => {
        pendingBroadcasts.delete(conferenceName);
        console.log(`[BROADCAST] UNANSWERED in ${global.config.ROOM_NAME[room] || conferenceName} by ${talker.displayName}`);
        _finalizeBroadcast(conferenceName, room, { ...talker, durationMs }, false, null);
    }, BROADCAST_RESPONSE_WINDOW_MS);

    pendingBroadcasts.set(conferenceName, {
        timer,
        userName: talker.userName,
        displayName: talker.displayName,
        startTime: talker.startTime,
        durationMs,
        recordingPath: talker.recordingPath,
    });
}

function _finalizeBroadcast(conferenceName, room, broadcastData, answered, respondedBy) {
    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    const participants = global.db.filter(u => u.connectionState === 'connected' && u.room === room);
    const participantList = participants.map(u => ({
        userName: u.userName,
        displayName: u.callerIdName,
        mute: u.mute,
    }));

    global.db.logBroadcast({
        room,
        roomName,
        userName: broadcastData.userName,
        displayName: broadcastData.displayName,
        durationMs: broadcastData.durationMs,
        answered,
        respondedBy,
        participants: participantList,
        participantCount: participantList.length,
        recordingPath: broadcastData.recordingPath || null,
    });

    global.db.logEvent(
        answered ? 'broadcast_answered' : 'broadcast_unanswered',
        broadcastData.userName,
        room,
        `${broadcastData.displayName} broadcast ${broadcastData.durationMs}ms in ${roomName}${answered ? ` — answered by ${respondedBy}` : ' — UNANSWERED'}`
    );
}
