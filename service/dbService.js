import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'freeswitch_conference.db');

const db = {};
let sqlite;
const eventEmitter = new EventEmitter();

function init() {
    sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_name TEXT PRIMARY KEY,
            user_id INTEGER,
            contact TEXT,
            mac TEXT UNIQUE,
            ip TEXT,
            port INTEGER,
            room INTEGER,
            connection_state TEXT DEFAULT 'ideal',
            auth_state TEXT DEFAULT 'logout',
            mute INTEGER DEFAULT 1,
            online INTEGER DEFAULT 0,
            payment INTEGER DEFAULT 0,
            retry_count INTEGER DEFAULT 0,
            login_expire INTEGER,
            last_connection_state_update INTEGER,
            fs_channel_uuid TEXT,
            fs_member_id TEXT,
            caller_id_name TEXT,
            caller_id_html TEXT,
            user_agent TEXT,
            error TEXT,
            redline_data TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS broadcast_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room INTEGER,
            user_name TEXT,
            display_name TEXT,
            transcription TEXT,
            duration_ms INTEGER,
            answered INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_users_mac ON users(mac);
        CREATE INDEX IF NOT EXISTS idx_users_room ON users(room);
        CREATE INDEX IF NOT EXISTS idx_users_connection_state ON users(connection_state);
        CREATE INDEX IF NOT EXISTS idx_broadcast_room_date ON broadcast_log(room, created_at);

        CREATE TABLE IF NOT EXISTS event_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            user_name TEXT,
            room INTEGER,
            details TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS online_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_online_history_user ON online_history(user_name);
        CREATE INDEX IF NOT EXISTS idx_online_history_created ON online_history(created_at);
    `);

    console.log(`SQLite database initialized at ${DB_PATH}`);
}

function getUserInfo(userName) {
    const row = sqlite.prepare('SELECT * FROM users WHERE user_name = ?').get(userName);
    if (!row) return {};
    return _rowToUserInfo(row);
}

function setUserInfo(userName, userInfo) {
    const existing = sqlite.prepare('SELECT user_name FROM users WHERE user_name = ?').get(userName);

    if (existing) {
        sqlite.prepare(`
            UPDATE users SET
                user_id = ?, contact = ?, mac = ?, ip = ?, port = ?,
                room = ?, connection_state = ?, auth_state = ?, mute = ?,
                online = ?, payment = ?, retry_count = ?, login_expire = ?,
                last_connection_state_update = ?, fs_channel_uuid = ?, fs_member_id = ?,
                caller_id_name = ?, caller_id_html = ?, user_agent = ?, error = ?,
                redline_data = ?, updated_at = strftime('%s', 'now')
            WHERE user_name = ?
        `).run(
            userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.connectionState, userInfo.authState, userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData,
            userName
        );
    } else {
        sqlite.prepare(`
            INSERT INTO users (
                user_name, user_id, contact, mac, ip, port,
                room, connection_state, auth_state, mute,
                online, payment, retry_count, login_expire,
                last_connection_state_update, fs_channel_uuid, fs_member_id,
                caller_id_name, caller_id_html, user_agent, error, redline_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userName, userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.connectionState || 'ideal', userInfo.authState || 'logout', userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData
        );
    }

    eventEmitter.emit('USER_UPDATE', { userName, ...userInfo });
}

function getAllUserInfo() {
    const rows = sqlite.prepare('SELECT * FROM users').all();
    return rows.map(_rowToUserInfo);
}

function findUserInfo(key, value) {
    const columnMap = { mac: 'mac', room: 'room', userId: 'user_id' };
    const column = columnMap[key];

    if (column) {
        const row = sqlite.prepare(`SELECT * FROM users WHERE ${column} = ?`).get(value);
        return row ? _rowToUserInfo(row) : {};
    }

    const rows = sqlite.prepare('SELECT * FROM users').all();
    for (const row of rows) {
        const userInfo = _rowToUserInfo(row);
        if (userInfo[key] == value) return userInfo;
    }

    console.error(`No Matching Keys ${key} & Values ${value}`);
    return {};
}

