import crypto from 'crypto';
import { sqlite, eventEmitter } from './connection.js';

function logBroadcast({ room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs, listenerCount }) {
    const result = sqlite.prepare(`
        INSERT INTO broadcast_log (room, room_name, user_name, display_name, duration_ms, answered, responded_by, participants, participant_count, recording_path, response_time_ms, listener_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(room, roomName, userName, displayName, durationMs, answered ? 1 : 0, respondedBy, JSON.stringify(participants), participantCount, recordingPath, responseTimeMs, listenerCount || 0);
    const id = Number(result.lastInsertRowid);
    const shareToken = crypto.randomUUID();
    sqlite.prepare('UPDATE broadcast_log SET share_token = ? WHERE id = ?').run(shareToken, id);
    eventEmitter.emit('BROADCAST_LOG', { id, room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs, listenerCount, shareToken, created_at: Math.floor(Date.now() / 1000) });
    eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'broadcasts' });
    eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope: 'dashboard' });
}

function getBroadcastStats(days = 7, room) {
    const since = Math.floor(Date.now() / 1000) - (days * 86400);
    const roomFilter = room ? ' AND room = ?' : '';
    const params = room ? [since, room] : [since];

    const hourly = sqlite.prepare(`
        SELECT
            CAST(strftime('%H', created_at, 'unixepoch', 'localtime') AS INTEGER) as hour,
            COUNT(*) as count
        FROM broadcast_log WHERE created_at >= ?${roomFilter}
        GROUP BY hour ORDER BY hour
    `).all(...params);

    const daily = sqlite.prepare(`
        SELECT
            strftime('%Y-%m-%d', created_at, 'unixepoch', 'localtime') as day,
            COUNT(*) as total,
            SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) as answered
        FROM broadcast_log WHERE created_at >= ?${roomFilter}
        GROUP BY day ORDER BY day
    `).all(...params);

    const topBroadcasters = sqlite.prepare(`
        SELECT user_name, display_name, room_name,
            COUNT(*) as count,
            ROUND(AVG(duration_ms)) as avg_duration_ms,
            SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) as answered,
            SUM(CASE WHEN answered = 0 THEN 1 ELSE 0 END) as unanswered,
            ROUND(AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END)) as avg_response_ms
        FROM broadcast_log WHERE created_at >= ?${roomFilter}
        GROUP BY user_name ORDER BY count DESC LIMIT 10
    `).all(...params);

    const byRoom = sqlite.prepare(`
        SELECT room, COUNT(*) as count,
            SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) as answered
        FROM broadcast_log WHERE created_at >= ?${roomFilter}
        GROUP BY room ORDER BY count DESC
    `).all(...params);

    const durationStats = sqlite.prepare(`
        SELECT
            ROUND(AVG(duration_ms)) as avg_duration_ms,
            SUM(duration_ms) as total_duration_ms
        FROM broadcast_log
        WHERE created_at >= ?${roomFilter}
            AND answered = 1
            AND duration_ms IS NOT NULL
    `).get(...params);

    return { hourly, daily, topBroadcasters, byRoom, durationStats };
}

function getRecentBroadcasts(limit = 10, type) {
    const filter = type === 'answered' ? ' WHERE answered = 1' : type === 'unanswered' ? ' WHERE answered = 0' : '';
    return sqlite.prepare(`
        SELECT id, room, room_name, user_name, display_name, duration_ms, answered, responded_by, participant_count, recording_path, created_at
        FROM broadcast_log${filter} ORDER BY created_at DESC LIMIT ?
    `).all(limit);
}

function getLatestBroadcast() {
    return sqlite.prepare(`
        SELECT id, room, room_name, display_name, duration_ms, answered, responded_by,
            participants, participant_count, recording_path, response_time_ms, share_token,
            listener_count, created_at
        FROM broadcast_log
        ORDER BY created_at DESC, id DESC
        LIMIT 1
    `).get() || null;
}

function getPaginatedBroadcasts({ page = 1, pageSize = 25, room, answered, dateFrom, dateTo, hasParts } = {}) {
    const conditions = [];
    const params = [];

    if (room) { conditions.push('room = ?'); params.push(room); }
    if (answered === 1 || answered === 0) { conditions.push('answered = ?'); params.push(answered); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }
    if (hasParts === 1) { conditions.push('has_parts_request = 1'); }
    if (hasParts === 0) { conditions.push('(has_parts_request = 0 OR has_parts_request IS NULL)'); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = sqlite.prepare(`SELECT COUNT(*) as count FROM broadcast_log ${where}`).get(...params).count;
    const offset = (page - 1) * pageSize;

    const rows = sqlite.prepare(`
        SELECT id, room, room_name, user_name, display_name, duration_ms, answered, responded_by, participants, participant_count, recording_path, response_time_ms, share_token, listener_count, transcription, transcription_status, local_transcription, has_parts_request, part_details, created_at
        FROM broadcast_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function getHourlyBroadcasts(hours = 12, room) {
    const since = Math.floor(Date.now() / 1000) - (hours * 3600);
    const roomFilter = room ? ' AND room = ?' : '';
    const params = room ? [since, room] : [since];
    return sqlite.prepare(`
        SELECT
            created_at,
            answered,
            room
        FROM broadcast_log WHERE created_at >= ?${roomFilter}
        ORDER BY created_at ASC
    `).all(...params);
}
function getTimelineBroadcasts(minutes = 30) {
    const since = Math.floor(Date.now() / 1000) - (minutes * 60);
    return sqlite.prepare(`
        SELECT room, created_at, duration_ms, answered
        FROM broadcast_log WHERE created_at >= ?
        ORDER BY created_at ASC
    `).all(since);
}

