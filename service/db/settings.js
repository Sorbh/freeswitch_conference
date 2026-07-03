import { sqlite } from './connection.js';

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

// ── SIP UA blocklist ──

function getBlockedUAs() {
    return sqlite.prepare('SELECT user_agent FROM sip_ua_blocklist ORDER BY created_at').all().map(r => r.user_agent);
}

function addBlockedUA(ua) {
    return sqlite.prepare('INSERT OR IGNORE INTO sip_ua_blocklist (user_agent) VALUES (?)').run(ua);
}

function removeBlockedUA(ua) {
    return sqlite.prepare('DELETE FROM sip_ua_blocklist WHERE user_agent = ?').run(ua);
}

export { getSetting, setSetting, getSettingsByPrefix, getBlockedUAs, addBlockedUA, removeBlockedUA };
