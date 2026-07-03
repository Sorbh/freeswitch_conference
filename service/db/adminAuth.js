import { sqlite } from './connection.js';

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

export {
    getAdminByEmail, getAdminById, getAllAdmins, createAdmin, updateAdmin, deleteAdmin, adminCount,
    saveRefreshToken, getRefreshToken, deleteRefreshToken, deleteRefreshTokensByAdmin, cleanExpiredRefreshTokens,
    getAllApiKeys, getApiKeyByHash, createApiKey, deleteApiKey,
};