function filter(callback) {
    const rows = sqlite.prepare('SELECT * FROM users').all();
    return rows.map(_rowToUserInfo).filter(callback);
}

function deleteUserInfo(userName) {
    sqlite.prepare('DELETE FROM users WHERE user_name = ?').run(userName);
}

function resetAllConnectionStates() {
    sqlite.prepare(`
        UPDATE users SET
            connection_state = 'ideal',
            fs_channel_uuid = NULL,
            fs_member_id = NULL,
            mute = 1,
            online = 0,
            updated_at = strftime('%s', 'now')
    `).run();
    console.log('All user connection states reset to ideal');
}

function getTableInfo(tableName) {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    return { count: count.count, rows };
}

function getTables() {
    return sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
}

function rawQuery(sql) {
    return sqlite.prepare(sql).all();
}

function _rowToUserInfo(row) {
    let redlineData = row.redline_data;
    try {
        if (typeof redlineData === 'string') redlineData = JSON.parse(redlineData);
    } catch { }

    return {
        userName: row.user_name,
        userId: row.user_id,
        contact: row.contact,
        mac: row.mac,
        ip: row.ip,
        port: row.port,
        room: row.room,
        connectionState: row.connection_state,
        authState: row.auth_state,
        mute: !!row.mute,
        online: !!row.online,
        payment: !!row.payment,
        retryCount: row.retry_count,
        login_expire: row.login_expire,
        lastConnectionStateUpdate: row.last_connection_state_update,
        fsChannelUUID: row.fs_channel_uuid,
        fsMemberId: row.fs_member_id,
        callerIdName: row.caller_id_name,
        callerIdHtml: row.caller_id_html,
        userAgent: row.user_agent,
        error: row.error,
        redlineData: redlineData,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function logEvent(eventType, userName, room, details) {
    sqlite.prepare('INSERT INTO event_log (event_type, user_name, room, details) VALUES (?, ?, ?, ?)').run(eventType, userName, room, details);
    eventEmitter.emit('EVENT_LOG', { eventType, userName, room, details, created_at: Math.floor(Date.now() / 1000) });
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

function getBroadcastStats(days = 7) {
    const since = Math.floor(Date.now() / 1000) - (days * 86400);

    const hourly = sqlite.prepare(`
        SELECT
            CAST(strftime('%H', created_at, 'unixepoch', 'localtime') AS INTEGER) as hour,
            COUNT(*) as count
        FROM broadcast_log WHERE created_at >= ?
        GROUP BY hour ORDER BY hour
    `).all(since);

    const daily = sqlite.prepare(`
        SELECT
            strftime('%Y-%m-%d', created_at, 'unixepoch', 'localtime') as day,
            COUNT(*) as total,
            SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) as answered
        FROM broadcast_log WHERE created_at >= ?
        GROUP BY day ORDER BY day
    `).all(since);

    const topBroadcasters = sqlite.prepare(`
        SELECT user_name, display_name, COUNT(*) as count
        FROM broadcast_log WHERE created_at >= ?
        GROUP BY user_name ORDER BY count DESC LIMIT 10
    `).all(since);

    const byRoom = sqlite.prepare(`
        SELECT room, COUNT(*) as count
        FROM broadcast_log WHERE created_at >= ?
        GROUP BY room ORDER BY count DESC
    `).all(since);

    return { hourly, daily, topBroadcasters, byRoom };
}

db.init = init;
db.getUserInfo = getUserInfo;
db.setUserInfo = setUserInfo;
db.getAllUserInfo = getAllUserInfo;
db.findUserInfo = findUserInfo;
db.filter = filter;
db.deleteUserInfo = deleteUserInfo;
db.resetAllConnectionStates = resetAllConnectionStates;
db.getTableInfo = getTableInfo;
db.getTables = getTables;
db.rawQuery = rawQuery;
db.eventEmitter = eventEmitter;
db.logEvent = logEvent;
db.getEvents = getEvents;
db.logOnlineStatus = logOnlineStatus;
db.getOnlineHistory = getOnlineHistory;
db.getDashboardStats = getDashboardStats;
db.getBroadcastStats = getBroadcastStats;

export default { db };
