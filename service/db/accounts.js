import crypto from 'crypto';
import { sqlite } from './connection.js';

function createAccount({ email, password, displayName, companyName, companyAddress, city, state, zip, room, critical, userName, companyPhone, ymcsAccountId, extension }) {
    const referralCode = generateReferralCode();
    sqlite.prepare(`
        INSERT INTO accounts (email, password, display_name, company_name, company_address, city, state, zip, room, critical, user_name, company_phone, ymcs_account_id, extension, referral_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(email, password, displayName, companyName, companyAddress, city, state, zip, room, critical ? 1 : 0, userName || null, companyPhone || null, ymcsAccountId || null, extension || null, referralCode);
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
    const allowed = ['email', 'password', 'display_name', 'company_name', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'critical', 'user_name', 'kickout', 'company_phone', 'ymcs_account_id', 'ymcs_device_id', 'ymcs_config_id', 'sip_server_host', 'sip_server_port', 'debug', 'extension', 'password_hash', 'email_verified', 'verification_token', 'verification_token_expires', 'reset_token', 'reset_token_expires', 'signup_source', 'referral_code', 'referred_by'];
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

function generateReferralCode() {
    let code;
    do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (sqlite.prepare("SELECT 1 FROM accounts WHERE referral_code = ?").get(code));
    return code;
}

function getAccountByReferralCode(code) {
    return sqlite.prepare('SELECT * FROM accounts WHERE referral_code = ?').get(code) || null;
}

function getReferralCount(accountId) {
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM accounts WHERE referred_by = ?').get(accountId);
    return row ? row.count : 0;
}

function getReferrals(accountId) {
    return sqlite.prepare('SELECT id, email, company_name, display_name, created_at FROM accounts WHERE referred_by = ? ORDER BY created_at DESC').all(accountId);
}

function getActiveAccountsByRoom(room) {
    return sqlite.prepare(
        'SELECT id, email, push_parts_requests, push_direct_calls FROM accounts WHERE room = ? AND active = 1'
    ).all(room);
}

function setAccountPushPrefs(id, prefs) {
    const sets = [];
    const vals = [];
    if (prefs.parts_requests !== undefined) { sets.push('push_parts_requests = ?'); vals.push(prefs.parts_requests ? 1 : 0); }
    if (prefs.direct_calls !== undefined) { sets.push('push_direct_calls = ?'); vals.push(prefs.direct_calls ? 1 : 0); }
    if (!sets.length) return;
    vals.push(id);
    sqlite.prepare(`UPDATE accounts SET ${sets.join(', ')}, updated_at = strftime('%s', 'now') WHERE id = ?`).run(...vals);
}

export {
    createAccount, getAccountByEmail, getAccountByUserName, getAccountById,
    getAccountByExtension, getAllAccounts, updateAccount,
    getAccountByVerificationToken, getAccountByResetToken, deleteAccount,
    generateReferralCode, getAccountByReferralCode, getReferralCount, getReferrals,
    getActiveAccountsByRoom, setAccountPushPrefs,
};
