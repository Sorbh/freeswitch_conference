import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { logSystem } from './logger.js';

const SITE_HOST = 'hotlinehq.online';
const CREDENTIALS_PATH = new URL('../credentials/gsc-credentials.json', import.meta.url);
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';

let cachedToken = null;
let cachedTokenExp = 0;

async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < cachedTokenExp - 60) return cachedToken;

    const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
    const assertion = jwt.sign(
        { iss: creds.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        creds.private_key,
        { algorithm: 'RS256' }
    );

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`token ${res.status}`);
    const data = await res.json();
    cachedToken = data.access_token;
    cachedTokenExp = now + (data.expires_in || 3600);
    return cachedToken;
}

export async function pingGoogleIndexing(urlPath) {
    const url = `https://${SITE_HOST}${urlPath}`;
    try {
        const token = await getAccessToken();
        const res = await fetch(PUBLISH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url, type: 'URL_UPDATED' }),
            signal: AbortSignal.timeout(10000),
        });
        logSystem('GOOGLE_INDEX', `${res.status} ${urlPath}`);
    } catch (err) {
        logSystem('GOOGLE_INDEX', `Failed ${urlPath}: ${err.message}`);
    }
}
