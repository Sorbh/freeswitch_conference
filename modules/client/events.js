import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../service/auth/middleware.js";

export const clientEventsRouter = express.Router();

// --- SSE connection tracking ---

const clientRoomSSE = new Map();
const clientUserSSE = new Map();

export function getClientSSEUsers() {
    const users = new Set();
    for (const userName of clientUserSSE.keys()) {
        const clients = clientUserSSE.get(userName);
        if (clients && clients.size > 0) users.add(userName);
    }
    return users;
}

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

// --- Snapshot builders ---

export function buildRoomSnapshot(room) {
    const connectedUsers = global.db.filter(u =>
        u.online && (u.currentRoom || u.room) === room && !u.payment
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

export function buildOnlineCounts() {
    const online = {};
    const rooms = global.db.getAllRooms();
    for (const r of rooms) {
        const count = global.db.filter(u =>
            u.online && (u.currentRoom || u.room) === r.id && !u.payment
        ).length;
        online[r.id] = count;
    }
    return online;
}

// --- Helpers ---

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

// --- Event listeners (lazy) ---

let _listenerRegistered = false;
function _ensureListeners() {
    if (_listenerRegistered) return;
    _listenerRegistered = true;
    global.db.eventEmitter.on('STATE_EVENT', (eventData) => {
        if (eventData.scope === 'callerid' && eventData.room) {
            const room = eventData.room;
            sendClientEventToRoom(room, {
                type: 'callerid',
                ...buildRoomSnapshot(room),
                online: buildOnlineCounts(),
                ts: eventData.ts || Date.now()
            });
        }
        if (eventData.scope === 'users' && eventData.userName) {
            const userInfo = global.db.getUserInfo(eventData.userName);
            const room = userInfo?.currentRoom || userInfo?.room;
            if (room) {
                sendClientEventToRoom(room, {
                    type: 'online_update',
                    ...buildRoomSnapshot(room),
                    online: buildOnlineCounts(),
                    ts: Date.now()
                });
            }
        }
    });
    global.db.eventEmitter.on('CLIENT_EVENT', (eventData) => {
        if (!eventData.userName || !eventData.event) return;
        sendClientEventToUser(eventData.userName, eventData.event);
    });
}

// --- SSE auth (query param token) ---

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

// --- SSE endpoint ---

clientEventsRouter.get("/room/:room", requireClientSSEAuth, (req, res) => {
    _ensureListeners();
    const room = parseInt(req.params.room);
    if (!room) return res.status(400).end();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', ...buildRoomSnapshot(room), online: buildOnlineCounts() })}\n\n`);

    const userName = _normalizeClientUserName(req.client.email);
    const client = {
        res,
        room,
        email: req.client.email,
        userName,
        accountId: req.client.sub,
    };

    _addToMapSet(clientRoomSSE, room, client);
    _addToMapSet(clientUserSSE, userName, client);

    req.on('close', () => {
        _removeFromMapSet(clientRoomSSE, room, client);
        _removeFromMapSet(clientUserSSE, userName, client);
    });
});
