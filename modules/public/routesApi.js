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
    // sendFile gives real Range/206 support (iOS needs it to start playback
    // fast) plus ETag; recordings never change, so cache aggressively.
    res.sendFile(filePath, { maxAge: '365d', immutable: true }, (err) => {
        if (err && !res.headersSent) res.status(500).json({ status: false, error: err.message });
    });
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

// --- Public broadcast activity (landing page) ---
// Only company/display names, room names, and the public recording link are
// exposed here. Account emails, extensions, and SIP data stay private.

function _publicParticipants(participants) {
    let parsed = participants;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = []; }
    }
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed.reduce((result, participant) => {
        const displayName = participant?.displayName || participant?.display_name;
        if (!displayName || seen.has(displayName)) return result;
        seen.add(displayName);
        result.push({ displayName });
        return result;
    }, []);
}

function _publicBroadcast(broadcast) {
    if (!broadcast) return null;
    const token = broadcast.shareToken || broadcast.share_token || null;
    const participants = _publicParticipants(broadcast.participants);
    return {
        id: broadcast.id,
        room: broadcast.room,
        room_name: broadcast.roomName || broadcast.room_name || null,
        display_name: broadcast.displayName || broadcast.display_name || participants[0]?.displayName || 'Network member',
        duration_ms: broadcast.durationMs || broadcast.duration_ms || 0,
        answered: !!broadcast.answered,
        responded_by: broadcast.respondedBy || broadcast.responded_by || null,
        participants,
        participant_count: broadcast.participantCount || broadcast.participant_count || participants.length,
        has_recording: !!(broadcast.recordingPath || broadcast.recording_path),
        token,
        url: token ? `/b/${token}` : null,
        created_at: broadcast.created_at || Math.floor(Date.now() / 1000),
    };
}

function _latestPublicBroadcast() {
    const broadcast = global.db.getLatestBroadcast();
    if (!broadcast) return null;
    if (!broadcast.share_token) {
        broadcast.share_token = global.db.generateBroadcastShareToken(broadcast.id);
    }
    return _publicBroadcast(broadcast);
}

const publicBroadcastSSE = new Set();
let _publicBroadcastListenersRegistered = false;

function _sendPublicBroadcastEvent(event) {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const clientRes of publicBroadcastSSE) clientRes.write(frame);
}

function _ensurePublicBroadcastListeners() {
    if (_publicBroadcastListenersRegistered) return;
    _publicBroadcastListenersRegistered = true;

    global.db.eventEmitter.on('PUBLIC_BROADCAST_EVENT', (event) => {
        const participants = _publicParticipants(event.participants);
        _sendPublicBroadcastEvent({
            type: event.type,
            room: event.room,
            room_name: event.roomName || null,
            broadcaster: { displayName: event.broadcaster?.displayName || participants[0]?.displayName || 'Network member' },
            responder: event.responder ? { displayName: event.responder.displayName || 'Network member' } : null,
            participants,
            ts: event.ts || Date.now(),
        });
    });

    global.db.eventEmitter.on('BROADCAST_LOG', (broadcast) => {
        _sendPublicBroadcastEvent({
            type: 'broadcast_finished',
            data: _publicBroadcast(broadcast),
            ts: Date.now(),
        });
    });
}

publicRouter.get('/broadcasts/latest', (req, res) => {
    try {
        // `recent`: latest + previous recorded broadcasts, share-tokenized, so
        // the landing page can prefetch their audio. Additive — `data` unchanged.
        const recent = global.db.getRecentBroadcasts(10)
            .filter(b => b.recording_path)
            .slice(0, 4)
            .map(b => {
                const full = global.db.getBroadcastById(b.id);
                if (!full) return null;
                if (!full.share_token) full.share_token = global.db.generateBroadcastShareToken(full.id);
                return _publicBroadcast(full);
            })
            .filter(Boolean);
        res.json({ status: true, data: _latestPublicBroadcast(), recent });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

publicRouter.get('/broadcasts/events', (req, res) => {
    _ensurePublicBroadcastListeners();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', latest: _latestPublicBroadcast(), ts: Date.now() })}\n\n`);
    publicBroadcastSSE.add(res);

    req.on('close', () => {
        publicBroadcastSSE.delete(res);
    });
});
