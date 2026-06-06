import https from 'https';
import crypto from 'crypto';

const REGION_HOSTS = {
    us: 'https://us-api.ymcs.yealink.com',
    eu: 'https://eu-api.ymcs.yealink.com',
    au: 'https://au-api.ymcs.yealink.com',
};

let cachedToken = null;

function getBaseUrl() {
    const region = process.env.YEALINK_REGION || 'eu';
    return REGION_HOSTS[region] || REGION_HOSTS.eu;
}

function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

function getBasicAuth() {
    const clientId = process.env.YEALINK_CLIENT_ID;
    const clientSecret = process.env.YEALINK_CLIENT_SECRET;
    return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function fetchToken() {
    const baseUrl = getBaseUrl();
    const url = new URL('/v2/token', baseUrl);

    const body = JSON.stringify({ grant_type: 'client_credentials' });

    // Yealink requires legacy TLS renegotiation
    const agent = new https.Agent({
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Basic ${getBasicAuth()}`,
                'Content-Type': 'application/json',
                'timestamp': String(Date.now()),
                'nonce': generateNonce(),
                'Content-Length': Buffer.byteLength(body),
            },
            agent,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                try {
                    const data = JSON.parse(raw);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Yealink auth failed (${res.statusCode}): ${raw}`));
                        return;
                    }
                    resolve(data);
                } catch {
                    reject(new Error(`Yealink auth parse error: ${raw}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token;
    }

    const response = await fetchToken();
    const expiresIn = response.expires_in ?? 86400;

    cachedToken = {
        token: response.access_token,
        expiresAt: Date.now() + (expiresIn - 300) * 1000, // 5-min safety margin
    };

    return cachedToken.token;
}

function clearTokenCache() {
    cachedToken = null;
}

export { getAccessToken, clearTokenCache, getBaseUrl, generateNonce, REGION_HOSTS };
