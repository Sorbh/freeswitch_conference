const buckets = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
        if (now - entry.windowStart > 120000) buckets.delete(key);
    }
}, 60000);

export function rateLimit(maxRequests, windowMs) {
    return (req, res, next) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const route = req.baseUrl + req.path;
        const key = `${ip}:${route}`;
        const now = Date.now();

        let entry = buckets.get(key);
        if (!entry || now - entry.windowStart > windowMs) {
            entry = { windowStart: now, count: 0 };
            buckets.set(key, entry);
        }

        entry.count++;
        if (entry.count > maxRequests) {
            const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ status: false, error: 'Too many requests', retryAfter });
        }

        next();
    };
}

const wsBuckets = new Map();

export function wsRateCheck(ip, maxConnections = 3) {
    const now = Date.now();
    let entry = wsBuckets.get(ip);
    if (!entry || now - entry.windowStart > 60000) {
        entry = { windowStart: now, count: 0 };
        wsBuckets.set(ip, entry);
    }
    entry.count++;
    return entry.count <= maxConnections;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of wsBuckets) {
        if (now - entry.windowStart > 60000) wsBuckets.delete(ip);
    }
}, 30000);
