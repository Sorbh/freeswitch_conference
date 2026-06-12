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
eventEmitter.setMaxListeners(50);

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
            last_seen INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS broadcast_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room INTEGER,
            room_name TEXT,
            user_name TEXT,
            display_name TEXT,
            transcription TEXT,
            duration_ms INTEGER,
            answered INTEGER DEFAULT 0,
            responded_by TEXT,
            participants TEXT,
            participant_count INTEGER DEFAULT 0,
            recording_path TEXT,
            response_time_ms INTEGER,
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

        CREATE TABLE IF NOT EXISTS room_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room INTEGER NOT NULL,
            online_count INTEGER NOT NULL,
            in_call_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_room_snapshots_room ON room_snapshots(room);
        CREATE INDEX IF NOT EXISTS idx_room_snapshots_created ON room_snapshots(created_at);
    `);

    const broadcastCols = sqlite.prepare("PRAGMA table_info(broadcast_log)").all().map(c => c.name);
    const migrations = [
        ['room_name', "ALTER TABLE broadcast_log ADD COLUMN room_name TEXT"],
        ['responded_by', "ALTER TABLE broadcast_log ADD COLUMN responded_by TEXT"],
        ['participants', "ALTER TABLE broadcast_log ADD COLUMN participants TEXT"],
        ['participant_count', "ALTER TABLE broadcast_log ADD COLUMN participant_count INTEGER DEFAULT 0"],
        ['recording_path', "ALTER TABLE broadcast_log ADD COLUMN recording_path TEXT"],
        ['response_time_ms', "ALTER TABLE broadcast_log ADD COLUMN response_time_ms INTEGER"],
    ];
    for (const [col, sql] of migrations) {
        if (!broadcastCols.includes(col)) sqlite.exec(sql);
    }

    const userCols = sqlite.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    const userMigrations = [
        ['client_type', "ALTER TABLE users ADD COLUMN client_type TEXT DEFAULT 'unknown'"],
        ['registration_state', "ALTER TABLE users ADD COLUMN registration_state TEXT DEFAULT 'unregistered'"],
        ['reachable', "ALTER TABLE users ADD COLUMN reachable INTEGER DEFAULT 0"],
        ['last_seen', "ALTER TABLE users ADD COLUMN last_seen INTEGER"],
        ['err_fallback_stage', "ALTER TABLE users ADD COLUMN err_fallback_stage INTEGER DEFAULT 0"],
        ['err_fallback_at', "ALTER TABLE users ADD COLUMN err_fallback_at INTEGER"],
    ];
    for (const [col, sql] of userMigrations) {
        if (!userCols.includes(col)) sqlite.exec(sql);
    }

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            display_name TEXT,
            company_name TEXT,
            company_address TEXT,
            city TEXT,
            state TEXT,
            zip TEXT,
            room INTEGER,
            active INTEGER DEFAULT 1,
            critical INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
    `);

    const accountCols = sqlite.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
    const accountMigrations = [
        ['critical', "ALTER TABLE accounts ADD COLUMN critical INTEGER DEFAULT 0"],
        ['user_name', "ALTER TABLE accounts ADD COLUMN user_name TEXT"],
        ['kickout', "ALTER TABLE accounts ADD COLUMN kickout INTEGER DEFAULT 0"],
        ['company_phone', "ALTER TABLE accounts ADD COLUMN company_phone TEXT"],
        ['ymcs_account_id', "ALTER TABLE accounts ADD COLUMN ymcs_account_id TEXT"],
        ['sip_server_host', "ALTER TABLE accounts ADD COLUMN sip_server_host TEXT"],
        ['sip_server_port', "ALTER TABLE accounts ADD COLUMN sip_server_port TEXT"],
        ['debug', "ALTER TABLE accounts ADD COLUMN debug INTEGER DEFAULT 0"],
    ];
    for (const [col, sql] of accountMigrations) {
        if (!accountCols.includes(col)) sqlite.exec(sql);
    }

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            short_code TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);

    const roomCols = sqlite.prepare("PRAGMA table_info(rooms)").all().map(c => c.name);
    const roomMigrations = [
        ['ymcs_site_id', "ALTER TABLE rooms ADD COLUMN ymcs_site_id TEXT"],
        ['ymcs_parent_site_id', "ALTER TABLE rooms ADD COLUMN ymcs_parent_site_id TEXT"],
        ['timezone', "ALTER TABLE rooms ADD COLUMN timezone TEXT DEFAULT 'America/Chicago'"],
    ];
    for (const [col, sql] of roomMigrations) {
        if (!roomCols.includes(col)) sqlite.exec(sql);
    }

    _refreshRoomConfig();

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS notification_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL DEFAULT 'telegram',
            label TEXT,
            bot_token TEXT,
            chat_id TEXT,
            room INTEGER,
            message_template TEXT,
            send_answered INTEGER DEFAULT 1,
            send_unanswered INTEGER DEFAULT 1,
            enabled INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);

    const ncCols = sqlite.prepare("PRAGMA table_info(notification_channels)").all().map(c => c.name);
    if (!ncCols.includes('message_template')) {
        sqlite.exec("ALTER TABLE notification_channels ADD COLUMN message_template TEXT");
    }

    console.log(`SQLite database initialized at ${DB_PATH}`);
}


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
    if (fields.timezone !== undefined) { sets.push('timezone = ?'); vals.push(fields.timezone); }
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
                room = ?, current_room = ?, connection_state = ?, auth_state = ?, mute = ?,
                online = ?, payment = ?, retry_count = ?, login_expire = ?,
                last_connection_state_update = ?, fs_channel_uuid = ?, fs_member_id = ?,
                caller_id_name = ?, caller_id_html = ?, user_agent = ?, error = ?,
                redline_data = ?, client_type = ?, registration_state = ?, reachable = ?,
                err_fallback_stage = ?, err_fallback_at = ?,
                last_seen = COALESCE(?, last_seen),
                updated_at = strftime('%s', 'now')
            WHERE user_name = ?
        `).run(
            userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.currentRoom || userInfo.room, userInfo.connectionState, userInfo.authState, userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData,
            userInfo.clientType || 'unknown',
            userInfo.registrationState || 'unregistered',
            userInfo.reachable ? 1 : 0,
            userInfo.errFallbackStage || 0, userInfo.errFallbackAt || null,
            userInfo.lastSeen || null,
            userName
        );
    } else {
        sqlite.prepare(`
            INSERT INTO users (
                user_name, user_id, contact, mac, ip, port,
                room, current_room, connection_state, auth_state, mute,
                online, payment, retry_count, login_expire,
                last_connection_state_update, fs_channel_uuid, fs_member_id,
                caller_id_name, caller_id_html, user_agent, error, redline_data, client_type,
                registration_state, reachable, err_fallback_stage, err_fallback_at, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userName, userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.currentRoom || userInfo.room, userInfo.connectionState || 'ideal', userInfo.authState || 'logout', userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData,
            userInfo.clientType || 'unknown',
            userInfo.registrationState || 'unregistered',
            userInfo.reachable ? 1 : 0,
            userInfo.errFallbackStage || 0, userInfo.errFallbackAt || null,
            userInfo.lastSeen || null
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const talkingUsers = global.freeswitch?.getTalkingUsers?.() || new Set();
    const email = userName.replace(/^sip:/, '');
    const acct = getAccountByEmail(email);
    eventEmitter.emit('USER_UPDATE', {
        type: 'user_update', userName, ...userInfo,
        talking: talkingUsers.has(userName),
        last_seen: userInfo.lastSeen || userInfo.updatedAt || userInfo.createdAt,
        online_duration: userInfo.online && userInfo.lastConnectionStateUpdate ? now - userInfo.lastConnectionStateUpdate : 0,
        _kickout: acct?.kickout ?? null,
        _active: acct?.active ?? null,
    });
}

