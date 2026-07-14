import crypto from 'crypto';
import { sqlite, open, DB_PATH } from './connection.js';
import { _refreshRoomConfig } from './rooms.js';

// All table creation + idempotent column migrations, in their original order.
export function init() {
    open();


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
        ['web_takeover', "ALTER TABLE users ADD COLUMN web_takeover INTEGER DEFAULT 0"],
        ['web_takeover_contact', "ALTER TABLE users ADD COLUMN web_takeover_contact TEXT"],
    ];
    for (const [col, sql] of userMigrations) {
        if (!userCols.includes(col)) sqlite.exec(sql);
    }

    // Backfill: cloud-STT extractions before the markBroadcastHasPartsRequest fix left
    // has_parts_request=0 despite valid part_details, hiding those marketplace listings.
    // Idempotent — matches the year+make visibility criteria used by marketplace queries.
    sqlite.exec(`
        UPDATE broadcast_log SET has_parts_request = 1
        WHERE (has_parts_request = 0 OR has_parts_request IS NULL)
          AND part_details IS NOT NULL
          AND json_extract(part_details, '$.year') IS NOT NULL AND json_extract(part_details, '$.year') != 'null'
          AND json_extract(part_details, '$.make') IS NOT NULL AND json_extract(part_details, '$.make') != 'null'
    `);

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
        ['referral_code', "ALTER TABLE accounts ADD COLUMN referral_code TEXT"],
        ['referred_by', "ALTER TABLE accounts ADD COLUMN referred_by INTEGER"],
        ['push_parts_requests', "ALTER TABLE accounts ADD COLUMN push_parts_requests INTEGER DEFAULT 1"],
        ['push_direct_calls', "ALTER TABLE accounts ADD COLUMN push_direct_calls INTEGER DEFAULT 1"],
    ];
    for (const [col, sql] of accountMigrations) {
        if (!accountCols.includes(col)) sqlite.exec(sql);
    }
    sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_extension ON accounts(extension) WHERE extension IS NOT NULL");
    sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_referral_code ON accounts(referral_code) WHERE referral_code IS NOT NULL");

    // Backfill referral codes for existing accounts
    const needCodes = sqlite.prepare("SELECT id FROM accounts WHERE referral_code IS NULL").all();
    if (needCodes.length > 0) {
        const update = sqlite.prepare("UPDATE accounts SET referral_code = ? WHERE id = ?");
        for (const { id } of needCodes) {
            let code;
            do {
                code = crypto.randomBytes(3).toString('hex').toUpperCase();
            } while (sqlite.prepare("SELECT 1 FROM accounts WHERE referral_code = ?").get(code));
            update.run(code, id);
        }
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
        ['auto_transcribe', "ALTER TABLE rooms ADD COLUMN auto_transcribe INTEGER DEFAULT 0"],
        ['ymcs_group_id', "ALTER TABLE rooms ADD COLUMN ymcs_group_id TEXT"],
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

    // ── Marketplace responses table ──

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS marketplace_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            broadcast_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            company TEXT,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT,
            ip TEXT,
            notified INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_marketplace_responses_broadcast ON marketplace_responses(broadcast_id);
        CREATE INDEX IF NOT EXISTS idx_marketplace_responses_ip ON marketplace_responses(ip, created_at);
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

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS short_urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            destination_url TEXT NOT NULL,
            label TEXT,
            clicks INTEGER DEFAULT 0,
            expires_at INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(code);
    `);

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            endpoint TEXT UNIQUE NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_push_subs_account ON push_subscriptions(account_id);
    `);

    console.log(`SQLite database initialized at ${DB_PATH}`);
}
