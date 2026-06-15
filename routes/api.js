import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ActionApiRouter from "../modules/sip-action/routesApi.js";
import { testRouter } from "../modules/test/routesApi.js";
import { freeswitchRouter } from "../modules/freeswitch/routesApi.js";
import { adminRouter } from "../modules/admin/routesApi.js";
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

        this.apiRouter.use("/test", testRouter);
        this.apiRouter.use("/auth", authRouter);
        this.apiRouter.use("/public", publicRouter);
        this.apiRouter.use("/freeswitch", requireLocalhost, freeswitchRouter);
        this.apiRouter.use("/action", requireApiKey, new ActionApiRouter().actionRouter);

        // Admin: SSE event endpoints use cookie auth, everything else uses Bearer
        this.apiRouter.use("/admin/events", requireSSEAuth, adminRouter);
        this.apiRouter.use("/admin", requireAuth, _adminRoleGuard, adminRouter);
    }
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
