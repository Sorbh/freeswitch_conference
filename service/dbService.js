import crypto from 'crypto';
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
        CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_share_token ON broadcast_log(share_token) WHERE share_token IS NOT NULL;

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

        CREATE TABLE IF NOT EXISTS audio_ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            audio_path TEXT NOT NULL,
            original_filename TEXT,
            rooms TEXT DEFAULT '[]',
            duration_ms INTEGER DEFAULT 0,
            enabled INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS ad_play_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ad_id INTEGER NOT NULL,
            room INTEGER,
            started_at INTEGER,
            duration_played_ms INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            interrupted_by TEXT,
            listener_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ad_play_log_ad ON ad_play_log(ad_id);
        CREATE INDEX IF NOT EXISTS idx_ad_play_log_created ON ad_play_log(created_at);
    `);

    const adCols = sqlite.prepare("PRAGMA table_info(audio_ads)").all().map(c => c.name);
    const adMigrations = [
        ['schedule_times', "ALTER TABLE audio_ads ADD COLUMN schedule_times TEXT DEFAULT '[]'"],
        ['timezone', "ALTER TABLE audio_ads ADD COLUMN timezone TEXT DEFAULT 'America/Phoenix'"],
        ['schedule_type', "ALTER TABLE audio_ads ADD COLUMN schedule_type TEXT DEFAULT 'times'"],
        ['interval_minutes', "ALTER TABLE audio_ads ADD COLUMN interval_minutes INTEGER DEFAULT 0"],
        ['window_start', "ALTER TABLE audio_ads ADD COLUMN window_start TEXT"],
        ['window_end', "ALTER TABLE audio_ads ADD COLUMN window_end TEXT"],
    ];
    for (const [col, sql] of adMigrations) {
        if (!adCols.includes(col)) sqlite.exec(sql);
    }

    const broadcastCols = sqlite.prepare("PRAGMA table_info(broadcast_log)").all().map(c => c.name);
    const migrations = [
        ['room_name', "ALTER TABLE broadcast_log ADD COLUMN room_name TEXT"],
        ['responded_by', "ALTER TABLE broadcast_log ADD COLUMN responded_by TEXT"],
        ['participants', "ALTER TABLE broadcast_log ADD COLUMN participants TEXT"],
        ['participant_count', "ALTER TABLE broadcast_log ADD COLUMN participant_count INTEGER DEFAULT 0"],
        ['recording_path', "ALTER TABLE broadcast_log ADD COLUMN recording_path TEXT"],
        ['response_time_ms', "ALTER TABLE broadcast_log ADD COLUMN response_time_ms INTEGER"],
        ['share_token', "ALTER TABLE broadcast_log ADD COLUMN share_token TEXT"],
        ['listener_count', "ALTER TABLE broadcast_log ADD COLUMN listener_count INTEGER DEFAULT 0"],
        ['part_details', "ALTER TABLE broadcast_log ADD COLUMN part_details TEXT"],
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
        ['extension', "ALTER TABLE accounts ADD COLUMN extension INTEGER"],
        ['ymcs_config_id', "ALTER TABLE accounts ADD COLUMN ymcs_config_id TEXT"],
        ['password_hash', "ALTER TABLE accounts ADD COLUMN password_hash TEXT"],
        ['email_verified', "ALTER TABLE accounts ADD COLUMN email_verified INTEGER DEFAULT 0"],
        ['verification_token', "ALTER TABLE accounts ADD COLUMN verification_token TEXT"],
        ['verification_token_expires', "ALTER TABLE accounts ADD COLUMN verification_token_expires INTEGER"],
        ['reset_token', "ALTER TABLE accounts ADD COLUMN reset_token TEXT"],
        ['reset_token_expires', "ALTER TABLE accounts ADD COLUMN reset_token_expires INTEGER"],
        ['signup_source', "ALTER TABLE accounts ADD COLUMN signup_source TEXT DEFAULT 'admin'"],
    ];
    for (const [col, sql] of accountMigrations) {
        if (!accountCols.includes(col)) sqlite.exec(sql);
    }
    sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_extension ON accounts(extension) WHERE extension IS NOT NULL");

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
        ['auto_transcribe', "ALTER TABLE rooms ADD COLUMN auto_transcribe INTEGER DEFAULT 0"],
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
    if (!ncCols.includes('delivered_count')) {
        sqlite.exec("ALTER TABLE notification_channels ADD COLUMN delivered_count INTEGER DEFAULT 0");
    }
    if (!ncCols.includes('skip_no_parts')) {
        sqlite.exec("ALTER TABLE notification_channels ADD COLUMN skip_no_parts INTEGER DEFAULT 0");
    }

    // ── Direct calls table ──
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS direct_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caller_email TEXT NOT NULL,
            caller_extension INTEGER,
            caller_display_name TEXT,
            caller_company TEXT,
            caller_room INTEGER,
            caller_room_name TEXT,
            callee_email TEXT NOT NULL,
            callee_extension INTEGER,
            callee_display_name TEXT,
            callee_company TEXT,
            callee_room INTEGER,
            callee_room_name TEXT,
            status TEXT NOT NULL DEFAULT 'ringing',
            started_at INTEGER,
            answered_at INTEGER,
            ended_at INTEGER,
            duration_ms INTEGER DEFAULT 0,
            end_reason TEXT,
            recording_path TEXT,
            transcription TEXT,
            transcription_status TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_direct_calls_created ON direct_calls(created_at);
        CREATE INDEX IF NOT EXISTS idx_direct_calls_caller ON direct_calls(caller_email);
        CREATE INDEX IF NOT EXISTS idx_direct_calls_callee ON direct_calls(callee_email);
    `);

    const dcCols = sqlite.prepare("PRAGMA table_info(direct_calls)").all().map(c => c.name);
    const dcMigrations = [
        ['caller_display_name', "ALTER TABLE direct_calls ADD COLUMN caller_display_name TEXT"],
        ['caller_company', "ALTER TABLE direct_calls ADD COLUMN caller_company TEXT"],
        ['caller_room_name', "ALTER TABLE direct_calls ADD COLUMN caller_room_name TEXT"],
        ['callee_display_name', "ALTER TABLE direct_calls ADD COLUMN callee_display_name TEXT"],
        ['callee_company', "ALTER TABLE direct_calls ADD COLUMN callee_company TEXT"],
        ['callee_room_name', "ALTER TABLE direct_calls ADD COLUMN callee_room_name TEXT"],
        ['recording_path', "ALTER TABLE direct_calls ADD COLUMN recording_path TEXT"],
        ['transcription', "ALTER TABLE direct_calls ADD COLUMN transcription TEXT"],
        ['transcription_status', "ALTER TABLE direct_calls ADD COLUMN transcription_status TEXT"],
    ];
    for (const [col, sql] of dcMigrations) {
        if (!dcCols.includes(col)) sqlite.exec(sql);
    }

    // ── Settings table ──

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);

    // ── Broadcast transcription columns ──
    const bcastMigCols = sqlite.prepare("PRAGMA table_info(broadcast_log)").all().map(c => c.name);
    const bcastTransMigrations = [
        ['transcription_status', "ALTER TABLE broadcast_log ADD COLUMN transcription_status TEXT"],
        ['transcription_error', "ALTER TABLE broadcast_log ADD COLUMN transcription_error TEXT"],
        ['local_transcription', "ALTER TABLE broadcast_log ADD COLUMN local_transcription TEXT"],
        ['has_parts_request', "ALTER TABLE broadcast_log ADD COLUMN has_parts_request INTEGER"],
    ];
    for (const [col, sql] of bcastTransMigrations) {
        if (!bcastMigCols.includes(col)) sqlite.exec(sql);
    }

    // ── Auth tables ──

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'analytics',
            active INTEGER NOT NULL DEFAULT 1,
            locked_until INTEGER,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            created_by INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin ON refresh_tokens(admin_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            key_hash TEXT UNIQUE NOT NULL,
            key_prefix TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS sip_ua_blocklist (
            user_agent TEXT PRIMARY KEY,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);

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
    eventEmitter.emit('USER_SYNC', {
        type: 'user_sync', userName, ...userInfo,
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

function logBroadcast({ room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs, listenerCount }) {
    sqlite.prepare(`
        INSERT INTO broadcast_log (room, room_name, user_name, display_name, duration_ms, answered, responded_by, participants, participant_count, recording_path, response_time_ms, listener_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(room, roomName, userName, displayName, durationMs, answered ? 1 : 0, respondedBy, JSON.stringify(participants), participantCount, recordingPath, responseTimeMs, listenerCount || 0);
    eventEmitter.emit('BROADCAST_LOG', { room, roomName, userName, displayName, durationMs, answered, respondedBy, participants, participantCount, recordingPath, responseTimeMs, created_at: Math.floor(Date.now() / 1000) });
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
        SELECT id, room, room_name, user_name, display_name, duration_ms, answered, responded_by, participant_count, recording_path, response_time_ms, share_token, listener_count, transcription, transcription_status, local_transcription, has_parts_request, part_details, created_at
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

function createAccount({ email, password, displayName, companyName, companyAddress, city, state, zip, room, critical, userName, companyPhone, ymcsAccountId, extension }) {
    sqlite.prepare(`
        INSERT INTO accounts (email, password, display_name, company_name, company_address, city, state, zip, room, critical, user_name, company_phone, ymcs_account_id, extension)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(email, password, displayName, companyName, companyAddress, city, state, zip, room, critical ? 1 : 0, userName || null, companyPhone || null, ymcsAccountId || null, extension || null);
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

function getAccountByExtension(ext) {
    return sqlite.prepare('SELECT * FROM accounts WHERE extension = ?').get(ext) || null;
}

function getAllAccounts() {
    return sqlite.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
}

function updateAccount(id, fields) {
    const allowed = ['email', 'password', 'display_name', 'company_name', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'critical', 'user_name', 'kickout', 'company_phone', 'ymcs_account_id', 'ymcs_device_id', 'ymcs_config_id', 'sip_server_host', 'sip_server_port', 'debug', 'extension', 'password_hash', 'email_verified', 'verification_token', 'verification_token_expires', 'reset_token', 'reset_token_expires', 'signup_source'];
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

function getAccountByVerificationToken(token) {
    return sqlite.prepare('SELECT * FROM accounts WHERE verification_token = ?').get(token) || null;
}

function getAccountByResetToken(token) {
    return sqlite.prepare('SELECT * FROM accounts WHERE reset_token = ?').get(token) || null;
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
    const allowed = ['type', 'label', 'bot_token', 'chat_id', 'room', 'message_template', 'send_answered', 'send_unanswered', 'enabled', 'skip_no_parts'];
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

function incrementNotificationDelivered(id) {
    sqlite.prepare('UPDATE notification_channels SET delivered_count = COALESCE(delivered_count, 0) + 1 WHERE id = ?').run(id);
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

// ── Auth: Admins ──

function getAdminByEmail(email) {
    return sqlite.prepare('SELECT * FROM admins WHERE email = ?').get(email) || null;
}

function getAdminById(id) {
    return sqlite.prepare('SELECT * FROM admins WHERE id = ?').get(id) || null;
}

function getAllAdmins() {
    return sqlite.prepare('SELECT id, email, name, role, active, created_at, updated_at FROM admins ORDER BY created_at DESC').all();
}

function createAdmin({ email, passwordHash, name, role, createdBy }) {
    sqlite.prepare(
        'INSERT INTO admins (email, password_hash, name, role, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(email, passwordHash, name, role || 'analytics', createdBy || null);
    return getAdminByEmail(email);
}

function updateAdmin(id, fields) {
    const allowed = ['email', 'password_hash', 'name', 'role', 'active', 'locked_until', 'failed_attempts'];
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
    sqlite.prepare(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getAdminById(id);
}

function deleteAdmin(id) {
    sqlite.prepare('DELETE FROM refresh_tokens WHERE admin_id = ?').run(id);
    sqlite.prepare('DELETE FROM admins WHERE id = ?').run(id);
}

function adminCount() {
    return sqlite.prepare('SELECT COUNT(*) as count FROM admins').get().count;
}

// ── Auth: Refresh Tokens ──

function saveRefreshToken(adminId, tokenHash, expiresAt) {
    sqlite.prepare(
        'INSERT INTO refresh_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(adminId, tokenHash, expiresAt);
}

function getRefreshToken(tokenHash) {
    return sqlite.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) || null;
}

function deleteRefreshToken(tokenHash) {
    sqlite.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

function deleteRefreshTokensByAdmin(adminId) {
    sqlite.prepare('DELETE FROM refresh_tokens WHERE admin_id = ?').run(adminId);
}

function cleanExpiredRefreshTokens() {
    const now = Math.floor(Date.now() / 1000);
    sqlite.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
}

// ── Auth: API Keys ──

function getAllApiKeys() {
    return sqlite.prepare('SELECT id, label, key_prefix, active, created_by, created_at FROM api_keys ORDER BY created_at DESC').all();
}

function getApiKeyByHash(keyHash) {
    return sqlite.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').get(keyHash) || null;
}

function createApiKey({ label, keyHash, keyPrefix, createdBy }) {
    const result = sqlite.prepare(
        'INSERT INTO api_keys (label, key_hash, key_prefix, created_by) VALUES (?, ?, ?, ?)'
    ).run(label, keyHash, keyPrefix, createdBy);
    return sqlite.prepare('SELECT id, label, key_prefix, active, created_by, created_at FROM api_keys WHERE id = ?').get(result.lastInsertRowid);
}

function deleteApiKey(id) {
    sqlite.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
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
    return sqlite.prepare('SELECT id FROM broadcast_log WHERE recording_path = ? ORDER BY id DESC LIMIT 1').get(recordingPath) || null;
}

// ── Settings ──

function getSetting(key) {
    const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setSetting(key, value) {
    sqlite.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime(\'%s\', \'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value);
}

function getSettingsByPrefix(prefix) {
    const rows = sqlite.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all(prefix + '%');
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
}

// ── Broadcast transcription ──

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
db.getAccountByExtension = getAccountByExtension;
db.getAllAccounts = getAllAccounts;
db.updateAccount = updateAccount;
db.deleteAccount = deleteAccount;
db.getAccountByVerificationToken = getAccountByVerificationToken;
db.getAccountByResetToken = getAccountByResetToken;
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
db.incrementNotificationDelivered = incrementNotificationDelivered;
db.getAllAudioAds = getAllAudioAds;
db.getAudioAd = getAudioAd;
db.createAudioAd = createAudioAd;
db.updateAudioAd = updateAudioAd;
db.deleteAudioAd = deleteAudioAd;
db.logAdPlay = logAdPlay;
db.getAdPlayLog = getAdPlayLog;
db.getAdStats = getAdStats;
db.getScheduledAds = getScheduledAds;
db.generateBroadcastShareToken = generateBroadcastShareToken;
db.revokeBroadcastShareToken = revokeBroadcastShareToken;
db.getBroadcastByShareToken = getBroadcastByShareToken;
db.getBroadcastById = getBroadcastById;
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

db.logDirectCall = logDirectCall;
db.updateDirectCall = updateDirectCall;
db.getDirectCalls = getDirectCalls;
db.getDirectCallById = getDirectCallById;

db.getSetting = getSetting;
db.setSetting = setSetting;
db.getSettingsByPrefix = getSettingsByPrefix;
db.updateBroadcastTranscription = updateBroadcastTranscription;
db.updateBroadcastLocalTranscription = updateBroadcastLocalTranscription;
db.updateBroadcastPartDetails = updateBroadcastPartDetails;
db.getBroadcastByRecordingPath = getBroadcastByRecordingPath;
db.getAdminByEmail = getAdminByEmail;
db.getAdminById = getAdminById;
db.getAllAdmins = getAllAdmins;
db.createAdmin = createAdmin;
db.updateAdmin = updateAdmin;
db.deleteAdmin = deleteAdmin;
db.adminCount = adminCount;
db.saveRefreshToken = saveRefreshToken;
db.getRefreshToken = getRefreshToken;
db.deleteRefreshToken = deleteRefreshToken;
db.deleteRefreshTokensByAdmin = deleteRefreshTokensByAdmin;
db.cleanExpiredRefreshTokens = cleanExpiredRefreshTokens;
db.getAllApiKeys = getAllApiKeys;
db.getApiKeyByHash = getApiKeyByHash;
db.createApiKey = createApiKey;
db.deleteApiKey = deleteApiKey;

db.getBlockedUAs = () => sqlite.prepare('SELECT user_agent FROM sip_ua_blocklist ORDER BY created_at').all().map(r => r.user_agent);
db.addBlockedUA = (ua) => sqlite.prepare('INSERT OR IGNORE INTO sip_ua_blocklist (user_agent) VALUES (?)').run(ua);
db.removeBlockedUA = (ua) => sqlite.prepare('DELETE FROM sip_ua_blocklist WHERE user_agent = ?').run(ua);

export default { db };