function generateBroadcastShareToken(id) {
    const token = crypto.randomUUID();
    sqlite.prepare('UPDATE broadcast_log SET share_token = ? WHERE id = ?').run(token, id);
    return token;
}

function revokeBroadcastShareToken(id) {
    sqlite.prepare('UPDATE broadcast_log SET share_token = NULL WHERE id = ?').run(id);
}

function getBroadcastByShareToken(token) {
    return sqlite.prepare(
        'SELECT id, room, room_name, display_name, duration_ms, answered, responded_by, participants, participant_count, recording_path, response_time_ms, listener_count, transcription, created_at FROM broadcast_log WHERE share_token = ?'
    ).get(token) || null;
}

function getBroadcastById(id) {
    return sqlite.prepare('SELECT * FROM broadcast_log WHERE id = ?').get(id) || null;
}

function getBroadcastByRecordingPath(recordingPath) {
    return sqlite.prepare('SELECT id, room FROM broadcast_log WHERE recording_path = ? ORDER BY id DESC LIMIT 1').get(recordingPath) || null;
}

function updateBroadcastTranscription(id, { transcription, status, error }) {
    const sets = [];
    const vals = [];
    if (transcription !== undefined) { sets.push('transcription = ?'); vals.push(transcription); }
    if (status !== undefined) { sets.push('transcription_status = ?'); vals.push(status); }
    if (error !== undefined) { sets.push('transcription_error = ?'); vals.push(error); }
    if (sets.length === 0) return;
    vals.push(id);
    sqlite.prepare(`UPDATE broadcast_log SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

function updateBroadcastLocalTranscription(id, text, hasPartsRequest) {
    sqlite.prepare('UPDATE broadcast_log SET local_transcription = ?, has_parts_request = ? WHERE id = ?').run(text, hasPartsRequest ? 1 : 0, id);
}

function updateBroadcastPartDetails(id, partDetails) {
    sqlite.prepare('UPDATE broadcast_log SET part_details = ? WHERE id = ?').run(JSON.stringify(partDetails), id);
}

export {
    logBroadcast, getBroadcastStats, getRecentBroadcasts, getPaginatedBroadcasts,
    getLatestBroadcast, getHourlyBroadcasts, getTimelineBroadcasts,
    generateBroadcastShareToken, revokeBroadcastShareToken,
    getBroadcastByShareToken, getBroadcastById, getBroadcastByRecordingPath,
    updateBroadcastTranscription, updateBroadcastLocalTranscription, updateBroadcastPartDetails,
};
