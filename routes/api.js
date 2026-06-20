import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { freeswitchRouter } from "../modules/freeswitch/routesApi.js";
import { adminRouter } from "../modules/admin/routesApi.js";
import { clientRouter } from "../modules/client/routesApi.js";
import { yealinkRouter } from "../modules/yealink/routesApi.js";
import { authRouter } from "../modules/auth/routesApi.js";
import {
    requireAuth,
    requireSSEAuth,
    requireApiKey,
    requireLocalhost,
    requireRole,
} from "../service/auth/middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicRouter = express.Router();

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
    const filePath = broadcast.recording_path.startsWith('/') ? broadcast.recording_path : path.join(__dirname, '..', broadcast.recording_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: false, error: "Recording file not found" });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
});

export default class ApiRouter {
    apiRouter;
    constructor() {
        this.apiRouter = express.Router();

        this.apiRouter.use("/auth", authRouter);
        this.apiRouter.use("/public", publicRouter);
        this.apiRouter.use("/client", clientRouter);
        this.apiRouter.use("/yealink", yealinkRouter);
        this.apiRouter.use("/freeswitch", requireLocalhost, freeswitchRouter);

        // Admin: SSE event endpoints use cookie auth, everything else uses Bearer
        this.apiRouter.use("/admin/events", requireSSEAuth, _sseRouter());
        this.apiRouter.use("/admin", requireAuth, _adminRoleGuard, adminRouter);
    }
}

function _sseRouter() {
    const router = express.Router();

    // --- Client sets (one entry per SSE connection) ---
    const streamClients = new Set();        // res objects (admin /stream)
    const roomClients = new Set();          // { res, room } objects (/room/:room)
    const fsLogClients = new Set();         // { res, search? } objects (/fs-log)
    const phoneLogClients = new Set();      // { res, mac? } objects (/phone-log)
    const debugLogClients = new Set();      // res objects (/debug-log)

    // Helper: broadcast a pre-serialised SSE frame to every res in a Set
    function broadcast(clients, frame) {
        for (const client of clients) {
            const res = client.res || client;
            res.write(frame);
        }
    }

    // --- One listener per event type, registered once ---

    // /stream gets all four event types
    for (const evt of ['EVENT_LOG', 'USER_UPDATE', 'STATE_CHANGE', 'BROADCAST']) {
        global.db.eventEmitter.on(evt, (eventData) => {
            if (streamClients.size === 0 && roomClients.size === 0) return;
            const frame = `data: ${JSON.stringify(eventData)}\n\n`;
            broadcast(streamClients, frame);

            // Room clients also receive USER_UPDATE, STATE_CHANGE, BROADCAST (not EVENT_LOG)
            if (evt !== 'EVENT_LOG' && roomClients.size > 0) {
                for (const client of roomClients) {
                    if (eventData.room === client.room || eventData.type === 'state_change') {
                        client.res.write(frame);
                    }
                }
            }
        });
    }

    // Simple log channels — one event type each
    global.db.eventEmitter.on('FS_LOG', (entry) => {
        if (fsLogClients.size === 0) return;
        const frame = `data: ${JSON.stringify(entry)}\n\n`;
        for (const client of fsLogClients) {
            if (client.search) {
                const q = client.search;
                const hay = `${entry.from || ''}\0${entry.to || ''}\0${entry.callId || ''}\0${entry.method || ''}\0${entry.transport || ''}\0${entry.message || ''}`.toLowerCase();
                if (!hay.includes(q)) continue;
            }
            client.res.write(frame);
        }
    });
    global.db.eventEmitter.on('PHONE_LOG', (entry) => {
        if (phoneLogClients.size === 0) return;
        const frame = `data: ${JSON.stringify(entry)}\n\n`;
        for (const client of phoneLogClients) {
            if (client.mac && entry.mac !== client.mac) continue;
            client.res.write(frame);
        }
    });
    global.db.eventEmitter.on('DEBUG_LOG', (entry) => {
        if (debugLogClients.size === 0) return;
        broadcast(debugLogClients, `data: ${JSON.stringify(entry)}\n\n`);
    });

    // --- SSE endpoint handlers ---

    const SSE_HEADERS = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };

    // /api/v1/admin/events/stream → this sees /stream
    router.get("/stream", (req, res) => {
        res.writeHead(200, SSE_HEADERS);
        res.write('data: {"type":"connected"}\n\n');
        streamClients.add(res);
        req.on('close', () => { streamClients.delete(res); });
    });

    // /api/v1/admin/events/room/:room → this sees /room/:room
    router.get("/room/:room", (req, res) => {
        const room = parseInt(req.params.room);
        if (!room) return res.status(400).end();
        res.writeHead(200, SSE_HEADERS);
        const client = { res, room };
        roomClients.add(client);
        req.on('close', () => { roomClients.delete(client); });
    });

    router.get("/fs-log", (req, res) => {
        res.writeHead(200, SSE_HEADERS);
        res.write('data: {"type":"connected"}\n\n');
        const search = req.query.search?.toLowerCase() || '';
        const client = { res, search };
        fsLogClients.add(client);
        req.on('close', () => { fsLogClients.delete(client); });
    });

    router.get("/phone-log", (req, res) => {
        res.writeHead(200, SSE_HEADERS);
        res.write('data: {"type":"connected"}\n\n');
        const mac = req.query.mac?.toLowerCase() || '';
        const client = { res, mac };
        phoneLogClients.add(client);
        req.on('close', () => { phoneLogClients.delete(client); });
    });

    router.get("/debug-log", (req, res) => {
        res.writeHead(200, SSE_HEADERS);
        res.write('data: {"type":"connected"}\n\n');
        debugLogClients.add(res);
        req.on('close', () => { debugLogClients.delete(res); });
    });

    return router;
}

function _adminRoleGuard(req, res, next) {
    const path = req.path.replace(/^\//, '');
    const method = req.method;

    // Skip SSE event paths (handled by cookie auth above)
    if (path.startsWith('events')) return next();

    // Admin-only: accounts, YMCS, system, whatsapp, auth management
    if (path.startsWith('accounts') || path.startsWith('ymcs/') ||
        path === 'system' || path.startsWith('whatsapp/')) {
        return requireRole('admin')(req, res, next);
    }

    // Settings: admin-only
    if (path.startsWith('settings')) {
        return requireRole('admin')(req, res, next);
    }

    // Write operations (POST/PUT/DELETE) on users, rooms, notifications, audio-ads, transcribe: admin + editor
    if (method !== 'GET') {
        if (path.startsWith('users/') || path.startsWith('rooms') ||
            path.startsWith('notifications') || path.startsWith('audio-ads') ||
            path.match(/broadcasts\/\d+\/transcribe/)) {
            return requireRole('admin', 'editor')(req, res, next);
        }
    }

    // All GET endpoints: any authenticated role can read
    next();
}