function touchLastSeen(userName) {
    sqlite.prepare('UPDATE users SET last_seen = strftime(\'%s\', \'now\') WHERE user_name = ?').run(userName);
}

function updateUserInfo(userName, updates) {
    const userInfo = getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;
    Object.assign(userInfo, updates);
    setUserInfo(userName, userInfo);
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
        currentRoom: row.current_room,
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
        clientType: row.client_type || 'unknown',
        registrationState: row.registration_state || 'unregistered',
        reachable: !!row.reachable,
        lastSeen: row.last_seen,
        errFallbackStage: row.err_fallback_stage || 0,
        errFallbackAt: row.err_fallback_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

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

function logBroadcast({ room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs }) {
    sqlite.prepare(`
        INSERT INTO broadcast_log (room, room_name, user_name, display_name, duration_ms, answered, responded_by, participants, participant_count, recording_path, response_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(room, roomName, userName, displayName, durationMs, answered ? 1 : 0, respondedBy, JSON.stringify(participants), participantCount, recordingPath, responseTimeMs);
    eventEmitter.emit('BROADCAST', { room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs, created_at: Math.floor(Date.now() / 1000) });
    eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'broadcasts' });
    eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'dashboard' });
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

    return { hourly, daily, topBroadcasters, byRoom };
}

function getRecentBroadcasts(limit = 10) {
    return sqlite.prepare(`
        SELECT id, room, room_name, user_name, display_name, duration_ms, answered, responded_by, participant_count, recording_path, created_at
        FROM broadcast_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
}

function getPaginatedBroadcasts({ page = 1, pageSize = 25, room, answered, dateFrom, dateTo } = {}) {
    const conditions = [];
    const params = [];

    if (room) { conditions.push('room = ?'); params.push(room); }
    if (answered === 1 || answered === 0) { conditions.push('answered = ?'); params.push(answered); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = sqlite.prepare(`SELECT COUNT(*) as count FROM broadcast_log ${where}`).get(...params).count;
    const offset = (page - 1) * pageSize;

    const rows = sqlite.prepare(`
        SELECT id, room, room_name, user_name, display_name, duration_ms, answered, responded_by, participant_count, recording_path, response_time_ms, created_at
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

function getTimelineBroadcasts(minutes = 30) {
    const since = Math.floor(Date.now() / 1000) - (minutes * 60);
    return sqlite.prepare(`
        SELECT room, created_at, duration_ms, answered
        FROM broadcast_log WHERE created_at >= ?
        ORDER BY created_at ASC
    `).all(since);
}

function createAccount({ email, password, displayName, companyName, companyAddress, city, state, zip, room, critical, userName, companyPhone, ymcsAccountId }) {
    sqlite.prepare(`
        INSERT INTO accounts (email, password, display_name, company_name, company_address, city, state, zip, room, critical, user_name, company_phone, ymcs_account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(email, password, displayName, companyName, companyAddress, city, state, zip, room, critical ? 1 : 0, userName || null, companyPhone || null, ymcsAccountId || null);
    return sqlite.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
}

function getAccountByEmail(email) {
    return sqlite.prepare('SELECT * FROM accounts WHERE email = ?').get(email) || null;
}

function getAccountByUserName(userName) {
    return sqlite.prepare('SELECT * FROM accounts WHERE user_name = ?').get(userName) || null;
}

function getAccountById(id) {
    return sqlite.prepare('SELECT * FROM accounts WHERE id = ?').get(id) || null;
}

function getAllAccounts() {
    return sqlite.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
}

function updateAccount(id, fields) {
    const allowed = ['email', 'password', 'display_name', 'company_name', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'critical', 'user_name', 'kickout', 'company_phone', 'ymcs_account_id', 'ymcs_device_id', 'sip_server_host', 'sip_server_port', 'debug'];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key) && val !== undefined) {
            sets.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (sets.length === 0) return null;
    sets.push("updated_at = strftime('%s', 'now')");
    values.push(id);
    sqlite.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return sqlite.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

function deleteAccount(id) {
    sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

function getAllNotificationChannels() {
    return sqlite.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all();
}

function getNotificationChannel(id) {
    return sqlite.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id) || null;
}

function createNotificationChannel({ type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled }) {
    sqlite.prepare(`
        INSERT INTO notification_channels (type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type || 'telegram', label || null, bot_token, chat_id, room || null, message_template || null, send_answered ?? 1, send_unanswered ?? 1, enabled ?? 1);
    return sqlite.prepare('SELECT * FROM notification_channels ORDER BY id DESC LIMIT 1').get();
}

function updateNotificationChannel(id, fields) {
    const allowed = ['type', 'label', 'bot_token', 'chat_id', 'room', 'message_template', 'send_answered', 'send_unanswered', 'enabled'];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key) && val !== undefined) {
            sets.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (sets.length === 0) return null;
    sets.push("updated_at = strftime('%s', 'now')");
    values.push(id);
    sqlite.prepare(`UPDATE notification_channels SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getNotificationChannel(id);
}

function deleteNotificationChannel(id) {
    sqlite.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);
}

function getEnabledNotificationChannels(room, answered) {
    let rows = sqlite.prepare('SELECT * FROM notification_channels WHERE enabled = 1').all();
    return rows.filter(ch => {
        if (ch.room && ch.room !== room) return false;
        if (answered && !ch.send_answered) return false;
        if (!answered && !ch.send_unanswered) return false;
        return true;
    });
}

db.init = init;
db.getUserInfo = getUserInfo;
db.setUserInfo = setUserInfo;
db.updateUserInfo = updateUserInfo;
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
db.logBroadcast = logBroadcast;
db.getBroadcastStats = getBroadcastStats;
db.getRecentBroadcasts = getRecentBroadcasts;
db.getPaginatedBroadcasts = getPaginatedBroadcasts;
db.createAccount = createAccount;
db.getAccountByEmail = getAccountByEmail;
db.getAccountByUserName = getAccountByUserName;
db.getAccountById = getAccountById;
db.getAllAccounts = getAllAccounts;
db.updateAccount = updateAccount;
db.deleteAccount = deleteAccount;
db.touchLastSeen = touchLastSeen;
db.getTimelineBroadcasts = getTimelineBroadcasts;
db.getHourlyBroadcasts = getHourlyBroadcasts;
db.getRoomAvailability = getRoomAvailability;
db.snapshotRoomCounts = snapshotRoomCounts;
db.getRoomSnapshots = getRoomSnapshots;
db.cleanOldSnapshots = cleanOldSnapshots;
db.getAllRooms = getAllRooms;
db.getRoom = getRoom;
db.createRoom = createRoom;
db.updateRoom = updateRoom;
db.deleteRoom = deleteRoom;
db.getAllNotificationChannels = getAllNotificationChannels;
db.getNotificationChannel = getNotificationChannel;
db.createNotificationChannel = createNotificationChannel;
db.updateNotificationChannel = updateNotificationChannel;
db.deleteNotificationChannel = deleteNotificationChannel;
db.getEnabledNotificationChannels = getEnabledNotificationChannels;

export default { db };
