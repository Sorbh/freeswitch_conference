import { sqlite } from './connection.js';

// ── Audio Ads (Network Announcements) ──

function getAllAudioAds() {
    return sqlite.prepare('SELECT * FROM audio_ads ORDER BY created_at DESC').all();
}

function getAudioAd(id) {
    return sqlite.prepare('SELECT * FROM audio_ads WHERE id = ?').get(id);
}

function createAudioAd({ label, audio_path, original_filename, rooms, duration_ms, schedule_times, timezone, schedule_type, interval_minutes, window_start, window_end }) {
    const result = sqlite.prepare(
        'INSERT INTO audio_ads (label, audio_path, original_filename, rooms, duration_ms, schedule_times, timezone, schedule_type, interval_minutes, window_start, window_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(label, audio_path, original_filename, JSON.stringify(rooms || []), duration_ms || 0, JSON.stringify(schedule_times || []), timezone || 'America/Phoenix', schedule_type || 'times', interval_minutes || 0, window_start || null, window_end || null);
    return getAudioAd(result.lastInsertRowid);
}

function updateAudioAd(id, fields) {
    const allowed = ['label', 'rooms', 'enabled', 'audio_path', 'original_filename', 'duration_ms', 'schedule_times', 'timezone', 'schedule_type', 'interval_minutes', 'window_start', 'window_end'];
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
        if (!allowed.includes(key)) continue;
        updates.push(`${key} = ?`);
        values.push((key === 'rooms' || key === 'schedule_times') ? JSON.stringify(val) : val);
    }
    if (updates.length === 0) return getAudioAd(id);
    updates.push('updated_at = strftime(\'%s\', \'now\')');
    values.push(id);
    sqlite.prepare(`UPDATE audio_ads SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return getAudioAd(id);
}

function deleteAudioAd(id) {
    sqlite.prepare('DELETE FROM audio_ads WHERE id = ?').run(id);
}

function logAdPlay({ ad_id, room, started_at, duration_played_ms, completed, interrupted_by, listener_count }) {
    sqlite.prepare(
        'INSERT INTO ad_play_log (ad_id, room, started_at, duration_played_ms, completed, interrupted_by, listener_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(ad_id, room, started_at, duration_played_ms || 0, completed ? 1 : 0, interrupted_by || null, listener_count || 0);
}

function getAdPlayLog({ ad_id, page = 1, pageSize = 25 } = {}) {
    const where = ad_id ? 'WHERE ad_id = ?' : '';
    const params = ad_id ? [ad_id] : [];
    const total = sqlite.prepare(`SELECT COUNT(*) as count FROM ad_play_log ${where}`).get(...params).count;
    const offset = (page - 1) * pageSize;
    const rows = sqlite.prepare(
        `SELECT p.*, a.label as ad_label FROM ad_play_log p LEFT JOIN audio_ads a ON p.ad_id = a.id ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);
    return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function getAdStats(adId) {
    const row = sqlite.prepare(`
        SELECT COUNT(*) as total_plays,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as interrupted,
            ROUND(AVG(duration_played_ms)) as avg_duration_ms,
            SUM(listener_count) as total_impressions
        FROM ad_play_log WHERE ad_id = ?
    `).get(adId);
    return row || { total_plays: 0, completed: 0, interrupted: 0, avg_duration_ms: 0, total_impressions: 0 };
}

function getScheduledAds() {
    return sqlite.prepare("SELECT * FROM audio_ads WHERE enabled = 1 AND ((schedule_times != '[]' AND schedule_times IS NOT NULL) OR (schedule_type = 'interval' AND interval_minutes > 0))").all();
}

export {
    getAllAudioAds, getAudioAd, createAudioAd, updateAudioAd, deleteAudioAd,
    logAdPlay, getAdPlayLog, getAdStats, getScheduledAds,
};
