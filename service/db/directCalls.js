import { sqlite } from './connection.js';

// ── Direct calls ──

function logDirectCall(data) {
    const result = sqlite.prepare(`
        INSERT INTO direct_calls (
            caller_email, caller_extension, caller_display_name, caller_company, caller_room, caller_room_name,
            callee_email, callee_extension, callee_display_name, callee_company, callee_room, callee_room_name,
            status, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.callerEmail, data.callerExtension, data.callerDisplayName, data.callerCompany, data.callerRoom, data.callerRoomName,
        data.calleeEmail, data.calleeExtension, data.calleeDisplayName, data.calleeCompany, data.calleeRoom, data.calleeRoomName,
        data.status || 'ringing', Math.floor(Date.now() / 1000)
    );
    return result.lastInsertRowid;
}

function updateDirectCall(id, fields) {
    const sets = [];
    const vals = [];
    if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
    if (fields.answered_at !== undefined) { sets.push('answered_at = ?'); vals.push(fields.answered_at); }
    if (fields.ended_at !== undefined) { sets.push('ended_at = ?'); vals.push(fields.ended_at); }
    if (fields.duration_ms !== undefined) { sets.push('duration_ms = ?'); vals.push(fields.duration_ms); }
    if (fields.end_reason !== undefined) { sets.push('end_reason = ?'); vals.push(fields.end_reason); }
    if (fields.recording_path !== undefined) { sets.push('recording_path = ?'); vals.push(fields.recording_path); }
    if (fields.transcription !== undefined) { sets.push('transcription = ?'); vals.push(fields.transcription); }
    if (fields.transcription_status !== undefined) { sets.push('transcription_status = ?'); vals.push(fields.transcription_status); }
    if (sets.length === 0) return;
    vals.push(id);
    sqlite.prepare(`UPDATE direct_calls SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

function getDirectCallById(id) {
    return sqlite.prepare('SELECT * FROM direct_calls WHERE id = ?').get(id) || null;
}

function getDirectCalls(limit = 50) {
    return sqlite.prepare('SELECT * FROM direct_calls ORDER BY created_at DESC LIMIT ?').all(limit);
}

export { logDirectCall, updateDirectCall, getDirectCallById, getDirectCalls };
