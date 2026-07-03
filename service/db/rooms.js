import { sqlite } from './connection.js';

function getAllRooms() {
    return sqlite.prepare('SELECT * FROM rooms ORDER BY id').all();
}

function getRoom(id) {
    return sqlite.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

function createRoom(id, name, shortCode, timezone) {
    sqlite.prepare('INSERT INTO rooms (id, name, short_code, timezone) VALUES (?, ?, ?, ?)').run(id, name, shortCode, timezone || 'America/Chicago');
    _refreshRoomConfig();
    return getRoom(id);
}

function updateRoom(id, fields) {
    const sets = [];
    const vals = [];
    if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.short_code !== undefined) { sets.push('short_code = ?'); vals.push(fields.short_code); }
    if (fields.caller_id_template !== undefined) { sets.push('caller_id_template = ?'); vals.push(fields.caller_id_template); }
    if (fields.ymcs_site_id !== undefined) { sets.push('ymcs_site_id = ?'); vals.push(fields.ymcs_site_id); }
    if (fields.ymcs_parent_site_id !== undefined) { sets.push('ymcs_parent_site_id = ?'); vals.push(fields.ymcs_parent_site_id); }
    if (fields.ymcs_group_id !== undefined) { sets.push('ymcs_group_id = ?'); vals.push(fields.ymcs_group_id); }
    if (fields.timezone !== undefined) { sets.push('timezone = ?'); vals.push(fields.timezone); }
    if (fields.auto_transcribe !== undefined) { sets.push('auto_transcribe = ?'); vals.push(fields.auto_transcribe ? 1 : 0); }
    if (sets.length === 0) return null;
    vals.push(id);
    sqlite.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    _refreshRoomConfig();
    return getRoom(id);
}

function deleteRoom(id) {
    sqlite.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    _refreshRoomConfig();
}

function _refreshRoomConfig() {
    const rows = getAllRooms();
    const names = {};
    const codes = {};
    for (const r of rows) {
        names[r.id] = r.name;
        codes[r.id] = r.short_code;
    }
    if (global.config) {
        global.config.ROOM_NAME = names;
        global.config.ROOM_SHORT_CODE = codes;
    }
}

export { getAllRooms, getRoom, createRoom, updateRoom, deleteRoom, _refreshRoomConfig };
