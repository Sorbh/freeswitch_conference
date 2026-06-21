import crypto from 'crypto';
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../service/auth/middleware.js";
import { declineByUserName, initiateDirectCallByUserName } from "../../service/freeswitch/directCall.js";
import { logSystem } from "../../service/logger.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";
import { sendExtensionRequestEmail, sendVerificationEmail, sendPasswordResetEmail, sendNewSignupNotification } from "../../service/emailSender.js";

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: false, error: 'Authentication required' });
    }
    try {
        const token = authHeader.slice(7);
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

function requireClientSSEAuth(req, res, next) {
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ status: false, error: 'Authentication required' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.type !== 'client') {
            return res.status(401).json({ status: false, error: 'Invalid token type' });
        }
        req.client = payload;
        next();
    } catch {
        return res.status(401).json({ status: false, error: 'Invalid or expired token' });
    }
}

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

        const { email, password, company_name, display_name, company_phone, city, zip, room } = req.body;

        if (!email || !password || !company_name || !display_name || !company_phone || !city || !zip || !room) {
            return res.status(400).json({ status: false, error: "All fields are required: email, password, company_name, display_name, company_phone, city, zip, room" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: false, error: "Invalid email address" });
        }

        if (password.length < 6) {
            return res.status(400).json({ status: false, error: "Password must be at least 6 characters" });
        }

        const roomId = parseInt(room, 10);
        const roomData = global.db.getRoom(roomId);
        if (!roomData) {
            return res.status(400).json({ status: false, error: "Selected room does not exist" });
        }

        const existing = global.db.getAccountByEmail(email.toLowerCase().trim());
        if (existing) {
            return res.status(409).json({ status: false, error: "An account with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = Math.floor(Date.now() / 1000) + VERIFICATION_TOKEN_EXPIRY;

        const account = global.db.createAccount({
            email: email.toLowerCase().trim(),
            password: password,
            displayName: display_name.trim(),
            companyName: company_name.trim(),
            companyPhone: company_phone.trim(),
            city: city.trim(),
            zip: zip.trim(),
            room: roomId,
        });

        global.db.updateAccount(account.id, {
            password_hash: passwordHash,
            email_verified: 0,
            verification_token: verificationToken,
            verification_token_expires: verificationExpires,
            signup_source: 'client',
            active: 0,
        });

        logSystem('CLIENT', `API /signup email=${email} company=${company_name} room=${roomId} ip=${ip}`);

        try {
            await sendVerificationEmail({ email: account.email, token: verificationToken, displayName: display_name });
        } catch (emailErr) {
            console.error('[SIGNUP] Verification email failed:', emailErr.message);
        }

        sendNewSignupNotification({
            email: account.email,
            companyName: company_name,
            displayName: display_name,
            room: roomId,
            roomName: roomData.name,
            zip,
        }).catch(() => {});

        res.json({ status: true, message: "Account created. Please check your email to verify your account." });
    } catch (err) {
        logSystem('CLIENT', `API /signup error=${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /verify — verify email via token, redirect to client login
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

        global.db.updateAccount(account.id, {
            email_verified: 1,
            verification_token: null,
            verification_token_expires: null,
            active: 1,
        });

        logSystem('CLIENT', `API /verify email=${account.email} verified=true`);
        res.redirect('/client/login?verified=success');
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

// POST /login — authenticate web client, return JWT + account info
clientRouter.post("/login", async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`login:${ip}`, 10)) {
            return res.status(429).json({ status: false, error: "Too many login attempts. Please try again later." });
        }

        const { email, password } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });

        const account = global.db.getAccountByEmail(email.toLowerCase().trim());
        if (!account || !account.active) {
            return res.status(401).json({ status: false, error: "Account not found or inactive" });
        }

        // Check email verification for self-signup accounts
        if (account.signup_source === 'client' && !account.email_verified) {
            return res.status(403).json({ status: false, error: "Please verify your email before logging in", code: 'EMAIL_NOT_VERIFIED' });
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

        const token = jwt.sign(
            { type: 'client', sub: account.id, email: account.email, room: account.room },
            JWT_SECRET,
            { expiresIn: CLIENT_TOKEN_EXPIRY }
        );

        const { password: _, password_hash: _h, verification_token: _v, reset_token: _r, ...safe } = account;
        const userInfo = global.db.getUserInfo(`sip:${account.email}`);
        if (userInfo && userInfo.currentRoom) {
            safe.current_room = userInfo.currentRoom;
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
        const { password: _, password_hash: _h, verification_token: _v, reset_token: _r, ...safe } = account;
        const userInfo = global.db.getUserInfo(`sip:${account.email}`);
        if (userInfo && userInfo.currentRoom) safe.current_room = userInfo.currentRoom;
        res.json({ status: true, data: safe });
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

// POST /room-request — request a new room (authenticated)
clientRouter.post("/room-request", requireClientAuth, async (req, res) => {
    try {
        const ip = _getClientIp(req);
        if (!_rateLimit(`roomreq:${ip}`, 2)) {
            return res.status(429).json({ status: false, error: "Too many requests. Please try again later." });
        }

        const { city, state: stateVal, message } = req.body;
        if (!city) return res.status(400).json({ status: false, error: "City/market name is required" });

        const account = global.db.getAccountById(req.client.sub);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const to = global.config.EXTENSION_REQUEST_TO_EMAIL;
        if (to) {
            const { sendMail } = await import("../../service/emailSender.js");
            await sendMail({
                to,
                subject: `New room request: ${city}${stateVal ? ', ' + stateVal : ''}`,
                text: [
                    'New room/market request on Hotline HQ',
                    '',
                    `Requested city: ${city}`,
                    `State: ${stateVal || '-'}`,
                    `Message: ${message || '-'}`,
                    '',
                    `Requester: ${account.company_name || '-'} / ${account.display_name || '-'}`,
                    `Email: ${account.email}`,
                    `Current room: ${account.room}`,
                    `IP: ${ip}`,
                    `Time: ${new Date().toISOString()}`,
                ].join('\n'),
            }).catch(err => console.error('[ROOM-REQUEST] Email failed:', err.message));
        }

        logSystem('CLIENT', `API /room-request email=${account.email} city=${city} ip=${ip}`);
        res.json({ status: true, message: "Room request submitted. We'll get back to you." });
    } catch (err) {
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

// --- Broadcast SSE helpers (module-level, shared across all connections) ---

function buildRoomSnapshot(room) {
    const connectedUsers = global.db.filter(u =>
        u.connectionState === 'connected' && (u.currentRoom || u.room) === room && !u.payment
    );
    const unmutedUsers = connectedUsers.filter(u => !u.mute);
    const callerIds = [];
    const callerIdHtml = [];
    const roomData = global.db.getRoom(room);
    const template = roomData?.caller_id_template || '';

    for (const u of unmutedUsers) {
        const email = u.userName?.replace('sip:', '');
        const account = email ? global.db.getAccountByEmail(email) : null;
        const name = account
            ? `${account.company_name || ''} / ${account.display_name || email}`
            : (u.callerIdName || u.userName);
        callerIds.push(name);

        if (template && account) {
            callerIdHtml.push(template
                .replace(/\{\{name\}\}/g, name)
                .replace(/\{\{city\}\}/g, account.city || '')
                .replace(/\{\{phone\}\}/g, account.company_phone || '')
                .replace(/\{\{userId\}\}/g, account.id || '')
            );
        } else {
            callerIdHtml.push(name);
        }
    }
    return { userCount: connectedUsers.length, unmutedCount: unmutedUsers.length, callerIds, callerIdHtml };
}

function buildOnlineCounts() {
    const online = {};
    const rooms = global.db.getAllRooms();
    for (const r of rooms) {
        const count = global.db.filter(u =>
            u.connectionState === 'connected' && u.room === r.id && !u.payment
        ).length;
        online[r.id] = count;
    }
    return online;
}

function _normalizeClientUserName(userName) {
    if (!userName) return null;
    return userName.startsWith('sip:') ? userName : `sip:${userName}`;
}

function _writeClientEvent(client, event) {
    client.res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function _addToMapSet(map, key, client) {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(client);
}

function _removeFromMapSet(map, key, client) {
    const clients = map.get(key);
    if (!clients) return;
    clients.delete(client);
    if (clients.size === 0) map.delete(key);
}

// Map<roomId, Set<client>> — tracks all active SSE connections per room
const clientRoomSSE = new Map();
// Map<userName, Set<client>> — tracks all active SSE connections per SIP user
const clientUserSSE = new Map();

export function sendClientEventToRoom(room, event) {
    const roomId = parseInt(room);
    if (!roomId) return 0;

    const clients = clientRoomSSE.get(roomId);
    if (!clients || clients.size === 0) return 0;

    const payload = { ...event, ts: event?.ts || Date.now() };
    for (const client of clients) {
        _writeClientEvent(client, payload);
    }
    return clients.size;
}

export function sendClientEventToUser(userName, event) {
    const normalizedUserName = _normalizeClientUserName(userName);
    if (!normalizedUserName) return 0;

    const clients = clientUserSSE.get(normalizedUserName);
    if (!clients || clients.size === 0) return 0;

    const payload = { ...event, ts: event?.ts || Date.now() };
    for (const client of clients) {
        _writeClientEvent(client, payload);
    }
    return clients.size;
}

// Single STATE_CHANGE listener — registered lazily on first SSE connect
let _clientListenerRegistered = false;
function _ensureClientListener() {
    if (_clientListenerRegistered) return;
    _clientListenerRegistered = true;
    global.db.eventEmitter.on('STATE_CHANGE', (eventData) => {
        if (eventData.scope !== 'callerid' || !eventData.room) return;
        const room = eventData.room;
        sendClientEventToRoom(room, {
            type: 'callerid',
            ...buildRoomSnapshot(room),
            online: buildOnlineCounts(),
            ts: eventData.ts || Date.now()
        });
    });
    global.db.eventEmitter.on('CLIENT_USER_EVENT', (eventData) => {
        if (!eventData.userName || !eventData.event) return;
        sendClientEventToUser(eventData.userName, eventData.event);
    });
}

// GET /events/room/:room — SSE callerID + online counts (auth via query param token)
clientRouter.get("/events/room/:room", requireClientSSEAuth, (req, res) => {
    _ensureClientListener();
    const room = parseInt(req.params.room);
    if (!room) return res.status(400).end();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ type: 'connected', ...buildRoomSnapshot(room), online: buildOnlineCounts() })}\n\n`);

    const userName = _normalizeClientUserName(req.client.email);
    const client = {
        res,
        room,
        email: req.client.email,
        userName,
        accountId: req.client.sub,
    };

    // Register this connection in room and user maps
    _addToMapSet(clientRoomSSE, room, client);
    _addToMapSet(clientUserSSE, userName, client);

    // Clean up on disconnect
    req.on('close', () => {
        _removeFromMapSet(clientRoomSSE, room, client);
        _removeFromMapSet(clientUserSSE, userName, client);
    });
});
