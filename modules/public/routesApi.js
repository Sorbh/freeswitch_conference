import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mintPublicSession, listenerStats } from "../../service/listenerSessions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const publicRouter = express.Router();

publicRouter.get("/broadcast/:token", (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 30) return res.status(400).json({ status: false, error: "Invalid token" });
    const broadcast = global.db.getBroadcastByShareToken(token);
    if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found or link has been revoked" });
    let participants = [];
    try { participants = JSON.parse(broadcast.participants || '[]'); } catch {}
    participants = participants.map(p => ({ displayName: p.displayName || p.display_name, joinedAt: p.joinedAt || p.joined_at }));
    const room = broadcast.room ? global.db.getRoom(broadcast.room) : null;
    res.json({
        status: true,
        data: {
            id: broadcast.id,
            room_name: broadcast.room_name || room?.name || null,
            display_name: broadcast.display_name,
            duration_ms: broadcast.duration_ms,
            answered: !!broadcast.answered,
            responded_by: broadcast.responded_by,
            participants,
            participant_count: broadcast.participant_count,
            response_time_ms: broadcast.response_time_ms,
            has_recording: !!broadcast.recording_path,
            listener_count: broadcast.listener_count || 0,
            transcription: broadcast.transcription || null,
            created_at: broadcast.created_at,
        },
    });
});

publicRouter.get("/broadcast/:token/audio", (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 30) return res.status(400).json({ status: false, error: "Invalid token" });
    const broadcast = global.db.getBroadcastByShareToken(token);
    if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found or link has been revoked" });
    if (!broadcast.recording_path) return res.status(404).json({ status: false, error: "No recording available" });
    const rootDir = path.resolve(__dirname, '../..');
    const filePath = broadcast.recording_path.startsWith('/') ? broadcast.recording_path : path.join(rootDir, broadcast.recording_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: false, error: "Recording file not found" });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
});

// --- Live listen (landing page, listen-only) ---

function _getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim().replace('::ffff:', '');
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp.trim().replace('::ffff:', '');
    return (req.ip || '').replace('::ffff:', '');
}

// Public projection of a room's live state. Company name + state only —
// no emails, phone numbers, SIP identities, or channel details.
function _publicRoomSnapshot(roomId) {
    const connected = global.db.filter(u =>
        u.online && (u.currentRoom || u.room) === roomId && !u.payment
    );
    const speakers = [];
    for (const u of connected.filter(u => !u.mute)) {
        const email = u.userName?.replace('sip:', '');
        const account = email ? global.db.getAccountByEmail(email) : null;
        // users.caller_id_name is the same "Company / Display" string dealers
        // see; never fall back to email/SIP identity on the public page
        const nameParts = [account?.company_name, account?.display_name].filter(Boolean);
        speakers.push({
            name: u.callerIdName || (nameParts.length ? nameParts.join(' / ') : 'Network member'),
            state: account?.state || null,
        });
    }
    return { room: roomId, online: connected.length, speakers };
}

function _liveRooms() {
    return global.db.getAllRooms()
        .map(r => ({ id: r.id, name: r.name, shortCode: r.short_code || null, ..._publicRoomSnapshot(r.id) }))
        .filter(r => r.online > 0);
}

publicRouter.get("/listen/rooms", (req, res) => {
    res.json({ status: true, data: _liveRooms() });
});

publicRouter.post("/listen/session", express.json(), (req, res) => {
    const roomId = parseInt(req.body?.room);
    if (!roomId) return res.status(400).json({ status: false, error: 'Invalid room' });

    const room = global.db.getRoom(roomId);
    if (!room) return res.status(404).json({ status: false, error: 'Room not found' });

    const snapshot = _publicRoomSnapshot(roomId);
    if (snapshot.online === 0) {
        return res.status(409).json({ status: false, error: 'Room is not live right now' });
    }

    const ip = _getClientIp(req);
    const session = mintPublicSession(roomId, ip);
    if (session.error) {
        const msg = session.error === 'listener_limit_reached'
            ? 'All listener slots are busy — try again in a minute'
            : 'Too many requests — try again later';
        return res.status(429).json({ status: false, error: msg });
    }

    res.json({
        status: true,
        data: {
            user: session.user,
            password: session.password,
            domain: global.config.FREESWITCH_PUBLIC_IP,
            wsUrl: global.config.PUBLIC_WSS_URL,
            target: `listen-${roomId}`,
            expiresIn: 60,
        },
    });
});

// --- Public SSE: sanitized live caller cards for one room ---

const listenSSE = new Map();          // roomId -> Set<res>
const MAX_SSE_CLIENTS = 100;
const MAX_SSE_PER_IP = 5;
const listenSSEByIp = new Map();      // ip -> count

let _listenListenerRegistered = false;
function _ensureListenListeners() {
    if (_listenListenerRegistered) return;
    _listenListenerRegistered = true;
    global.db.eventEmitter.on('STATE_EVENT', (eventData) => {
        let roomId = null;
        if (eventData.scope === 'callerid' && eventData.room) roomId = parseInt(eventData.room);
        if (eventData.scope === 'users' && eventData.userName) {
            const userInfo = global.db.getUserInfo(eventData.userName);
            roomId = userInfo?.currentRoom || userInfo?.room || null;
        }
        if (!roomId) return;
        const clients = listenSSE.get(roomId);
        if (!clients || clients.size === 0) return;
        const frame = `data: ${JSON.stringify({ type: 'update', ..._publicRoomSnapshot(roomId), ts: Date.now() })}\n\n`;
        for (const clientRes of clients) clientRes.write(frame);
    });
}

publicRouter.get("/listen/events/:room", (req, res) => {
    const roomId = parseInt(req.params.room);
    if (!roomId || !global.db.getRoom(roomId)) return res.status(404).end();

    const ip = _getClientIp(req);
    const totalClients = [...listenSSE.values()].reduce((n, s) => n + s.size, 0);
    if (totalClients >= MAX_SSE_CLIENTS || (listenSSEByIp.get(ip) || 0) >= MAX_SSE_PER_IP) {
        return res.status(429).end();
    }

    _ensureListenListeners();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', ..._publicRoomSnapshot(roomId), listeners: listenerStats(), ts: Date.now() })}\n\n`);

    if (!listenSSE.has(roomId)) listenSSE.set(roomId, new Set());
    listenSSE.get(roomId).add(res);
    listenSSEByIp.set(ip, (listenSSEByIp.get(ip) || 0) + 1);

    req.on('close', () => {
        listenSSE.get(roomId)?.delete(res);
        const count = (listenSSEByIp.get(ip) || 1) - 1;
        if (count <= 0) listenSSEByIp.delete(ip);
        else listenSSEByIp.set(ip, count);
    });
});
