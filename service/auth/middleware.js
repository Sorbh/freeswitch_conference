import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'hotlinehq-jwt-secret-change-me';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;
const SSE_COOKIE_NAME = 'sse_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

function generateAccessToken(admin) {
    return jwt.sign(
        { sub: admin.id, email: admin.email, role: admin.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

function generateRefreshToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function setAuthCookies(res, admin, refreshToken, refreshDays) {
    const secure = process.env.NODE_ENV === 'production' || true;
    const days = refreshDays || REFRESH_TOKEN_DAYS;
    const sseToken = jwt.sign(
        { sub: admin.id, email: admin.email, role: admin.role },
        JWT_SECRET,
        { expiresIn: `${days}d` }
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: days * 24 * 60 * 60 * 1000,
    });

    res.cookie(SSE_COOKIE_NAME, sseToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/',
        maxAge: days * 24 * 60 * 60 * 1000,
    });
}

function clearAuthCookies(res) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.clearCookie(SSE_COOKIE_NAME, { path: '/' });
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.[SSE_COOKIE_NAME];

    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else if (cookieToken) {
        token = cookieToken;
    } else {
        return res.status(401).json({ status: false, error: 'Authentication required' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ status: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ status: false, error: 'Invalid token' });
    }
}

function requireSSEAuth(req, res, next) {
    const token = req.cookies?.[SSE_COOKIE_NAME];
    if (!token) {
        return res.status(401).json({ status: false, error: 'Authentication required' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ status: false, error: 'Invalid or expired SSE token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: false, error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ status: false, error: 'Insufficient permissions' });
        }
        next();
    };
}

function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (!key) {
        return res.status(401).json({ status: false, error: 'API key required' });
    }

    const keyHash = hashToken(key);
    const record = global.db.getApiKeyByHash(keyHash);
    if (!record) {
        return res.status(401).json({ status: false, error: 'Invalid API key' });
    }

    req.apiKey = record;
    next();
}

function requireLocalhost(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        return next();
    }
    return res.status(403).json({ status: false, error: 'Forbidden' });
}

// Rate limiter for login
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function loginRateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    const entry = loginAttempts.get(ip);
    if (entry) {
        entry.attempts = entry.attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (entry.attempts.length >= RATE_LIMIT_MAX) {
            const retryAfter = Math.ceil((entry.attempts[0] + RATE_LIMIT_WINDOW - now) / 1000);
            return res.status(429).json({
                status: false,
                error: 'Too many login attempts. Try again later.',
                retryAfter,
            });
        }
        entry.attempts.push(now);
    } else {
        loginAttempts.set(ip, { attempts: [now] });
    }

    next();
}

// Clean up rate limit map periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        entry.attempts = entry.attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (entry.attempts.length === 0) loginAttempts.delete(ip);
    }
}, 5 * 60 * 1000);

export {
    JWT_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_DAYS,
    REFRESH_COOKIE_NAME,
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    setAuthCookies,
    clearAuthCookies,
    requireAuth,
    requireSSEAuth,
    requireRole,
    requireApiKey,
    requireLocalhost,
    loginRateLimit,
};
