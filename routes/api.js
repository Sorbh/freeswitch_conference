import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ActionApiRouter from "../modules/sip-action/routesApi.js";
import { freeswitchRouter } from "../modules/freeswitch/routesApi.js";
import { adminRouter } from "../modules/admin/routesApi.js";
import { handleHttpHookEvent } from "../service/phoneEvents.js";
import { getConnectionHandlers } from "../service/freeswitch/connection.js";
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
        this.apiRouter.use("/freeswitch", requireLocalhost, freeswitchRouter);
        this.apiRouter.use("/action", requireApiKey, new ActionApiRouter().actionRouter);

        // Public admin endpoints (no auth)
        this.apiRouter.get("/admin/account-lookup", (req, res) => {
            try {
                const email = req.query.email;
                if (!email) return res.status(400).json({ status: false, error: "Email is required" });
                const account = global.db.getAccountByEmail(email);
                if (!account) return res.status(404).json({ status: false, error: "Account not found" });
                const { password, ...safe } = account;
                res.json({ status: true, data: safe });
            } catch (err) {
                res.status(500).json({ status: false, error: err.message });
            }
        });

        // Public hook endpoint (no auth) — used by SIP web client mute/unmute
        this.apiRouter.post("/admin/users/:userName/hook", (req, res) => {
            try {
                const userName = req.params.userName;
                const { event } = req.body;
                if (!event) return res.status(400).json({ status: false, error: "event is required (off_hook or on_hook)" });
                const result = handleHttpHookEvent(userName, event);
                if (!result) return res.status(400).json({ status: false, error: "Failed to process hook event" });
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', detail: { userName } });
                res.json({ status: true, muted: event === 'on_hook' });
            } catch (err) {
                res.status(500).json({ status: false, error: err.message });
            }
        });

        // Public reconnect endpoint (no auth) — used by SIP web client join
        this.apiRouter.post("/admin/users/:userName/reconnect", async (req, res) => {
            try {
                const userName = req.params.userName;
                const userInfo = global.db.getUserInfo(userName);
                if (!userInfo || Object.keys(userInfo).length === 0) {
                    return res.status(404).json({ status: false, error: "User not found" });
                }
                if (userInfo.fsChannelUUID) {
                    const savedUuid = userInfo.fsChannelUUID;
                    userInfo.connectionState = 'hangup';
                    userInfo.fsChannelUUID = null;
                    userInfo.fsMemberId = null;
                    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                    global.db.setUserInfo(userName, userInfo);
                    getConnectionHandlers().delete(savedUuid);
                    await global.freeswitch.hangupCall(savedUuid, userName);
                }
                userInfo.connectionState = 'ideal';
                userInfo.error = null;
                userInfo.retryCount = 0;
                userInfo.errFallbackStage = 0;
                userInfo.errFallbackAt = null;
                userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(userName, userInfo);
                const result = await global.freeswitch.initiateCall(userName);
                global.db.logEvent('reconnect', userName, userInfo.room, 'Reconnect from web client');
                global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', detail: { userName } });
                res.json({ status: true, data: { reconnected: result } });
            } catch (err) {
                res.status(500).json({ status: false, error: err.message });
            }
        });

        // Public room SSE (no auth) — used by SIP web client CallerID
        this.apiRouter.get("/admin/events/room/:room", (req, res) => {
            const room = parseInt(req.params.room);
            if (!room) return res.status(400).end();
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            function buildRoomSnapshot() {
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

            res.write(`data: ${JSON.stringify({ type: 'connected', ...buildRoomSnapshot(), online: buildOnlineCounts() })}\n\n`);

            const onEvent = (eventData) => {
                if (eventData.scope === 'callerid' && eventData.room === room) {
                    res.write(`data: ${JSON.stringify({ type: 'callerid', ...buildRoomSnapshot(), online: buildOnlineCounts() })}\n\n`);
                }
            };

            global.db.eventEmitter.on('STATE_CHANGE', onEvent);
            req.on('close', () => global.db.eventEmitter.off('STATE_CHANGE', onEvent));
        });

        // Admin: SSE event endpoints use cookie auth, everything else uses Bearer
        this.apiRouter.use("/admin/events", requireSSEAuth, _sseRouter());
        this.apiRouter.use("/admin", requireAuth, _adminRoleGuard, adminRouter);
    }
}

function _sseRouter() {
    const router = express.Router();

    // /api/v1/admin/events/stream → this sees /stream
    router.get("/stream", (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('data: {"type":"connected"}\n\n');
        const onEvent = (eventData) => { res.write(`data: ${JSON.stringify(eventData)}\n\n`); };
        global.db.eventEmitter.on('EVENT_LOG', onEvent);
        global.db.eventEmitter.on('USER_UPDATE', onEvent);
        global.db.eventEmitter.on('STATE_CHANGE', onEvent);
        global.db.eventEmitter.on('BROADCAST', onEvent);
        req.on('close', () => {
            global.db.eventEmitter.off('EVENT_LOG', onEvent);
            global.db.eventEmitter.off('USER_UPDATE', onEvent);
            global.db.eventEmitter.off('STATE_CHANGE', onEvent);
            global.db.eventEmitter.off('BROADCAST', onEvent);
        });
    });

    // /api/v1/admin/events/room/:room → this sees /room/:room
    router.get("/room/:room", (req, res) => {
        const room = parseInt(req.params.room);
        if (!room) return res.status(400).end();
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const onEvent = (eventData) => {
            if (eventData.room === room || eventData.type === 'state_change') {
                res.write(`data: ${JSON.stringify(eventData)}\n\n`);
            }
        };
        global.db.eventEmitter.on('USER_UPDATE', onEvent);
        global.db.eventEmitter.on('STATE_CHANGE', onEvent);
        global.db.eventEmitter.on('BROADCAST', onEvent);
        req.on('close', () => {
            global.db.eventEmitter.off('USER_UPDATE', onEvent);
            global.db.eventEmitter.off('STATE_CHANGE', onEvent);
            global.db.eventEmitter.off('BROADCAST', onEvent);
        });
    });

    router.get("/fs-log", (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write('data: {"type":"connected"}\n\n');
        const onLog = (entry) => { res.write(`data: ${JSON.stringify(entry)}\n\n`); };
        global.db.eventEmitter.on('FS_LOG', onLog);
        req.on('close', () => { global.db.eventEmitter.off('FS_LOG', onLog); });
    });

    router.get("/phone-log", (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write('data: {"type":"connected"}\n\n');
        const onLog = (entry) => { res.write(`data: ${JSON.stringify(entry)}\n\n`); };
        global.db.eventEmitter.on('PHONE_LOG', onLog);
        req.on('close', () => { global.db.eventEmitter.off('PHONE_LOG', onLog); });
    });

    router.get("/debug-log", (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write('data: {"type":"connected"}\n\n');
        const onLog = (entry) => { res.write(`data: ${JSON.stringify(entry)}\n\n`); };
        global.db.eventEmitter.on('DEBUG_LOG', onLog);
        req.on('close', () => { global.db.eventEmitter.off('DEBUG_LOG', onLog); });
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
