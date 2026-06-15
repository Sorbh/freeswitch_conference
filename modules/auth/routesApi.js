import express from 'express';
import bcrypt from 'bcryptjs';
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    setAuthCookies,
    clearAuthCookies,
    requireAuth,
    requireRole,
    loginRateLimit,
    REFRESH_TOKEN_DAYS,
    REFRESH_COOKIE_NAME,
} from '../../service/auth/middleware.js';

export const authRouter = express.Router();

const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
const MAX_FAILED_ATTEMPTS = 5;

// POST /auth/login
authRouter.post('/login', loginRateLimit, async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: false, error: 'Email and password are required' });
        }

        const admin = global.db.getAdminByEmail(email);
        if (!admin) {
            global.db.logEvent('login_failed', email, null, 'Unknown email');
            return res.status(401).json({ status: false, error: 'Invalid credentials' });
        }

        if (!admin.active) {
            global.db.logEvent('login_failed', email, null, 'Account disabled');
            return res.status(401).json({ status: false, error: 'Account is disabled' });
        }

        const now = Math.floor(Date.now() / 1000);
        if (admin.locked_until && admin.locked_until > now) {
            const remaining = admin.locked_until - now;
            global.db.logEvent('login_failed', email, null, `Account locked (${remaining}s remaining)`);
            return res.status(423).json({
                status: false,
                error: 'Account is temporarily locked due to too many failed attempts',
                retryAfter: remaining,
            });
        }

        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            const attempts = admin.failed_attempts + 1;
            const updates = { failed_attempts: attempts };
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                updates.locked_until = now + LOCKOUT_DURATION;
                global.db.logEvent('account_locked', email, null, `Locked after ${attempts} failed attempts`);
            }
            global.db.updateAdmin(admin.id, updates);
            global.db.logEvent('login_failed', email, null, `Bad password (attempt ${attempts})`);
            return res.status(401).json({ status: false, error: 'Invalid credentials' });
        }

        // Success — reset failed attempts
        global.db.updateAdmin(admin.id, { failed_attempts: 0, locked_until: null });

        const accessToken = generateAccessToken(admin);
        const refreshToken = generateRefreshToken();
        const refreshHash = hashToken(refreshToken);
        const refreshDays = remember ? 30 : REFRESH_TOKEN_DAYS;
        const expiresAt = now + refreshDays * 24 * 60 * 60;

        global.db.saveRefreshToken(admin.id, refreshHash, expiresAt);
        setAuthCookies(res, admin, refreshToken, refreshDays);

        global.db.logEvent('login', email, null, `Logged in as ${admin.role}`);

        res.json({
            status: true,
            accessToken,
            user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /auth/refresh
authRouter.post('/refresh', (req, res) => {
    try {
        const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
        if (!refreshToken) {
            return res.status(401).json({ status: false, error: 'No refresh token' });
        }

        const tokenHash = hashToken(refreshToken);
        const record = global.db.getRefreshToken(tokenHash);
        if (!record) {
            return res.status(401).json({ status: false, error: 'Invalid refresh token' });
        }

        const now = Math.floor(Date.now() / 1000);
        if (record.expires_at < now) {
            global.db.deleteRefreshToken(tokenHash);
            clearAuthCookies(res);
            return res.status(401).json({ status: false, error: 'Refresh token expired' });
        }

        const admin = global.db.getAdminById(record.admin_id);
        if (!admin || !admin.active) {
            global.db.deleteRefreshToken(tokenHash);
            clearAuthCookies(res);
            return res.status(401).json({ status: false, error: 'Account not found or disabled' });
        }

        const accessToken = generateAccessToken(admin);
        setAuthCookies(res, admin, refreshToken);

        res.json({
            status: true,
            accessToken,
            user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /auth/logout
authRouter.post('/logout', requireAuth, (req, res) => {
    try {
        const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
        if (refreshToken) {
            global.db.deleteRefreshToken(hashToken(refreshToken));
        }
        clearAuthCookies(res);
        global.db.logEvent('logout', req.user.email, null, 'Logged out');
        res.json({ status: true, message: 'Logged out' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /auth/me
authRouter.get('/me', requireAuth, (req, res) => {
    try {
        const admin = global.db.getAdminById(req.user.sub);
        if (!admin) return res.status(404).json({ status: false, error: 'User not found' });
        res.json({
            status: true,
            user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Admin User Management (admin-only) ──

// GET /auth/admins
authRouter.get('/admins', requireAuth, requireRole('admin'), (req, res) => {
    try {
        res.json({ status: true, data: global.db.getAllAdmins() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /auth/admins
authRouter.post('/admins', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ status: false, error: 'email, password, and name are required' });
        }
        if (!['admin', 'editor', 'analytics'].includes(role)) {
            return res.status(400).json({ status: false, error: 'role must be admin, editor, or analytics' });
        }

        const existing = global.db.getAdminByEmail(email);
        if (existing) {
            return res.status(409).json({ status: false, error: 'Email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const admin = global.db.createAdmin({ email, passwordHash, name, role, createdBy: req.user.sub });

        global.db.logEvent('admin_created', email, null, `Admin created (${role}) by ${req.user.email}`);
        const { password_hash, ...safe } = admin;
        res.status(201).json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /auth/admins/:id
authRouter.put('/admins/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const admin = global.db.getAdminById(id);
        if (!admin) return res.status(404).json({ status: false, error: 'Admin not found' });

        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.email) updates.email = req.body.email;
        if (req.body.role && ['admin', 'editor', 'analytics'].includes(req.body.role)) updates.role = req.body.role;
        if (req.body.active !== undefined) updates.active = req.body.active ? 1 : 0;
        if (req.body.password) updates.password_hash = await bcrypt.hash(req.body.password, 12);

        const updated = global.db.updateAdmin(id, updates);
        if (!updated) return res.status(400).json({ status: false, error: 'No valid fields' });

        if (updates.active === 0) {
            global.db.deleteRefreshTokensByAdmin(id);
        }

        global.db.logEvent('admin_updated', admin.email, null, `Updated by ${req.user.email}`);
        const { password_hash, ...safe } = updated;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /auth/admins/:id
authRouter.delete('/admins/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.sub) {
            return res.status(400).json({ status: false, error: 'Cannot delete your own account' });
        }
        const admin = global.db.getAdminById(id);
        if (!admin) return res.status(404).json({ status: false, error: 'Admin not found' });

        global.db.deleteAdmin(id);
        global.db.logEvent('admin_deleted', admin.email, null, `Deleted by ${req.user.email}`);
        res.json({ status: true, message: `Admin ${admin.email} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── API Key Management (admin-only) ──

// GET /auth/api-keys
authRouter.get('/api-keys', requireAuth, requireRole('admin'), (req, res) => {
    try {
        res.json({ status: true, data: global.db.getAllApiKeys() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /auth/api-keys
authRouter.post('/api-keys', requireAuth, requireRole('admin'), (req, res) => {
    try {
        const { label } = req.body;
        if (!label) return res.status(400).json({ status: false, error: 'label is required' });

        const rawKey = generateRefreshToken(); // reuse 32-byte hex generator
        const keyHash = hashToken(rawKey);
        const keyPrefix = rawKey.slice(0, 8);

        const record = global.db.createApiKey({ label, keyHash, keyPrefix, createdBy: req.user.sub });
        global.db.logEvent('api_key_created', req.user.email, null, `API key "${label}" created`);

        res.status(201).json({ status: true, data: { ...record, key: rawKey } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /auth/api-keys/:id
authRouter.delete('/api-keys/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        global.db.deleteApiKey(id);
        global.db.logEvent('api_key_deleted', req.user.email, null, `API key #${id} revoked`);
        res.json({ status: true, message: 'API key revoked' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});
