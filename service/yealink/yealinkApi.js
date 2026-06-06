import https from 'https';
import crypto from 'crypto';
import { getAccessToken, clearTokenCache, getBaseUrl, generateNonce } from './yealinkAuth.js';

const agent = new https.Agent({
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

function rawRequest({ method, url, headers = {}, body, qs }) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);

        if (qs && Object.keys(qs).length) {
            Object.entries(qs).forEach(([k, v]) => parsed.searchParams.set(k, String(v)));
        }

        const bodyStr = body != null ? JSON.stringify(body) : undefined;

        const req = https.request({
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                ...headers,
                ...(bodyStr ? { 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
            },
            agent,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }

                if (res.statusCode >= 400) {
                    const err = new Error(`YMCS ${method} ${url} failed (${res.statusCode})`);
                    err.statusCode = res.statusCode;
                    err.response = parsed;
                    reject(err);
                    return;
                }
                resolve(parsed);
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function ymcsRequest(method, endpoint, { body, qs } = {}) {
    const baseUrl = getBaseUrl();
    const token = await getAccessToken();

    const requestOpts = {
        method,
        url: `${baseUrl}${endpoint}`,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'timestamp': String(Date.now()),
            'nonce': generateNonce(),
        },
        qs,
    };

    if (method !== 'GET' && method !== 'DELETE' && body) {
        requestOpts.body = body;
    }

    try {
        return await rawRequest(requestOpts);
    } catch (err) {
        if (err.statusCode === 401) {
            clearTokenCache();
            const newToken = await getAccessToken();
            requestOpts.headers.Authorization = `Bearer ${newToken}`;
            requestOpts.headers.timestamp = String(Date.now());
            requestOpts.headers.nonce = generateNonce();
            return rawRequest(requestOpts);
        }
        throw err;
    }
}

const ymcs = {
    get: (endpoint, qs) => ymcsRequest('GET', endpoint, { qs }),
    post: (endpoint, body, qs) => ymcsRequest('POST', endpoint, { body, qs }),
    put: (endpoint, body, qs) => ymcsRequest('PUT', endpoint, { body, qs }),
    patch: (endpoint, body, qs) => ymcsRequest('PATCH', endpoint, { body, qs }),
    delete: (endpoint, qs) => ymcsRequest('DELETE', endpoint, { qs }),
};

export { ymcs, ymcsRequest };
