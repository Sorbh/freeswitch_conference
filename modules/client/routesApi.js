import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../service/auth/middleware.js";
import { acceptByUserName, declineByUserName, hangupDirectCallByUserName, initiateDirectCallByUserName } from "../../service/freeswitch/directCall.js";
import { logSystem } from "../../service/logger.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";
import { sendExtensionRequestEmail, sendRoomRequestEmail, sendVerificationEmail, sendPasswordResetEmail, sendNewSignupNotification, sendWelcomeEmail } from "../../service/emailSender.js";
import { changeUserRoom } from "../admin/users.js";
import { clientEventsRouter, buildOnlineCounts, kickClientSSE } from "./events.js";
import { getVapidPublicKey, sendToAccount } from "../../service/webPush.js";

function enrichBroadcast(b) {
    b.has_recording = !!b.recording_path;
    if (b.participants) {
        try {
            const parsed = typeof b.participants === 'string' ? JSON.parse(b.participants) : b.participants;
            b.participants = JSON.stringify(parsed.map(p => {
                if (p.extension) return p;
                const email = p.userName?.replace('sip:', '');
                const acct = email ? global.db.getAccountByEmail(email) : null;
                return acct?.extension ? { ...p, extension: acct.extension } : p;
            }));
        } catch {}
    }
    return b;
}

const CLIENT_TOKEN_EXPIRY = '7d';
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours
const RESET_TOKEN_EXPIRY = 60 * 60; // 1 hour

// ── Simple rate limiter ──
const _rateBuckets = new Map();
setInterval(() => _rateBuckets.clear(), 60000);

function _rateLimit(key, maxPerMinute) {
    const count = _rateBuckets.get(key) || 0;
    if (count >= maxPerMinute) return false;
    _rateBuckets.set(key, count + 1);
    return true;
}

// Issue a client JWT — single source of truth shared by POST /login and GET /verify auto-login
function _clientLoginToken(account) {
    return jwt.sign(
        { type: 'client', sub: account.id, email: account.email, room: account.room },
        JWT_SECRET,
        { expiresIn: CLIENT_TOKEN_EXPIRY }
    );
}

export const clientRouter = express.Router();

function _getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim().replace('::ffff:', '');
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp.trim().replace('::ffff:', '');
    return (req.ip || '').replace('::ffff:', '');
}

function requireClientAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !queryToken) {
        return res.status(401).json({ status: false, error: 'Authentication required' });
    }
    try {
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.type !== 'client') {
            return res.status(401).json({ status: false, error: 'Invalid token type' });
        }
        req.client = payload;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ status: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ status: false, error: 'Invalid token' });
    }
}

// Mount client SSE events sub-router
clientRouter.use("/events", clientEventsRouter);

