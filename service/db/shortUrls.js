import crypto from 'crypto';
import { sqlite } from './connection.js';

// ── Short URLs ──

function generateShortCode() {
    let code;
    do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (sqlite.prepare("SELECT 1 FROM short_urls WHERE code = ?").get(code));
    return code;
}

function createShortUrl({ code, destinationUrl, label, expiresAt }) {
    sqlite.prepare(
        'INSERT INTO short_urls (code, destination_url, label, expires_at) VALUES (?, ?, ?, ?)'
    ).run(code, destinationUrl, label || null, expiresAt || null);
    return sqlite.prepare('SELECT * FROM short_urls WHERE code = ?').get(code);
}

function getShortUrlByCode(code) {
    return sqlite.prepare('SELECT * FROM short_urls WHERE code = ?').get(code);
}

function getAllShortUrls() {
    return sqlite.prepare('SELECT * FROM short_urls ORDER BY created_at DESC').all();
}

function updateShortUrl(id, fields) {
    const allowed = ['destination_url', 'label', 'expires_at'];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key) && val !== undefined) {
            sets.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (sets.length === 0) return null;
    values.push(id);
    sqlite.prepare(`UPDATE short_urls SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return sqlite.prepare('SELECT * FROM short_urls WHERE id = ?').get(id);
}

function deleteShortUrl(id) {
    sqlite.prepare('DELETE FROM short_urls WHERE id = ?').run(id);
}

function incrementShortUrlClicks(code) {
    sqlite.prepare('UPDATE short_urls SET clicks = clicks + 1 WHERE code = ?').run(code);
}

export {
    generateShortCode, createShortUrl, getShortUrlByCode, getAllShortUrls,
    updateShortUrl, deleteShortUrl, incrementShortUrlClicks,
};
