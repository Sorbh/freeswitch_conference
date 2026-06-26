import { createHmac } from 'crypto';

const HMAC_SECRET = process.env.LIVE_STREAM_SECRET || 'hotlinehq-livestream-secret-change-me';

export function generateLiveLink(room, roomName, durationHours) {
    const exp = Math.floor(Date.now() / 1000) + (durationHours * 3600);
    const payload = `${room}:${exp}`;
    const sig = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 32);
    const baseUrl = global.config.CLIENT_APP_URL || 'https://hotline.redlineusedautoparts.com';
    const url = `${baseUrl}/live/${room}?exp=${exp}&sig=${sig}`;
    return { url, exp, sig, room, roomName, durationHours };
}

export function validateLiveLink(room, exp, sig) {
    if (!room || !exp || !sig) return { valid: false, error: 'Missing parameters' };

    const expNum = parseInt(exp);
    if (!isFinite(expNum)) return { valid: false, error: 'Invalid expiry' };
    if (expNum < Math.floor(Date.now() / 1000)) return { valid: false, error: 'Link expired' };

    const payload = `${room}:${expNum}`;
    const expected = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 32);
    if (sig !== expected) return { valid: false, error: 'Invalid signature' };

    const createdAt = expNum - (expNum - Math.floor(Date.now() / 1000));
    return { valid: true, room: parseInt(room), exp: expNum };
}

export function getLiveWindowSeconds(exp) {
    const expNum = parseInt(exp);
    const now = Math.floor(Date.now() / 1000);
    return expNum - now;
}