// GET /rooms — public list of rooms for signup form
clientRouter.get("/rooms", (req, res) => {
    try {
        const rooms = global.db.getAllRooms().map(r => ({ id: r.id, name: r.name }));
        res.json({ status: true, data: rooms });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /signup — create client account with email verification
clientRouter.post("/signup", async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`signup:${ip}`, 3)) {
            return res.status(429).json({ status: false, error: "Too many signup attempts. Please try again later." });
        }

        const { email, password, company_name, display_name, company_phone, city, zip, room, referral_code } = req.body;
        const cleanEmail = String(email || '').toLowerCase().trim();
        const cleanCompanyName = String(company_name || '').trim();
        const cleanDisplayName = String(display_name || '').trim();
        const cleanCompanyPhone = String(company_phone || '').trim();
        const cleanCity = String(city || '').trim();
        const cleanZip = String(zip || '').trim();
        const cleanReferralCode = String(referral_code || '').trim().toUpperCase();

        if (!cleanEmail || !password || !cleanCompanyName) {
            return res.status(400).json({ status: false, error: "Company name, email, and password are required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ status: false, error: "Invalid email address" });
        }

        if (password.length < 6) {
            return res.status(400).json({ status: false, error: "Password must be at least 6 characters" });
        }

        const requestedRoomId = parseInt(room, 10);
        const defaultRoomId = parseInt(process.env.SIGNUP_DEFAULT_ROOM_ID, 10);
        const allRooms = global.db.getAllRooms();
        const roomId = requestedRoomId || defaultRoomId || allRooms[0]?.id || null;
        const roomData = roomId ? global.db.getRoom(roomId) : null;
        if (roomId && !roomData) {
            return res.status(400).json({ status: false, error: "Selected room does not exist" });
        }

        const existing = global.db.getAccountByEmail(cleanEmail);
        if (existing) {
            return res.status(409).json({ status: false, error: "An account with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = Math.floor(Date.now() / 1000) + VERIFICATION_TOKEN_EXPIRY;
        const fallbackDisplayName = cleanDisplayName || cleanCompanyName || cleanEmail.split('@')[0];

        const account = global.db.createAccount({
            email: cleanEmail,
            password: password,
            displayName: fallbackDisplayName,
            companyName: cleanCompanyName,
            companyPhone: cleanCompanyPhone || null,
            city: cleanCity || null,
            zip: cleanZip || null,
            room: roomId,
        });

        const updateFields = {
            password_hash: passwordHash,
            email_verified: 0,
            verification_token: verificationToken,
            verification_token_expires: verificationExpires,
            signup_source: 'client',
            active: 0,
        };

        if (cleanReferralCode) {
            const referrer = global.db.getAccountByReferralCode(cleanReferralCode);
            if (referrer) {
                updateFields.referred_by = referrer.id;
            }
        }

        global.db.updateAccount(account.id, updateFields);

        logSystem('CLIENT', `API /signup email=${cleanEmail} company=${cleanCompanyName} room=${roomId || ''} ip=${ip}`);

        try {
            await sendVerificationEmail({ email: account.email, token: verificationToken, displayName: fallbackDisplayName, roomName: roomData?.name });
        } catch (emailErr) {
            console.error('[SIGNUP] Verification email failed:', emailErr.message);
        }

        sendNewSignupNotification({
            email: account.email,
            companyName: cleanCompanyName,
            displayName: fallbackDisplayName,
            room: roomId,
            roomName: roomData?.name || '',
            zip: cleanZip,
        }).catch(() => {});

        res.json({ status: true, message: "Account created. Please check your email to verify your account." });
    } catch (err) {
        logSystem('CLIENT', `API /signup error=${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /verify — verify email via token, auto-login and redirect to dashboard
clientRouter.get("/verify", (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect('/client/login?verified=error&msg=Missing+verification+token');
        }

        const account = global.db.getAccountByVerificationToken(token);
        if (!account) {
            return res.redirect('/client/login?verified=error&msg=Invalid+or+expired+verification+link');
        }

        const now = Math.floor(Date.now() / 1000);
        if (account.verification_token_expires && account.verification_token_expires < now) {
            return res.redirect('/client/login?verified=error&msg=Verification+link+has+expired');
        }

        const updatedAccount = global.db.updateAccount(account.id, {
            email_verified: 1,
            verification_token: null,
            verification_token_expires: null,
            active: 1,
        });

        logSystem('CLIENT', `API /verify email=${account.email} verified=true`);

        const rooms = {};
        for (const room of global.db.getAllRooms()) rooms[room.id] = room.name;
        sendWelcomeEmail({
            email: account.email,
            displayName: account.display_name,
            companyName: account.company_name,
            roomName: rooms[account.room] || '',
        }).catch(err => logSystem('CLIENT', `API /verify welcome email failed: ${err.message}`));

        // Auto-login: pass a client JWT (same as POST /login issues) in the URL fragment.
        // The fragment never reaches server logs; AuthProvider consumes it on load.
        const loginToken = _clientLoginToken(updatedAccount);
        res.redirect(`/client/dashboard#vt=${encodeURIComponent(loginToken)}`);
    } catch (err) {
        logSystem('CLIENT', `API /verify error=${err.message}`);
        res.redirect('/client/login?verified=error&msg=Verification+failed');
    }
});

// POST /resend-verification — resend verification email
clientRouter.post("/resend-verification", async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`resend:${ip}`, 2)) {
            return res.status(429).json({ status: false, error: "Too many requests. Please try again later." });
        }

        const { email } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });

        const account = global.db.getAccountByEmail(email.toLowerCase().trim());
        if (!account) {
            return res.json({ status: true, message: "If an account exists with this email, a verification link has been sent." });
        }

        if (account.email_verified) {
            return res.json({ status: true, message: "This email is already verified. You can log in." });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = Math.floor(Date.now() / 1000) + VERIFICATION_TOKEN_EXPIRY;
        global.db.updateAccount(account.id, {
            verification_token: verificationToken,
            verification_token_expires: verificationExpires,
        });

        await sendVerificationEmail({ email: account.email, token: verificationToken, displayName: account.display_name });
        res.json({ status: true, message: "If an account exists with this email, a verification link has been sent." });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /forgot-password — send password reset email
clientRouter.post("/forgot-password", async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`forgot:${ip}`, 3)) {
            return res.status(429).json({ status: false, error: "Too many requests. Please try again later." });
        }

        const { email } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });

        const account = global.db.getAccountByEmail(email.toLowerCase().trim());
        if (!account || !account.active) {
            return res.json({ status: true, message: "If an account exists with this email, a password reset link has been sent." });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRY;
        global.db.updateAccount(account.id, {
            reset_token: resetToken,
            reset_token_expires: resetExpires,
        });

        await sendPasswordResetEmail({ email: account.email, token: resetToken, displayName: account.display_name });
        logSystem('CLIENT', `API /forgot-password email=${email} ip=${ip}`);
        res.json({ status: true, message: "If an account exists with this email, a password reset link has been sent." });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /reset-password — reset password with token
clientRouter.post("/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ status: false, error: "Token and password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ status: false, error: "Password must be at least 6 characters" });
        }

        const account = global.db.getAccountByResetToken(token);
        if (!account) {
            return res.status(400).json({ status: false, error: "Invalid or expired reset link" });
        }

        const now = Math.floor(Date.now() / 1000);
        if (account.reset_token_expires && account.reset_token_expires < now) {
            return res.status(400).json({ status: false, error: "Reset link has expired" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        global.db.updateAccount(account.id, {
            password: password,
            password_hash: passwordHash,
            reset_token: null,
            reset_token_expires: null,
        });

        logSystem('CLIENT', `API /reset-password email=${account.email} reset=true`);
        res.json({ status: true, message: "Password has been reset. You can now log in." });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /client/login — authenticate web client, return JWT + account info
clientRouter.post("/login", async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`login:${ip}`, 10)) {
            return res.status(429).json({ status: false, error: "Too many login attempts. Please try again later." });
        }

        const { email, password } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });

        const account = global.db.getAccountByEmail(email.toLowerCase().trim());
        if (!account) {
            return res.status(401).json({ status: false, error: "Account not found or inactive" });
        }

        if (account.signup_source === 'client' && !account.email_verified) {
            return res.status(403).json({ status: false, error: "Please verify your email before logging in", code: 'EMAIL_NOT_VERIFIED' });
        }

        if (!account.active) {
            return res.status(401).json({ status: false, error: "Account not found or inactive" });
        }

        const sipPassword = password || '';
        let authenticated = false;

        // Try bcrypt hash first (new accounts), fall back to plaintext (legacy)
        if (account.password_hash) {
            authenticated = await bcrypt.compare(sipPassword, account.password_hash);
        } else {
            authenticated = sipPassword === (account.password || global.config.SIP_DEFAULT_PASSWORD);
        }

        if (!authenticated) {
            return res.status(401).json({ status: false, error: "Invalid password" });
        }

        const token = _clientLoginToken(account);

        kickClientSSE(account.email);

        const { password: sipPwd, password_hash: _h, verification_token: _v, reset_token: _r, ...safe } = account;
        safe.sip_password = sipPwd || global.config.SIP_DEFAULT_PASSWORD || '12345678';
        const userInfo = global.db.getUserInfo(`sip:${account.email}`);
        if (userInfo && userInfo.currentRoom) {
            safe.current_room = userInfo.currentRoom;
        }
        if (userInfo && Object.keys(userInfo).length > 0) {
            safe.connection_state = userInfo.connectionState || 'ideal';
            safe.client_type = userInfo.clientType || 'unknown';
        }
        res.json({ status: true, token, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /extensions — authenticated directory of callable extensions
clientRouter.get("/extensions", requireClientAuth, (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const rooms = {};
        for (const room of global.db.getAllRooms()) {
            rooms[room.id] = room.name;
        }

        const data = global.db.getAllAccounts()
            .filter(account => account.active && account.extension)
            .map(account => {
                const userInfo = global.db.getUserInfo(`sip:${account.email}`);
                const connected = Boolean(
                    userInfo &&
                    userInfo.connectionState === 'connected' &&
                    userInfo.fsChannelUUID &&
                    userInfo.fsMemberId
                );
                return {
                    id: account.id,
                    email: account.email,
                    companyName: account.company_name || '',
                    displayName: account.display_name || account.email,
                    extension: account.extension,
                    room: account.room,
                    roomName: rooms[account.room] || String(account.room || ''),
                    connectionState: userInfo?.connectionState || 'offline',
                    connected,
                };
            })
            .sort((a, b) => {
                const left = `${a.companyName} ${a.displayName}`.toLowerCase();
                const right = `${b.companyName} ${b.displayName}`.toLowerCase();
                if (left < right) return -1;
                if (left > right) return 1;
                return Number(a.extension) - Number(b.extension);
            });

        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /members — authenticated directory of all active members with company info
clientRouter.get("/members", requireClientAuth, (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const rooms = {};
        for (const room of global.db.getAllRooms()) {
            rooms[room.id] = room.name;
        }

        const data = global.db.getAllAccounts()
            .filter(account => account.active)
            .map(account => {
                const userInfo = global.db.getUserInfo(`sip:${account.email}`);
                const connected = Boolean(
                    userInfo &&
                    userInfo.connectionState === 'connected' &&
                    userInfo.fsChannelUUID &&
                    userInfo.fsMemberId
                );
                return {
                    id: account.id,
                    email: account.email,
                    companyName: account.company_name || '',
                    displayName: account.display_name || account.email,
                    address: account.company_address || '',
                    city: account.city || '',
                    state: account.state || '',
                    zip: account.zip || '',
                    phone: account.company_phone || '',
                    extension: account.extension || null,
                    room: account.room,
                    roomName: rooms[account.room] || String(account.room || ''),
                    connectionState: userInfo?.connectionState || 'offline',
                    connected,
                };
            })
            .sort((a, b) => {
                const left = `${a.companyName} ${a.displayName}`.toLowerCase();
                const right = `${b.companyName} ${b.displayName}`.toLowerCase();
                if (left < right) return -1;
                if (left > right) return 1;
                return Number(a.extension || 0) - Number(b.extension || 0);
            });

        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /conference-status — whether authenticated user is currently in conference
clientRouter.get("/conference-status", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        const userInfo = global.db.getUserInfo(userName);
        const inConference = !!(
            userInfo &&
            Object.keys(userInfo).length > 0 &&
            userInfo.connectionState === 'connected' &&
            userInfo.fsChannelUUID &&
            userInfo.fsMemberId
        );

        res.json({
            status: true,
            data: {
                userName,
                inConference,
                connectionState: userInfo?.connectionState || 'unknown',
                room: userInfo?.currentRoom || userInfo?.room || null,
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /extension-request — request a preferred SIP extension
clientRouter.post("/extension-request", requireClientAuth, async (req, res) => {
    try {
        const email = req.client.email;
        const requestedExtension = parseInt(req.body?.extension, 10);
        logSystem('CLIENT', `API /extension-request user=sip:${email} ext=${requestedExtension || ''} ip=${_getClientIp(req)}`);

        if (!requestedExtension || requestedExtension < 100 || requestedExtension > 999) {
            return res.status(400).json({ status: false, error: "Extension must be between 100 and 999" });
        }

        const account = global.db.getAccountByEmail(email);
        if (!account || !account.active) {
            return res.status(404).json({ status: false, error: "Account not found or inactive" });
        }

        const rooms = {};
        for (const room of global.db.getAllRooms()) {
            rooms[room.id] = room.name;
        }

        await sendExtensionRequestEmail({
            email,
            requestedExtension,
            currentExtension: account.extension,
            companyName: account.company_name,
            displayName: account.display_name,
            room: account.room,
            roomName: rooms[account.room],
            ip: _getClientIp(req),
        });

        logSystem('CLIENT', `API /extension-request sent user=sip:${email} ext=${requestedExtension} to=${global.config.EXTENSION_REQUEST_TO_EMAIL}`);
        res.json({ status: true, message: `Extension *${requestedExtension} request sent.` });
    } catch (err) {
        logSystem('CLIENT', `API /extension-request failed error=${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /account — get authenticated user's account info
clientRouter.get("/account", requireClientAuth, (req, res) => {
    try {
        const account = global.db.getAccountById(req.client.sub);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        const { password: sipPwd, password_hash: _h, verification_token: _v, reset_token: _r, ...safe } = account;
        safe.sip_password = sipPwd || global.config.SIP_DEFAULT_PASSWORD || '12345678';
        const userInfo = global.db.getUserInfo(`sip:${account.email}`);
        if (userInfo && userInfo.currentRoom) safe.current_room = userInfo.currentRoom;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /referral — get authenticated user's referral info
clientRouter.get("/referral", requireClientAuth, (req, res) => {
    try {
        const account = global.db.getAccountById(req.client.sub);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        const referralCount = global.db.getReferralCount(account.id);
        const referrals = global.db.getReferrals(account.id);
        const referralLink = `${global.config.CLIENT_APP_URL}/client/signup?ref=${account.referral_code}`;
        res.json({
            status: true,
            data: {
                referral_code: account.referral_code,
                referral_link: referralLink,
                referral_count: referralCount,
                referrals: referrals.map(r => ({
                    company_name: r.company_name,
                    display_name: r.display_name,
                    created_at: r.created_at,
                })),
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Web push ──

// GET /push/public-key — VAPID public key (public; the key is not a secret)
clientRouter.get("/push/public-key", (req, res) => {
    const key = getVapidPublicKey();
    if (!key) return res.status(503).json({ status: false, error: "Push not configured" });
    res.json({ status: true, key });
});

// POST /push/subscribe — register this browser's push subscription
clientRouter.post("/push/subscribe", requireClientAuth, (req, res) => {
    try {
        const { endpoint, keys } = req.body || {};
        if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ status: false, error: "Invalid subscription" });
        }
        global.db.upsertPushSubscription({
            accountId: req.client.sub,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userAgent: req.headers['user-agent'] || null,
        });
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /push/unsubscribe — remove this browser's push subscription
clientRouter.post("/push/unsubscribe", requireClientAuth, (req, res) => {
    try {
        const { endpoint } = req.body || {};
        if (!endpoint) return res.status(400).json({ status: false, error: "endpoint required" });
        global.db.deletePushSubscriptionByEndpoint(endpoint);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /push/prefs — notification preference toggles + device count
clientRouter.get("/push/prefs", requireClientAuth, (req, res) => {
    try {
        const account = global.db.getAccountById(req.client.sub);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        res.json({
            status: true,
            data: {
                parts_requests: !!account.push_parts_requests,
                direct_calls: !!account.push_direct_calls,
                devices: global.db.getPushSubscriptionsByAccount(account.id).length,
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /push/prefs — update notification preference toggles
clientRouter.put("/push/prefs", requireClientAuth, (req, res) => {
    try {
        const { parts_requests, direct_calls } = req.body || {};
        global.db.setAccountPushPrefs(req.client.sub, { parts_requests, direct_calls });
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /push/test — send yourself a test notification
clientRouter.post("/push/test", requireClientAuth, async (req, res) => {
    try {
        const sent = await sendToAccount(req.client.sub, {
            title: 'Hotline HQ',
            body: 'Test notification — you are all set.',
            url: '/client/dashboard',
        });
        res.json({ status: true, sent });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /account — update account settings
clientRouter.put("/account", requireClientAuth, async (req, res) => {
    try {
        const account = global.db.getAccountById(req.client.sub);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const updates = {};
        const { display_name, company_name, company_phone, company_address, city, state, zip, current_password, new_password } = req.body;

        if (display_name !== undefined) updates.display_name = display_name.trim();
        if (company_name !== undefined) updates.company_name = company_name.trim();
        if (company_phone !== undefined) updates.company_phone = company_phone.trim();
        if (company_address !== undefined) updates.company_address = company_address.trim();
        if (city !== undefined) updates.city = city.trim();
        if (state !== undefined) updates.state = state.trim();
        if (zip !== undefined) updates.zip = zip.trim();

        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ status: false, error: "Current password is required to change password" });
            }
            if (new_password.length < 6) {
                return res.status(400).json({ status: false, error: "New password must be at least 6 characters" });
            }

            let currentValid = false;
            if (account.password_hash) {
                currentValid = await bcrypt.compare(current_password, account.password_hash);
            } else {
                currentValid = current_password === (account.password || global.config.SIP_DEFAULT_PASSWORD);
            }
            if (!currentValid) {
                return res.status(401).json({ status: false, error: "Current password is incorrect" });
            }

            updates.password = new_password;
            updates.password_hash = await bcrypt.hash(new_password, 12);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ status: false, error: "No fields to update" });
        }

        const updated = global.db.updateAccount(account.id, updates);
        const { password: _p, password_hash: _ph, verification_token: _vt, reset_token: _rt, ...safe } = updated;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /room-request — request a preferred room/market
clientRouter.post("/room-request", requireClientAuth, async (req, res) => {
    try {
        const email = req.client.email;
        const requestedRoom = String(req.body?.roomName || req.body?.room || req.body?.city || '').trim();
        const requestedState = String(req.body?.state || req.body?.stateName || '').trim();
        const message = String(req.body?.message || '').trim();
        logSystem('CLIENT', `API /room-request user=sip:${email} room="${requestedRoom}" ip=${_getClientIp(req)}`);

        if (!requestedRoom || requestedRoom.length < 2 || requestedRoom.length > 80) {
            return res.status(400).json({ status: false, error: "Room name is required" });
        }
        if (requestedState.length > 80) {
            return res.status(400).json({ status: false, error: "State is too long" });
        }
        if (message.length > 500) {
            return res.status(400).json({ status: false, error: "Message is too long" });
        }

        const account = global.db.getAccountByEmail(email);
        if (!account || !account.active) {
            return res.status(404).json({ status: false, error: "Account not found or inactive" });
        }

        const rooms = {};
        for (const room of global.db.getAllRooms()) {
            rooms[room.id] = room.name;
        }

        await sendRoomRequestEmail({
            email,
            requestedRoom,
            requestedState,
            message,
            companyName: account.company_name,
            displayName: account.display_name,
            currentRoom: account.room,
            currentRoomName: rooms[account.room],
            ip: _getClientIp(req),
        });

        logSystem('CLIENT', `API /room-request sent user=sip:${email} room="${requestedRoom}" to=${global.config.ROOM_REQUEST_TO_EMAIL}`);
        res.json({ status: true, message: "Room request sent." });
    } catch (err) {
        logSystem('CLIENT', `API /room-request failed error=${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

function _checkUserSanity(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (!userInfo || Object.keys(userInfo).length === 0) return { ok: false, code: 404, error: "User not found" };
    if (userInfo.connectionState !== 'connected' && userInfo.connectionState !== 'direct_call') {
        return { ok: false, code: 409, error: "User is not in a call" };
    }
    return { ok: true };
}

// POST /mute — mute user in conference
clientRouter.post("/mute", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logSystem('CLIENT', `API /mute user=${userName} ip=${_getClientIp(req)}`);
        const check = _checkUserSanity(userName);
        if (!check.ok) return res.status(check.code).json({ status: false, error: check.error });
        const result = handleHttpHookEvent(userName, 'on_hook');
        if (!result) return res.status(400).json({ status: false, error: "Failed to mute" });
        res.json({ status: true, muted: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /unmute — unmute user in conference
clientRouter.post("/unmute", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logSystem('CLIENT', `API /unmute user=${userName} ip=${_getClientIp(req)}`);
        const check = _checkUserSanity(userName);
        if (!check.ok) return res.status(check.code).json({ status: false, error: check.error });
        const result = handleHttpHookEvent(userName, 'off_hook');
        if (!result) return res.status(400).json({ status: false, error: "Failed to unmute" });
        res.json({ status: true, muted: false });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /direct-call/decline — decline pending private direct call
clientRouter.post("/direct-call/decline", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logSystem('CLIENT', `API /direct-call/decline user=${userName} ip=${_getClientIp(req)}`);
        const declined = declineByUserName(userName, 'web_decline');
        if (!declined) return res.status(409).json({ status: false, error: "No pending direct call" });
        res.json({ status: true, message: "Direct call declined" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /direct-call/accept — accept pending private direct call from web client
clientRouter.post("/direct-call/accept", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logSystem('CLIENT', `API /direct-call/accept user=${userName} ip=${_getClientIp(req)}`);
        const accepted = acceptByUserName(userName);
        if (!accepted) return res.status(409).json({ status: false, error: "No pending direct call" });
        res.json({ status: true, message: "Direct call accepted" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /direct-call/end — end active private direct call from web client
clientRouter.post("/direct-call/end", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logSystem('CLIENT', `API /direct-call/end user=${userName} ip=${_getClientIp(req)}`);
        const ended = hangupDirectCallByUserName(userName, 'web_end');
        if (!ended) return res.status(409).json({ status: false, error: "No active direct call" });
        res.json({ status: true, message: "Direct call ending" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /direct-call/start — start private direct call by extension
clientRouter.post("/direct-call/start", requireClientAuth, async (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        const extension = parseInt(req.body?.extension, 10);
        logSystem('CLIENT', `API /direct-call/start user=${userName} ext=${extension || ''} ip=${_getClientIp(req)}`);

        if (!extension) {
            return res.status(400).json({ status: false, error: "extension is required" });
        }

        const result = await initiateDirectCallByUserName(userName, extension);
        if (!result?.status) {
            return res.status(result?.code || 400).json({ status: false, error: result?.error || "Failed to start direct call" });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms/details — all rooms with online/connected counts
clientRouter.get("/rooms/details", requireClientAuth, (req, res) => {
    try {
        const allRooms = global.db.getAllRooms();
        const online = buildOnlineCounts();
        const data = allRooms.map(r => ({
            id: r.id,
            code: r.id,
            name: r.name,
            short_code: r.short_code,
            timezone: r.timezone,
            online: online[r.id] || 0,
        }));
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /room/change — change authenticated user's current room
clientRouter.put("/room/change", requireClientAuth, async (req, res) => {
    try {
        const { room } = req.body;
        const newRoom = parseInt(room, 10);
        if (!newRoom) return res.status(400).json({ status: false, error: "room is required" });

        const roomData = global.db.getRoom(newRoom);
        if (!roomData) return res.status(404).json({ status: false, error: "Room not found" });

        const userName = `sip:${req.client.email}`;
        const account = global.db.getAccountByEmail(req.client.email);
        if (!account || !account.active) {
            return res.status(404).json({ status: false, error: "Account not found or inactive" });
        }

        const userInfo = global.db.getUserInfo(userName);
        const oldRoom = userInfo?.currentRoom || userInfo?.room || account.room;

        if (oldRoom === newRoom) {
            return res.json({ status: true, message: "Already in this room", room: newRoom, roomName: roomData.name });
        }

        const result = await changeUserRoom(userName, newRoom, 'client-web');

        logSystem('CLIENT', `API /room user=sip:${req.client.email} ${oldRoom}->${newRoom} ip=${_getClientIp(req)}`);
        res.json({ status: true, message: `Room changed to ${roomData.name}`, room: newRoom, roomName: roomData.name });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/:id/audio — stream broadcast recording (authenticated via header or query token)
clientRouter.get("/broadcasts/:id/audio", (req, res) => {
    const authToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    if (!authToken) return res.status(401).json({ status: false, error: 'Authentication required' });
    try {
        const payload = jwt.verify(authToken, JWT_SECRET);
        if (payload.type !== 'client') return res.status(401).json({ status: false, error: 'Invalid token' });
    } catch { return res.status(401).json({ status: false, error: 'Invalid or expired token' }); }
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ status: false, error: "Invalid broadcast ID" });
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        if (!broadcast.recording_path) return res.status(404).json({ status: false, error: "No recording available" });
        const filePath = broadcast.recording_path.startsWith('/') ? broadcast.recording_path : path.join(process.cwd(), broadcast.recording_path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ status: false, error: "Recording file not found" });
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Accept-Ranges', 'bytes');
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/list/:room? — paginated broadcast list with optional room + filters
clientRouter.get("/broadcasts/list/:room?", requireClientAuth, (req, res) => {
    try {
        const room = req.params.room ? parseInt(req.params.room) : undefined;
        if (req.params.room && !room) return res.status(400).json({ status: false, error: "Invalid room code" });

        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 100);
        const answered = req.query.answered !== undefined ? parseInt(req.query.answered) : undefined;
        const hasParts = req.query.hasParts !== undefined ? parseInt(req.query.hasParts) : undefined;
        const dateFrom = req.query.dateFrom ? Math.floor(new Date(req.query.dateFrom).getTime() / 1000) : undefined;
        const dateTo = req.query.dateTo ? Math.floor(new Date(req.query.dateTo + 'T23:59:59').getTime() / 1000) : undefined;

        const result = global.db.getPaginatedBroadcasts({ page, pageSize, room, answered, dateFrom, dateTo, hasParts });
        result.data = result.data.map(enrichBroadcast);
        res.json({ status: true, ...result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Re-export from events.js for external consumers
export { getClientSSEUsers, sendClientEventToUser } from "./events.js";
