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

// --- Broadcast SSE connection tracking ---

const clientBroadcastSSE = new Set();

function sendBroadcastEvent(broadcastData) {
    if (clientBroadcastSSE.size === 0) return;
    const answeredInt = broadcastData.answered ? 1 : 0;
    const row = {
        id: broadcastData.id || null,
        room: broadcastData.room,
        room_name: broadcastData.roomName,
        user_name: broadcastData.userName,
        display_name: broadcastData.displayName,
        duration_ms: broadcastData.durationMs,
        answered: answeredInt,
        responded_by: broadcastData.respondedBy || null,
        participants: broadcastData.participants ? JSON.stringify(broadcastData.participants) : null,
        participant_count: broadcastData.participantCount || 0,
        recording_path: broadcastData.recordingPath || null,
        has_recording: !!broadcastData.recordingPath,
        response_time_ms: broadcastData.responseTimeMs || null,
        listener_count: broadcastData.listenerCount || 0,
        share_token: null,
        transcription: null,
        transcription_status: null,
        local_transcription: null,
        has_parts_request: null,
        part_details: null,
        created_at: broadcastData.created_at,
    };
    const frame = `data: ${JSON.stringify({ type: 'broadcast', data: row, ts: Date.now() })}\n\n`;
    for (const client of clientBroadcastSSE) {
        if (client.room && client.room !== broadcastData.room) continue;
        if (client.answered !== undefined && client.answered !== answeredInt) continue;
        if (client.hasParts === 1) continue;
        client.res.write(frame);
    }
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
    global.db.eventEmitter.on('BROADCAST_LOG', (broadcastData) => {
        sendBroadcastEvent(broadcastData);
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

function _enrichBroadcast(b) {
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

// --- SSE endpoint: broadcasts (optional room filter) ---

clientEventsRouter.get("/broadcasts/:room?", requireClientSSEAuth, (req, res) => {
    _ensureListeners();
    const room = req.params.room ? parseInt(req.params.room) : undefined;
    if (req.params.room && !room) return res.status(400).end();

    const answered = req.query.answered !== undefined ? parseInt(req.query.answered) : undefined;
    const hasParts = req.query.hasParts !== undefined ? parseInt(req.query.hasParts) : undefined;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const initial = global.db.getPaginatedBroadcasts({ page: 1, pageSize: 50, room, answered, hasParts });
    initial.data = initial.data.map(_enrichBroadcast);
    res.write(`data: ${JSON.stringify({ type: 'connected', ...initial })}\n\n`);

    const client = {
        res,
        room,
        answered,
        hasParts,
        email: req.client.email,
    };

    clientBroadcastSSE.add(client);

    req.on('close', () => {
        clientBroadcastSSE.delete(client);
    });
});
