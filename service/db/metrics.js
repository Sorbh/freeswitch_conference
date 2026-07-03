import { sqlite, eventEmitter } from './connection.js';

function logEvent(eventType, userName, room, details) {
    sqlite.prepare('INSERT INTO event_log (event_type, user_name, room, details) VALUES (?, ?, ?, ?)').run(eventType, userName, room, details);
    eventEmitter.emit('EVENT_LOG', { type: 'event_log', eventType, userName, room, details, created_at: Math.floor(Date.now() / 1000) });
}

function getEvents(limit = 100, eventType = null) {
    if (eventType) {
        return sqlite.prepare('SELECT * FROM event_log WHERE event_type = ? ORDER BY created_at DESC LIMIT ?').all(eventType, limit);
    }
    return sqlite.prepare('SELECT * FROM event_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

function logOnlineStatus(userName, status) {
    sqlite.prepare('INSERT INTO online_history (user_name, status) VALUES (?, ?)').run(userName, status);
}

function getOnlineHistory(userName, since = null) {
    if (since) {
        return sqlite.prepare('SELECT * FROM online_history WHERE user_name = ? AND created_at >= ? ORDER BY created_at ASC').all(userName, since);
    }
    return sqlite.prepare('SELECT * FROM online_history WHERE user_name = ? ORDER BY created_at DESC LIMIT 100').all(userName);
}

function getDashboardStats() {
    const total = sqlite.prepare('SELECT COUNT(*) as count FROM users').get();
    const online = sqlite.prepare('SELECT COUNT(*) as count FROM users WHERE online = 1').get();
    const inCall = sqlite.prepare('SELECT COUNT(*) as count FROM users WHERE connection_state = ?').get('connected');
    const todayStart = Math.floor(new Date().setHours(0,0,0,0) / 1000);
    const todayBroadcasts = sqlite.prepare('SELECT COUNT(*) as count FROM broadcast_log WHERE created_at >= ?').get(todayStart);
    const todayAnswered = sqlite.prepare('SELECT COUNT(*) as count FROM broadcast_log WHERE created_at >= ? AND answered = 1').get(todayStart);

    const roomStats = sqlite.prepare(`
        SELECT room,
            COUNT(*) as total,
            SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END) as online,
            SUM(CASE WHEN connection_state = 'connected' THEN 1 ELSE 0 END) as in_call,
            SUM(CASE WHEN mute = 0 THEN 1 ELSE 0 END) as unmuted
        FROM users GROUP BY room
    `).all();

    return {
        totalUsers: total.count,
        onlineUsers: online.count,
        inCallUsers: inCall.count,
        todayBroadcasts: todayBroadcasts.count,
        todayAnswered: todayAnswered.count,
        roomStats
    };
}
function snapshotRoomCounts() {
    const rows = sqlite.prepare(`
        SELECT room,
            SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END) as online_count,
            SUM(CASE WHEN connection_state = 'connected' THEN 1 ELSE 0 END) as in_call_count
        FROM users
        WHERE room IS NOT NULL
        GROUP BY room
    `).all();

    const insert = sqlite.prepare('INSERT INTO room_snapshots (room, online_count, in_call_count) VALUES (?, ?, ?)');
    for (const row of rows) {
        insert.run(row.room, row.online_count, row.in_call_count);
    }
    return rows.length;
}

function getRoomSnapshots(hours = 12) {
    const since = Math.floor(Date.now() / 1000) - (hours * 3600);
    return sqlite.prepare(`
        SELECT room, online_count, in_call_count, created_at
        FROM room_snapshots
        WHERE created_at >= ?
        ORDER BY created_at ASC
    `).all(since);
}

function cleanOldSnapshots(days = 14) {
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    sqlite.prepare('DELETE FROM room_snapshots WHERE created_at < ?').run(cutoff);
}

function getRoomAvailability(hours = 12) {
    const since = Math.floor(Date.now() / 1000) - (hours * 3600);
    return sqlite.prepare(`
        SELECT room, created_at, participant_count
        FROM broadcast_log
        WHERE created_at >= ?
        ORDER BY created_at ASC
    `).all(since);
}

export {
    logEvent, getEvents, logOnlineStatus, getOnlineHistory, getDashboardStats,
    snapshotRoomCounts, getRoomSnapshots, cleanOldSnapshots, getRoomAvailability,
};
