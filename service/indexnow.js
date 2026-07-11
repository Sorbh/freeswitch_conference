import { logSystem } from './logger.js';

const INDEXNOW_KEY = '2b0463b5f1bb4537af317e64ed295d74';
const SITE_HOST = 'hotlinehq.online';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

export async function pingIndexNow(urlPath) {
    const url = `https://${SITE_HOST}${urlPath}`;
    try {
        const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });
        logSystem('INDEXNOW', `${res.status} ${urlPath}`);
    } catch (err) {
        logSystem('INDEXNOW', `Failed ${urlPath}: ${err.message}`);
    }
}

export async function pingIndexNowBatch(urlPaths) {
    if (!urlPaths.length) return;
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: SITE_HOST,
                key: INDEXNOW_KEY,
                keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
                urlList: urlPaths.map(p => `https://${SITE_HOST}${p}`),
            }),
            signal: AbortSignal.timeout(10000),
        });
        logSystem('INDEXNOW', `Batch ${urlPaths.length} URLs → ${res.status}`);
    } catch (err) {
        logSystem('INDEXNOW', `Batch failed: ${err.message}`);
    }
}
