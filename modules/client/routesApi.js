import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../service/auth/middleware.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";
import { logUser } from "../../service/logger.js";

const CLIENT_TOKEN_EXPIRY = '7d';

export const clientRouter = express.Router();

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

// POST /login — authenticate web client, return JWT + account info
clientRouter.post("/login", (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });

        const account = global.db.getAccountByEmail(email);
        if (!account || !account.active) {
            return res.status(401).json({ status: false, error: "Account not found or inactive" });
        }

        const sipPassword = password || '';
        if (sipPassword !== (account.password || global.config.SIP_DEFAULT_PASSWORD)) {
            return res.status(401).json({ status: false, error: "Invalid password" });
        }

        const token = jwt.sign(
            { type: 'client', sub: account.id, email: account.email, room: account.room },
            JWT_SECRET,
            { expiresIn: CLIENT_TOKEN_EXPIRY }
        );

        const { password: _, ...safe } = account;
        const userInfo = global.db.getUserInfo(`sip:${account.email}`);
        if (userInfo && userInfo.currentRoom) {
            safe.current_room = userInfo.currentRoom;
        }
        res.json({ status: true, token, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

function _checkUserInCall(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (!userInfo || Object.keys(userInfo).length === 0) return { ok: false, code: 404, error: "User not found" };
    if (userInfo.connectionState !== 'connected') return { ok: false, code: 409, error: "User is not in a call" };
    if (!userInfo.fsMemberId) return { ok: false, code: 409, error: "User is not in a conference" };
    return { ok: true };
}

// POST /mute — mute user in conference
clientRouter.post("/mute", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logUser(userName, 'CLIENT', 'MUTE');
        const check = _checkUserInCall(userName);
        if (!check.ok) return res.status(check.code).json({ status: false, error: check.error });
        const result = handleHttpHookEvent(userName, 'on_hook');
        if (!result) return res.status(400).json({ status: false, error: "Failed to mute" });
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', detail: { userName } });
        res.json({ status: true, muted: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /unmute — unmute user in conference
clientRouter.post("/unmute", requireClientAuth, (req, res) => {
    try {
        const userName = `sip:${req.client.email}`;
        logUser(userName, 'CLIENT', 'UNMUTE');
        const check = _checkUserInCall(userName);
        if (!check.ok) return res.status(check.code).json({ status: false, error: check.error });
        const result = handleHttpHookEvent(userName, 'off_hook');
        if (!result) return res.status(400).json({ status: false, error: "Failed to unmute" });
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', detail: { userName } });
        res.json({ status: true, muted: false });
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
