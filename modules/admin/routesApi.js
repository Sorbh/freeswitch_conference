import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";
import { logUser, invalidateDebugCache } from "../../service/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let adminRouter = express.Router();

function emitStateChange(scope, detail = {}) {
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope, ...detail });
}

// ── Call lifecycle helpers (used by admin API + shutdown) ──

export async function endCall(userName) {
    const userInfo = global.db.getUserInfo(userName);
    userInfo.connectionState = global.ConnectionState.HANGUP;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    if (userInfo.fsChannelUUID) {
        try { await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName); } catch (err) { console.error(`${userName} hangup error: ${err.message}`); }
        userInfo.fsChannelUUID = null;
        userInfo.fsMemberId = null;
    }
    global.db.setUserInfo(userName, userInfo);
    return userInfo;
}

export async function allEndCall() {
    const usersInfo = global.db.getAllUserInfo();
    for (const userInfo of usersInfo) { await endCall(userInfo.userName); }
    return global.db.getAllUserInfo();
}

// GET /dashboard — returns dashboard stats
adminRouter.get("/dashboard", (req, res) => {
    try {
        const stats = global.db.getDashboardStats();
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /users — returns all users with calculated fields + account details
adminRouter.get("/users", (req, res) => {
    try {
        const users = global.db.getAllUserInfo();
        const accounts = global.db.getAllAccounts();
        const accountByEmail = {};
        for (const acc of accounts) {
            accountByEmail[acc.email] = acc;
        }

        const now = Math.floor(Date.now() / 1000);
        const matchedEmails = new Set();

        const talkingUsers = global.freeswitch?.getTalkingUsers?.() || new Set();

        const enriched = users.map(u => {
            const email = u.userName.replace(/^sip:/, '');
            const account = accountByEmail[email] || accountByEmail[u.userName] || null;
            if (account) matchedEmails.add(account.email);
            const { password, ...safeAccount } = account || {};
            return {
                ...u,
                online_duration: u.online && u.lastConnectionStateUpdate
                    ? now - u.lastConnectionStateUpdate
                    : 0,
                last_seen: u.lastSeen || u.updatedAt || u.createdAt,
                talking: talkingUsers.has(u.userName),
                account: account ? safeAccount : null,
            };
        });

        const unmatchedAccounts = accounts
            .filter(acc => !matchedEmails.has(acc.email))
            .map(acc => {
                const { password, ...safeAccount } = acc;
                return {
                    userName: acc.email,
                    callerIdName: acc.display_name || acc.email,
                    room: acc.room,
                    connectionState: 'ideal',
                    authState: 'logout',
                    mute: true,
                    online: false,
                    online_duration: 0,
                    last_seen: acc.updated_at || acc.created_at,
                    updatedAt: acc.updated_at,
                    createdAt: acc.created_at,
                    account: safeAccount,
                    accountOnly: true,
                };
            });

        res.json({ status: true, data: [...enriched, ...unmatchedAccounts] });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /users/:userName — returns single user detail + online history
adminRouter.get("/users/:userName", (req, res) => {
    try {
        const userName = req.params.userName;
        const user = global.db.getUserInfo(userName);
        if (!user || Object.keys(user).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        const history = global.db.getOnlineHistory(userName);
        res.json({ status: true, data: { user, onlineHistory: history } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms — returns room stats + member list per room
adminRouter.get("/rooms", (req, res) => {
    try {
        const dbRooms = global.db.getAllRooms();
        const rooms = {};
        for (const r of dbRooms) {
            rooms[r.id] = {
                room: r.id,
                roomName: r.name,
                shortCode: r.short_code,
                timezone: r.timezone || 'America/Chicago',
                auto_transcribe: !!r.auto_transcribe,
                total: 0,
                online: 0,
                inCall: 0,
                unmuted: 0,
                members: [],
                accountCount: 0,
            };
        }

        const accounts = global.db.getAllAccounts();
        const accountCountByRoom = {};
        for (const acc of accounts) {
            if (acc.room) {
                accountCountByRoom[acc.room] = (accountCountByRoom[acc.room] || 0) + 1;
            }
        }
        for (const [roomId, count] of Object.entries(accountCountByRoom)) {
            if (rooms[roomId]) rooms[roomId].accountCount = count;
        }

        const users = global.db.getAllUserInfo();
        for (const user of users) {
            const room = user.room;
            if (!rooms[room]) {
                rooms[room] = {
                    room,
                    roomName: `Room ${room}`,
                    shortCode: '',
                    total: 0,
                    online: 0,
                    inCall: 0,
                    unmuted: 0,
                    members: [],
                    accountCount: accountCountByRoom[room] || 0,
                };
            }
            rooms[room].total++;
            if (user.online) rooms[room].online++;
            if (user.connectionState === 'connected') rooms[room].inCall++;
            if (!user.mute) rooms[room].unmuted++;
            rooms[room].members.push({
                userName: user.userName,
                callerIdName: user.callerIdName,
                online: user.online,
                connectionState: user.connectionState,
                mute: user.mute
            });
        }
        res.json({ status: true, data: Object.values(rooms) });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms/config — returns room names/codes for frontend
adminRouter.get("/rooms/config", (req, res) => {
    try {
        const rooms = global.db.getAllRooms();
        const names = {};
        const codes = {};
        for (const r of rooms) {
            names[r.id] = r.name;
            codes[r.id] = r.short_code;
        }
        res.json({ status: true, data: { rooms, names, codes } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms/:roomId — returns room detail with timeline
adminRouter.get("/rooms/:roomId", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const users = global.db.filter(u => u.room === roomId);
        const events = global.db.getEvents(50, null).filter(e => e.room === roomId);
        res.json({
            status: true,
            data: {
                room: roomId,
                roomName: global.config.ROOM_NAME?.[roomId] || `Room ${roomId}`,
                members: users,
                timeline: events
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts — returns broadcast stats
adminRouter.get("/broadcasts", (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const stats = global.db.getBroadcastStats(days, room);
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/list — paginated broadcast list with filters
adminRouter.get("/broadcasts/list", (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 100);
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const answered = req.query.answered !== undefined ? parseInt(req.query.answered) : undefined;
        const dateFrom = req.query.dateFrom ? Math.floor(new Date(req.query.dateFrom).getTime() / 1000) : undefined;
        const dateTo = req.query.dateTo ? Math.floor(new Date(req.query.dateTo + 'T23:59:59').getTime() / 1000) : undefined;

        const result = global.db.getPaginatedBroadcasts({ page, pageSize, room, answered, dateFrom, dateTo });
        res.json({ status: true, ...result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/recent — recent broadcasts with recordings
adminRouter.get("/broadcasts/recent", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const broadcasts = global.db.getRecentBroadcasts(limit, type);
        res.json({ status: true, data: broadcasts });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/timeline — hourly broadcast data
adminRouter.get("/broadcasts/timeline", (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = global.db.getBroadcastStats(days);
        res.json({ status: true, data: stats.hourly });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/availability — room user availability over time
adminRouter.get("/broadcasts/availability", (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 12;
        const data = global.db.getRoomSnapshots(hours);
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/hourly — stacked bar chart data
adminRouter.get("/broadcasts/hourly", (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 12;
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const data = global.db.getHourlyBroadcasts(hours, room);
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /broadcasts/:id/share — generate a share token for a broadcast
adminRouter.post("/broadcasts/:id/share", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        if (broadcast.share_token) {
            return res.json({ status: true, token: broadcast.share_token, url: `/b/${broadcast.share_token}` });
        }
        const token = global.db.generateBroadcastShareToken(id);
        res.json({ status: true, token, url: `/b/${token}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /broadcasts/:id/share — revoke a broadcast's share link
adminRouter.delete("/broadcasts/:id/share", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        global.db.revokeBroadcastShareToken(id);
        res.json({ status: true, message: "Share link revoked" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/activity — last N minutes for timeline
adminRouter.get("/broadcasts/activity", (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 30;
        const broadcasts = global.db.getTimelineBroadcasts(minutes);
        res.json({ status: true, data: broadcasts });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Settings (general) ──

adminRouter.get("/settings/general", (req, res) => {
    try {
        const s = global.db.getSettingsByPrefix('automute_');
        res.json({
            status: true,
            data: {
                automute_enabled: s.automute_enabled === '1',
                automute_timeout_ms: parseInt(s.automute_timeout_ms || '180000', 10),
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.put("/settings/general", (req, res) => {
    try {
        const { automute_enabled, automute_timeout_ms } = req.body;
        if (automute_enabled !== undefined) global.db.setSetting('automute_enabled', automute_enabled ? '1' : '0');
        if (automute_timeout_ms !== undefined) global.db.setSetting('automute_timeout_ms', String(Math.max(30000, parseInt(automute_timeout_ms))));
        res.json({ status: true, message: 'General settings updated' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Settings (audio/transcription) ──

adminRouter.get("/settings/audio", (req, res) => {
    try {
        const s = global.db.getSettingsByPrefix('stt_');
        res.json({
            status: true,
            data: {
                enabled: s.stt_enabled === '1',
                provider: s.stt_provider || 'deepgram',
                deepgram_api_key: s.stt_deepgram_api_key ? '••••' + (s.stt_deepgram_api_key || '').slice(-4) : '',
                deepgram_model: s.stt_deepgram_model || 'nova-3',
                openrouter_api_key: s.stt_openrouter_api_key ? '••••' + (s.stt_openrouter_api_key || '').slice(-4) : '',
                openrouter_model: s.stt_openrouter_model || 'openai/whisper-large-v3-turbo',
                language: s.stt_language || 'en',
                has_deepgram_key: !!s.stt_deepgram_api_key,
                has_openrouter_key: !!s.stt_openrouter_api_key,
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.put("/settings/audio", (req, res) => {
    try {
        const { enabled, provider, deepgram_api_key, deepgram_model, openrouter_api_key, openrouter_model, language } = req.body;
        if (enabled !== undefined) global.db.setSetting('stt_enabled', enabled ? '1' : '0');
        if (provider !== undefined) global.db.setSetting('stt_provider', provider);
        if (deepgram_api_key !== undefined && !deepgram_api_key.startsWith('••••')) {
            global.db.setSetting('stt_deepgram_api_key', deepgram_api_key);
        }
        if (deepgram_model !== undefined) global.db.setSetting('stt_deepgram_model', deepgram_model);
        if (openrouter_api_key !== undefined && !openrouter_api_key.startsWith('••••')) {
            global.db.setSetting('stt_openrouter_api_key', openrouter_api_key);
        }
        if (openrouter_model !== undefined) global.db.setSetting('stt_openrouter_model', openrouter_model);
        if (language !== undefined) global.db.setSetting('stt_language', language);
        res.json({ status: true, message: 'Audio settings updated' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /broadcasts/:id/transcribe — trigger manual transcription
adminRouter.post("/broadcasts/:id/transcribe", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        if (!broadcast.recording_path) return res.status(400).json({ status: false, error: "No recording available" });

        const { transcribeBroadcast } = await import('../../service/transcription.js');
        const transcript = await transcribeBroadcast(id);
        res.json({ status: true, data: { transcription: transcript, status: 'completed' } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/:id/transcription — get transcription for a broadcast
adminRouter.get("/broadcasts/:id/transcription", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        res.json({
            status: true,
            data: {
                transcription: broadcast.transcription || null,
                status: broadcast.transcription_status || null,
                error: broadcast.transcription_error || null,
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /events — returns recent events
adminRouter.get("/events", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const eventType = req.query.type || null;
        const events = global.db.getEvents(limit, eventType);
        res.json({ status: true, data: events });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /events/stream — SSE endpoint for real-time events
adminRouter.get("/events/stream", (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write('data: {"type":"connected"}\n\n');

    const onEvent = (eventData) => {
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

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

// GET /events/room/:room — lightweight SSE for web clients, only callerid events for their room
adminRouter.get("/events/room/:room", (req, res) => {
    const room = parseInt(req.params.room);
    if (!room) return res.status(400).end();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    function buildRoomSnapshot() {
        const connectedUsers = global.db.filter(u =>
            u.connectionState === 'connected' && u.room === room && !u.payment
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

// GET /system — returns system health
adminRouter.get("/system", async (req, res) => {
    try {
        const dbPath = path.join(__dirname, '..', '..', 'data', 'freeswitch_conference.db');
        let dbSize = 0;
        try {
            const stat = fs.statSync(dbPath);
            dbSize = stat.size;
        } catch { }

        let eslConnected = false;
        try {
            eslConnected = global.freeswitch.isConnected();
        } catch { }

        const fsStatus = eslConnected ? 'running' : 'disconnected';

        const users = global.db.getAllUserInfo();
        const registrationCount = users.filter(u => u.online || u.connectionState === 'connected').length;
        const totalUsers = users.length;
        const connectedCount = users.filter(u => u.connectionState === 'connected').length;

        res.json({
            status: true,
            data: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                freeswitchStatus: fsStatus,
                eslConnected,
                dbSize,
                registrationCount,
                totalUsers,
                connectedCount,
                nodeVersion: process.version,
                platform: process.platform,
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /system/audio-health — run audio health check
adminRouter.get("/system/audio-health", async (req, res) => {
    try {
        const { runAudioHealthCheck } = await import("../../service/audioHealth.js");
        const results = await runAudioHealthCheck();
        res.json({ status: true, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/reconnect — force reconnect a user
adminRouter.post("/users/:userName/reconnect", async (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', 'RECONNECT');
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }

        // End existing call: update DB first, clear handler, then kill on FreeSWITCH
        if (userInfo.fsChannelUUID) {
            const savedUuid = userInfo.fsChannelUUID;
            logUser(userName, 'API', `HANGUP -> uuid=${savedUuid.slice(0, 8)}`);
            userInfo.connectionState = 'hangup';
            userInfo.fsChannelUUID = null;
            userInfo.fsMemberId = null;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            global.db.setUserInfo(userName, userInfo);
            getConnectionHandlers().delete(savedUuid);
            await global.freeswitch.hangupCall(savedUuid, userName);
            logUser(userName, 'API', 'HANGUP complete');
        }

        // Reset state so callGate doesn't block on stale error/retry
        logUser(userName, 'API', 'ORIGINATE starting');
        userInfo.connectionState = 'ideal';
        userInfo.error = null;
        userInfo.retryCount = 0;
        userInfo.errFallbackStage = 0;
        userInfo.errFallbackAt = null;
        userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
        global.db.setUserInfo(userName, userInfo);

        const result = await global.freeswitch.initiateCall(userName);
        global.db.logEvent('reconnect', userName, userInfo.room, 'Reconnect from client');
        emitStateChange('users', { userName });
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true, data: { reconnected: result } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/kickout — toggle kickout for a user
adminRouter.post("/users/:userName/kickout", async (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', 'KICKOUT');
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }

        const email = userName.replace('sip:', '');
        const account = global.db.getAccountByEmail(email);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const kickout = account.kickout ? 0 : 1;
        global.db.updateAccount(account.id, { kickout });

        if (kickout) {
            const savedUuid = userInfo.fsChannelUUID;

            // Update DB BEFORE killing call — prevents _onCallHangup from reconnecting
            userInfo.connectionState = 'hangup';
            userInfo.fsChannelUUID = null;
            userInfo.fsMemberId = null;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            global.db.setUserInfo(userName, userInfo);
            global.db.logEvent('kickout', userName, userInfo.room, 'User kicked from conference');

            // Remove hangup handler so _onCallHangup doesn't trigger reconnect
            if (savedUuid) {
                getConnectionHandlers().delete(savedUuid);
                await global.freeswitch.hangupCall(savedUuid, userName);
            }
        } else {
            global.db.logEvent('kickout_removed', userName, userInfo.room, 'Kickout removed');
            global.db.setUserInfo(userName, userInfo);
        }

        res.json({ status: true, kickout: !!kickout });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/kickout-all — kickout all (or room-filtered) users and disconnect calls
adminRouter.post("/users/kickout-all", async (req, res) => {
    try {
        const roomId = req.body.room ? parseInt(req.body.room) : null;
        logUser('ALL', 'API', roomId ? `KICKOUT-ROOM-${roomId}` : 'KICKOUT-ALL');
        const accounts = global.db.getAllAccounts();
        const users = global.db.getAllUserInfo();
        let kicked = 0;
        let disconnected = 0;

        for (const account of accounts) {
            if (roomId && account.room !== roomId) continue;
            if (!account.kickout) {
                global.db.updateAccount(account.id, { kickout: 1 });
                kicked++;
            }
        }

        for (const user of users) {
            if (roomId && user.room !== roomId) continue;
            if (user.fsChannelUUID) {
                try {
                    await global.freeswitch.hangupCall(user.fsChannelUUID, user.userName);
                } catch (e) {
                    console.error(`[KICKOUT-ALL] Failed to hangup ${user.userName}:`, e.message);
                }
                disconnected++;
            }
            if (user.connectionState === 'connected' || user.connectionState === 'connecting') {
                user.connectionState = 'hangup';
                user.fsChannelUUID = null;
                user.fsMemberId = null;
                user.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(user.userName, user);
            }
        }

        const label = roomId ? `Room ${roomId}` : 'All';
        global.db.logEvent('kickout_all', null, roomId, `${label} users kicked: ${kicked} accounts, ${disconnected} calls ended`);
        emitStateChange('users');
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true, kicked, disconnected });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/kickin-all — remove kickout flag from all (or room-filtered) accounts
adminRouter.post("/users/kickin-all", (req, res) => {
    try {
        const roomId = req.body.room ? parseInt(req.body.room) : null;
        logUser('ALL', 'API', roomId ? `KICKIN-ROOM-${roomId}` : 'KICKIN-ALL');
        const accounts = global.db.getAllAccounts();
        let restored = 0;

        for (const account of accounts) {
            if (roomId && account.room !== roomId) continue;
            if (account.kickout) {
                global.db.updateAccount(account.id, { kickout: 0 });
                restored++;
            }
        }

        const label = roomId ? `Room ${roomId}` : 'All';
        global.db.logEvent('kickin_all', null, roomId, `${label} users restored: ${restored} accounts`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.json({ status: true, restored });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/reconnect-all — hangup and reconnect all (or room-filtered) online users
adminRouter.post("/users/reconnect-all", async (req, res) => {
    try {
        const roomId = req.body.room ? parseInt(req.body.room) : null;
        logUser('ALL', 'API', roomId ? `RECONNECT-ROOM-${roomId}` : 'RECONNECT-ALL');
        const users = global.db.getAllUserInfo();
        const { initiateCall } = await import("../../service/freeswitch/callGate.js");

        const targets = users.filter(u => {
            if (!u.online) return false;
            if (roomId && (u.currentRoom || u.room) !== roomId) return false;
            return true;
        });

        // Phase 1: hangup all in parallel
        await Promise.allSettled(targets.map(user => {
            if (!user.fsChannelUUID) return Promise.resolve();
            getConnectionHandlers().delete(user.fsChannelUUID);
            return global.freeswitch.hangupCall(user.fsChannelUUID, user.userName).catch(e => {
                console.error(`[RECONNECT-ALL] Hangup failed for ${user.userName}:`, e.message);
            });
        }));

        // Phase 2: reset state + initiate all calls
        for (const user of targets) {
            user.connectionState = 'ideal';
            user.fsChannelUUID = null;
            user.fsMemberId = null;
            user.error = null;
            user.retryCount = 0;
            user.errFallbackStage = 0;
            user.errFallbackAt = null;
            global.db.setUserInfo(user.userName, user);
            initiateCall(user.userName).catch(() => {});
        }
        const reconnected = targets.length;

        const label = roomId ? `Room ${roomId}` : 'All';
        global.db.logEvent('reconnect_all', null, roomId, `${label} users reconnected: ${reconnected}`);
        emitStateChange('users');
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true, reconnected });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/endcall — end a user's active call
adminRouter.post("/users/:userName/endcall", async (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', 'ENDCALL');
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        await endCall(userName);
        emitStateChange('users', { userName });
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/endcall-all — end all active calls
adminRouter.post("/users/endcall-all", async (req, res) => {
    try {
        logUser('ALL', 'API', 'ENDCALL-ALL');
        await allEndCall();
        emitStateChange('users');
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/mute — mute a user
adminRouter.post("/users/:userName/mute", (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', 'MUTE');
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        if (!userInfo.fsMemberId) {
            return res.status(400).json({ status: false, error: "User has no conference member ID" });
        }
        global.freeswitch.muteByMemberId(userInfo.room, userInfo.fsMemberId, userName);
        userInfo.mute = true;
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('mute', userName, userInfo.room, 'Muted');
        emitStateChange('users', { userName });
        res.json({ status: true, message: `Mute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/unmute — unmute a user
adminRouter.post("/users/:userName/unmute", (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', 'UNMUTE');
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        if (!userInfo.fsMemberId) {
            return res.status(400).json({ status: false, error: "User has no conference member ID" });
        }
        global.freeswitch.unmuteByMemberId(userInfo.room, userInfo.fsMemberId, userName);
        userInfo.mute = false;
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('unmute', userName, userInfo.room, 'Unmuted');
        emitStateChange('users', { userName });
        res.json({ status: true, message: `Unmute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/hook — web client hook event (mute/unmute)
adminRouter.post("/users/:userName/hook", (req, res) => {
    try {
        const userName = req.params.userName;
        const { event } = req.body;
        logUser(userName, 'HOOK', `event=${event}`);

        if (!event) {
            return res.status(400).json({ status: false, error: "event is required (off_hook or on_hook)" });
        }

        const result = handleHttpHookEvent(userName, event);
        if (!result) {
            return res.status(400).json({ status: false, error: "Failed to process hook event" });
        }

        emitStateChange('users', { userName });
        res.json({ status: true, muted: event === 'on_hook' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/room — change user's current room and reconnect call
adminRouter.post("/users/:userName/room", async (req, res) => {
    try {
        const userName = req.params.userName;
        logUser(userName, 'API', `ROOM-CHANGE -> ${req.body.room}`);
        const { room } = req.body;
        if (room === undefined || room === null) {
            return res.status(400).json({ status: false, error: "Room is required" });
        }
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        const oldRoom = userInfo.currentRoom || userInfo.room;
        userInfo.currentRoom = parseInt(room);
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('room_change', userName, parseInt(room), `Moved from room ${oldRoom} to ${room}`);

        // If user is in an active call, hangup — _onCallHangup auto-reconnects
        // since currentRoom is already updated above
        if (userInfo.connectionState === 'connected' && userInfo.fsChannelUUID) {
            try {
                await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName);
                logUser(userName, 'API', `HANGUP for room change -> ${room}`);
            } catch (e) {
                console.error(`[ROOM-CHANGE] Hangup failed for ${userName}:`, e.message);
            }
        }

        emitStateChange('users', { userName });
        emitStateChange('rooms');
        emitStateChange('dashboard');
        emitStateChange('callerid', { room: oldRoom });
        emitStateChange('callerid', { room: parseInt(room) });
        res.json({ status: true, message: `User ${userName} moved to room ${room}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// --- Accounts CRUD ---

// GET /accounts — list all accounts
adminRouter.get("/accounts", (req, res) => {
    try {
        const accounts = global.db.getAllAccounts();
        const safe = accounts.map(({ password, ...rest }) => rest);
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /accounts/:id — single account
adminRouter.get("/accounts/:id", (req, res) => {
    try {
        const account = global.db.getAccountById(parseInt(req.params.id));
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        const { password, ...safe } = account;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts — create account
adminRouter.post("/accounts", (req, res) => {
    try {
        logUser(req.body.email, 'API', 'CREATE-ACCOUNT');
        const { email, password, display_name, company_name, company_phone, company_address, city, state, zip, room } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: false, error: "Email and password are required" });
        }

        const existing = global.db.getAccountByEmail(email);
        if (existing) {
            return res.status(409).json({ status: false, error: "Account with this email already exists" });
        }

        const account = global.db.createAccount({
            email,
            password,
            displayName: display_name,
            companyName: company_name,
            companyAddress: company_address,
            companyPhone: company_phone,
            city,
            state,
            zip,
            room: room ? parseInt(room) : null,
        });

        const sipUser = `sip:${email}`;
        const existingUser = global.db.getUserInfo(sipUser);
        if (!existingUser || Object.keys(existingUser).length === 0) {
            global.db.setUserInfo(sipUser, {
                callerIdName: display_name || email,
                room: room ? parseInt(room) : null,
                connectionState: 'ideal',
                authState: 'logout',
                mute: true,
                online: false,
                payment: false,
                retryCount: 0,
            });
        }

        const { password: _, ...safe } = account;
        global.db.logEvent('account_created', email, null, `Account created for ${company_name || email}`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.status(201).json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /accounts/:id — update account
adminRouter.put("/accounts/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        logUser(account.email || `account:${id}`, 'API', 'UPDATE-ACCOUNT');

        const fields = {};
        const allowed = ['email', 'password', 'display_name', 'company_name', 'company_phone', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'kickout', 'debug'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                fields[key] = key === 'room' ? parseInt(req.body[key]) : req.body[key];
            }
        }

        const updated = global.db.updateAccount(id, fields);
        if (!updated) return res.status(400).json({ status: false, error: "No valid fields to update" });

        if (fields.debug !== undefined) invalidateDebugCache(account.email);

        if (fields.display_name !== undefined || fields.company_name !== undefined || fields.room !== undefined) {
            const userName = `sip:${account.email}`;
            const userInfo = global.db.getUserInfo(userName);
            if (userInfo && Object.keys(userInfo).length > 0) {
                if (fields.room !== undefined) userInfo.room = fields.room;
                if (fields.display_name !== undefined || fields.company_name !== undefined) {
                    const co = fields.company_name !== undefined ? fields.company_name : account.company_name;
                    const dn = fields.display_name !== undefined ? fields.display_name : account.display_name;
                    userInfo.callerIdName = `${co || ''} / ${dn || account.email}`;
                }
                global.db.setUserInfo(userName, userInfo);
            }
        }

        // Disconnect call when deactivating or kicking out
        if (fields.active === 0 || fields.active === false || fields.kickout === 1 || fields.kickout === true) {
            const userName = `sip:${account.email}`;
            const userInfo = global.db.getUserInfo(userName);
            if (userInfo && Object.keys(userInfo).length > 0) {
                const savedUuid = userInfo.fsChannelUUID;
                const reason = fields.kickout ? 'kickout' : 'deactivation';

                // Update DB BEFORE killing call — prevents _onCallHangup from reconnecting
                userInfo.connectionState = 'hangup';
                userInfo.fsChannelUUID = null;
                userInfo.fsMemberId = null;
                userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(userName, userInfo);
                global.db.logEvent(reason, userName, userInfo.room, `Disconnected on account ${reason}`);

                if (savedUuid) {
                    getConnectionHandlers().delete(savedUuid);
                    try {
                        await global.freeswitch.hangupCall(savedUuid, userName);
                    } catch (hangupErr) {
                        console.error(`Failed to hangup call for ${userName}:`, hangupErr.message);
                    }
                }
            }
        }

        const { password, ...safe } = updated;
        global.db.logEvent('account_updated', account.email, null, `Account ${fields.active === 0 || fields.active === false ? 'deactivated' : 'updated'}`);
        emitStateChange('users', { userName: account.email });
        emitStateChange('dashboard');
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/refresh-account-id — fetch ymcs_account_id from YMCS API
adminRouter.post("/accounts/:id/refresh-account-id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const { listAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");
        const result = await listAccounts({ filter: { username: account.email }, limit: 1 });
        const items = result?.items || result?.data || [];
        if (!items.length) {
            return res.status(404).json({ status: false, error: "Account not found in YMCS" });
        }

        const ymcsAccountId = String(items[0].id);
        global.db.updateAccount(id, { ymcs_account_id: ymcsAccountId });

        logUser(account.email || `account:${id}`, 'API', `REFRESH-ACCOUNT-ID → ${ymcsAccountId}`);
        res.json({ status: true, ymcs_account_id: ymcsAccountId });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/refresh-device-id — find ymcs device ID by MAC from user info
adminRouter.post("/accounts/:id/refresh-device-id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const userName = `sip:${account.email}`;
        const userInfo = global.db.getUserInfo(userName);
        const mac = userInfo?.mac?.replace(/[:-]/g, '');
        if (!mac) {
            return res.status(400).json({ status: false, error: "No MAC address — device must register first" });
        }

        const { listDevices } = await import("../../service/yealink/yealinkDevices.js");
        const result = await listDevices({ filter: { mac }, limit: 1 });
        const device = result?.data?.[0];
        if (!device) {
            return res.status(404).json({ status: false, error: `No device found for MAC ${mac}` });
        }

        global.db.updateAccount(id, { ymcs_device_id: device.id });
        logUser(account.email || `account:${id}`, 'API', `REFRESH-DEVICE-ID → ${device.id} (MAC: ${mac})`);
        res.json({ status: true, ymcs_device_id: device.id });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/reboot — reboot the device bound to this account
adminRouter.post("/accounts/:id/ymcs/reboot", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { rebootDevices } = await import("../../service/yealink/yealinkDevices.js");
        const result = await rebootDevices([account.ymcs_device_id], 1);

        logUser(account.email || `account:${id}`, 'API', `REBOOT device ${account.ymcs_device_id}`);
        res.json({ status: true, result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /accounts/:id/ymcs/device-config — fetch existing device config from YMCS
adminRouter.get("/accounts/:id/ymcs/device-config", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { ymcs } = await import("../../service/yealink/yealinkApi.js");
        const existing = await ymcs.post('/v2/dm/listDeviceConfigs', { filter: { deviceId: account.ymcs_device_id }, limit: 100 });
        const configs = existing?.data || [];
        let content = "";
        if (configs.length > 0) {
            const detail = await ymcs.get(`/v2/dm/deviceConfigs/${configs[0].id}`);
            content = detail?.content || "";
        }
        res.json({ status: true, content });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/push-config — push cfg content to this account's device
adminRouter.post("/accounts/:id/ymcs/push-config", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ status: false, error: "content is required" });

        const { ymcs } = await import("../../service/yealink/yealinkApi.js");

        const existing = await ymcs.post('/v2/dm/listDeviceConfigs', { filter: { deviceId: account.ymcs_device_id }, limit: 100 });
        const existingConfigs = existing?.data || [];

        if (existingConfigs.length > 0) {
            await ymcs.post('/v2/dm/delDeviceConfigs', { configIds: existingConfigs.map(c => c.id) });
        }

        const result = await ymcs.post('/v2/dm/deviceConfigs', {
            deviceId: account.ymcs_device_id,
            content: content.trim(),
            autoPush: true,
        });
        if (result?.id) {
            await ymcs.post(`/v2/dm/deviceConfigs/${result.id}/push`);
        }

        logUser(account.email || `account:${id}`, 'API', `PUSH-CONFIG to device ${account.ymcs_device_id}`);
        res.json({ status: true, message: "Config pushed" });
    } catch (err) {
        console.error('[PUSH-CONFIG]', err.message, err.response ? JSON.stringify(err.response) : '');
        res.status(500).json({ status: false, error: err.message, detail: err.response || null });
    }
});

// POST /accounts/:id/ymcs/update-sip-server — update SIP server on this account's YMCS SIP account
adminRouter.post("/accounts/:id/ymcs/update-sip-server", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_account_id) return res.status(400).json({ status: false, error: "No YMCS Account ID" });

        const { host, port } = req.body;
        if (!host || !port) return res.status(400).json({ status: false, error: "host and port required" });

        const { updateAccount: updateYmcsAccount } = await import("../../service/yealink/yealinkSipAccounts.js");
        const password = process.env.SIP_DEFAULT_PASSWORD || '12345678';

        await updateYmcsAccount(account.ymcs_account_id, {
            registerName: account.email,
            username: account.email,
            password,
            sipServer1: { host, port: parseInt(port) },
        });

        global.db.updateAccount(id, { sip_server_host: host, sip_server_port: parseInt(port) });
        logUser(account.email || `account:${id}`, 'API', `UPDATE-SIP-SERVER → ${host}:${port}`);
        res.json({ status: true, message: `Updated to ${host}:${port}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/rebind — unbind+rebind account on device
adminRouter.post("/accounts/:id/ymcs/rebind", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_account_id) return res.status(400).json({ status: false, error: "No YMCS Account ID" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { getBoundAccounts, unbindAccounts, bindAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        const bound = await getBoundAccounts(account.ymcs_device_id);
        const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

        if (boundList.length > 0) {
            await unbindAccounts(account.ymcs_device_id, boundList.map(a => a.accountId));
        }

        await bindAccounts(account.ymcs_device_id, [{ accountId: account.ymcs_account_id, lineId: 1, accountType: 0 }]);

        logUser(account.email || `account:${id}`, 'API', `REBIND ${account.display_name || account.email || account.ymcs_account_id} to device ${account.ymcs_device_id}`);
        res.json({ status: true, message: "Account rebound to device" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /ymcs/sync-all-device-ids — SSE: list all YMCS devices, match email to DB, save device ID
adminRouter.get("/ymcs/sync-all-device-ids", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { listDevices } = await import("../../service/yealink/yealinkDevices.js");
        const { getBoundAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        const allAccounts = global.db.getAllAccounts();
        const accountByEmail = {};
        for (const acc of allAccounts) {
            if (acc.email) accountByEmail[acc.email.toLowerCase().trim()] = acc;
        }

        send({ type: "info", message: "Fetching all devices from YMCS..." });
        const allDevices = [];
        let skip = 0;
        const limit = 100;
        let total = null;
        while (true) {
            const page = await listDevices({ filter: {}, limit, skip, autoCount: total === null });
            const devices = page?.data || [];
            if (total === null) total = page.total || 0;
            allDevices.push(...devices);
            skip += limit;
            if (devices.length < limit || skip >= total) break;
        }
        send({ type: "info", message: `Found ${allDevices.length} devices in YMCS` });

        let success = 0, failed = 0, skipped = 0;

        for (let i = 0; i < allDevices.length; i++) {
            const device = allDevices[i];
            const prefix = `[${i + 1}/${allDevices.length}] ${device.name || device.mac}`;

            try {
                const bound = await getBoundAccounts(device.id);
                const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

                if (!boundList.length) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — no account bound` });
                    continue;
                }

                const email = boundList[0].registerName?.toLowerCase()?.trim();
                if (!email) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — no registerName` });
                    continue;
                }

                const localAccount = accountByEmail[email];
                if (!localAccount) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — ${email} not in our DB` });
                    continue;
                }

                global.db.updateAccount(localAccount.id, {
                    ymcs_device_id: device.id,
                    ymcs_account_id: boundList[0].accountId,
                    sip_server_host: boundList[0].accountServer || null,
                });
                success++;
                logUser(localAccount.email || `account:${localAccount.id}`, 'API', `SYNC-DEVICE-ID → ${device.id}`);
                send({ type: "success", message: `${prefix} — ${email} → ${device.id}` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped, total: allDevices.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/update-all-device-accounts — SSE: for each account with account+device ID, unbind+rebind
adminRouter.get("/ymcs/update-all-device-accounts", async (req, res) => {
    const roomId = req.query.room ? parseInt(req.query.room) : null;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { unbindAccounts, bindAccounts, getBoundAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        let allAccounts = global.db.getAllAccounts();
        let roomLabel = "all";
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allAccounts = allAccounts.filter(a => a.room === roomId);
        }
        const eligible = allAccounts.filter(a => a.ymcs_account_id && a.ymcs_device_id);
        send({ type: "info", message: `Found ${allAccounts.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}accounts, ${eligible.length} eligible for rebind` });

        let success = 0, failed = 0;

        for (let i = 0; i < eligible.length; i++) {
            const acc = eligible[i];
            const prefix = `[${i + 1}/${eligible.length}] ${acc.email}`;

            try {
                const bound = await getBoundAccounts(acc.ymcs_device_id);
                const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

                if (boundList.length > 0) {
                    const oldIds = boundList.map(a => a.accountId);
                    await unbindAccounts(acc.ymcs_device_id, oldIds);
                }

                await bindAccounts(acc.ymcs_device_id, [{ accountId: acc.ymcs_account_id, lineId: 1, accountType: 0 }]);

                success++;
                logUser(acc.email || `account:${acc.id}`, 'API', `REBIND ${acc.display_name || acc.email || acc.ymcs_account_id} to device ${acc.ymcs_device_id}`);
                send({ type: "success", message: `${prefix} — rebound (unbound ${boundList.length} old)` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: eligible.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/update-all-sip-server — SSE: update SIP server host+port on all (or room-filtered) YMCS accounts
adminRouter.get("/ymcs/update-all-sip-server", async (req, res) => {
    const host = req.query.host;
    const port = parseInt(req.query.port);
    const roomId = req.query.room ? parseInt(req.query.room) : null;
    if (!host || !port) {
        return res.status(400).json({ status: false, error: "host and port query params required" });
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { updateAccount: updateYmcsAccount } = await import("../../service/yealink/yealinkSipAccounts.js");

        let roomLabel = "all";
        let allLocal = global.db.getAllAccounts();
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allLocal = allLocal.filter(a => a.room === roomId);
        }
        const accounts = allLocal.filter(a => a.ymcs_account_id).map(a => ({ accountId: a.ymcs_account_id, email: a.email }));
        send({ type: "info", message: `Found ${accounts.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}accounts, updating SIP server to ${host}:${port}...` });

        const password = process.env.SIP_DEFAULT_PASSWORD || '12345678';
        let success = 0, failed = 0;

        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const prefix = `[${i + 1}/${accounts.length}] ${acc.email || acc.accountId}`;

            try {
                await updateYmcsAccount(acc.accountId, {
                    registerName: acc.email,
                    username: acc.email,
                    password,
                    sipServer1: { host, port },
                });
                const localAccount = global.db.getAccountByEmail(acc.email);
                if (localAccount) {
                    global.db.updateAccount(localAccount.id, { sip_server_host: host, sip_server_port: String(port) });
                }
                success++;
                send({ type: "success", message: `${prefix} — updated to ${host}:${port}` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: accounts.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/reboot-all-devices — SSE: reboot all (or room-filtered) YMCS devices
adminRouter.get("/ymcs/reboot-all-devices", async (req, res) => {
    const roomId = req.query.room ? parseInt(req.query.room) : null;

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { rebootDevices } = await import("../../service/yealink/yealinkDevices.js");

        let roomLabel = "all";
        let allLocal = global.db.getAllAccounts();
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allLocal = allLocal.filter(a => a.room === roomId);
        }
        const allDevices = allLocal.filter(a => a.ymcs_device_id).map(a => ({ id: a.ymcs_device_id, email: a.email }));
        send({ type: "info", message: `Found ${allDevices.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}devices, sending reboot commands...` });

        let success = 0, failed = 0;

        // Reboot in batches of 50
        const batchSize = 50;
        for (let i = 0; i < allDevices.length; i += batchSize) {
            const batch = allDevices.slice(i, i + batchSize);
            const deviceIds = batch.map(d => d.id);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(allDevices.length / batchSize);

            try {
                const result = await rebootDevices(deviceIds, 1);
                const s = result?.successCount || 0;
                const f = result?.failureCount || 0;
                success += s;
                failed += f;
                send({ type: "success", message: `Batch ${batchNum}/${totalBatches} — ${s} rebooted, ${f} failed` });
                if (result?.errors?.length) {
                    for (const err of result.errors) {
                        send({ type: "error", message: `  ${err.field} — ${err.msg}` });
                    }
                }
            } catch (err) {
                failed += batch.length;
                send({ type: "error", message: `Batch ${batchNum}/${totalBatches} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: allDevices.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/sync-room-sites — SSE: fetch YMCS sites and match to local rooms
adminRouter.get("/ymcs/sync-room-sites", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
        const { listSites } = await import("../../service/yealink/yealinkSites.js");
        send({ type: "info", message: "Fetching YMCS sites..." });

        const result = await listSites({ limit: 200 });
        const sites = result?.data || [];
        send({ type: "info", message: `Found ${sites.length} YMCS sites` });

        const rooms = global.db.getAllRooms();
        let matched = 0, skipped = 0;

        for (const site of sites) {
            const siteName = (site.name || '').toLowerCase().trim();
            if (!siteName) { skipped++; continue; }

            const room = rooms.find(r => {
                const roomName = (r.name || '').toLowerCase().trim();
                const shortCode = (r.short_code || '').toLowerCase().trim();
                const roomId = String(r.id);
                return roomName === siteName || shortCode === siteName || roomId === siteName;
            });

            if (room) {
                global.db.updateRoom(room.id, { ymcs_site_id: site.id, ymcs_parent_site_id: site.parentId || null });
                send({ type: "success", message: `${site.name} → Room "${room.name}" (${room.id})` });
                matched++;
            } else {
                send({ type: "skip", message: `${site.name} — no matching room` });
                skipped++;
            }
        }

        send({ type: "done", success: matched, failed: 0, skipped, total: sites.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/push-config — SSE: push cfg content to all (or room-filtered) devices
adminRouter.get("/ymcs/push-config", async (req, res) => {
    const content = req.query.content;
    const roomId = req.query.room ? parseInt(req.query.room) : null;

    if (!content || !content.trim()) {
        return res.status(400).json({ status: false, error: "content query param required" });
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { ymcs } = await import("../../service/yealink/yealinkApi.js");

        let accounts = global.db.getAllAccounts();
        let roomLabel = "all";
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            accounts = accounts.filter(a => a.room === roomId);
        }
        const eligible = accounts.filter(a => a.ymcs_device_id);
        send({ type: "info", message: `Pushing config to ${eligible.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}devices...` });

        let success = 0, failed = 0;

        for (let i = 0; i < eligible.length; i++) {
            const acc = eligible[i];
            const prefix = `[${i + 1}/${eligible.length}] ${acc.email}`;

            try {
                const existing = await ymcs.post('/v2/dm/listDeviceConfigs', { filter: { deviceId: acc.ymcs_device_id }, limit: 100 });
                const existingConfigs = existing?.data || [];
                if (existingConfigs.length > 0) {
                    await ymcs.post('/v2/dm/delDeviceConfigs', { configIds: existingConfigs.map(c => c.id) });
                }
                const result = await ymcs.post('/v2/dm/deviceConfigs', {
                    deviceId: acc.ymcs_device_id,
                    content: content.trim(),
                    autoPush: true,
                });
                if (result?.id) {
                    await ymcs.post(`/v2/dm/deviceConfigs/${result.id}/push`);
                }
                success++;
                logUser(acc.email || `account:${acc.id}`, 'API', `PUSH-CONFIG to device ${acc.ymcs_device_id}`);
                send({ type: "success", message: `${prefix} — config pushed` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: eligible.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// --- Notification Channels ---

// GET /notifications — list all notification channels
adminRouter.get("/notifications", (req, res) => {
    try {
        const channels = global.db.getAllNotificationChannels();
        res.json({ status: true, data: channels });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /notifications/template-info — default template and available variables
adminRouter.get("/notifications/template-info", async (req, res) => {
    try {
        const { DEFAULT_TEMPLATE, TEMPLATE_VARS } = await import("../../service/notifier.js");
        res.json({ status: true, data: { defaultTemplate: DEFAULT_TEMPLATE, variables: TEMPLATE_VARS } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /notifications — create a notification channel
adminRouter.post("/notifications", (req, res) => {
    try {
        const { type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled } = req.body;
        if (type !== 'whatsapp' && (!bot_token || !chat_id)) {
            return res.status(400).json({ status: false, error: "bot_token and chat_id are required" });
        }
        const channel = global.db.createNotificationChannel({
            type, label, bot_token, chat_id,
            room: room ? parseInt(room) : null,
            message_template: message_template || null,
            send_answered: send_answered ?? 1,
            send_unanswered: send_unanswered ?? 1,
            enabled: enabled ?? 1,
        });
        res.status(201).json({ status: true, data: channel });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /notifications/:id — update a notification channel
adminRouter.put("/notifications/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = global.db.getNotificationChannel(id);
        if (!existing) return res.status(404).json({ status: false, error: "Channel not found" });
        const updated = global.db.updateNotificationChannel(id, req.body);
        res.json({ status: true, data: updated });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /notifications/:id — delete a notification channel
adminRouter.delete("/notifications/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = global.db.getNotificationChannel(id);
        if (!existing) return res.status(404).json({ status: false, error: "Channel not found" });
        global.db.deleteNotificationChannel(id);
        res.json({ status: true, message: "Channel deleted" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /notifications/:id/test — send a test message
adminRouter.post("/notifications/:id/test", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const channel = global.db.getNotificationChannel(id);
        if (!channel) return res.status(404).json({ status: false, error: "Channel not found" });

        const { testNotificationChannel } = await import("../../service/notifier.js");
        const result = await testNotificationChannel(channel);
        res.json({ status: true, data: result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// --- WhatsApp Connection (per channel) ---

adminRouter.get("/whatsapp/statuses", async (req, res) => {
    try {
        const { getAllStatuses } = await import("../../service/whatsapp.js");
        res.json({ status: true, data: getAllStatuses() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.get("/whatsapp/status/:id", async (req, res) => {
    try {
        const { getChannelStatus } = await import("../../service/whatsapp.js");
        res.json({ status: true, data: getChannelStatus(req.params.id) });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/whatsapp/connect/:id", async (req, res) => {
    try {
        const { connectChannel } = await import("../../service/whatsapp.js");
        await connectChannel(req.params.id);
        res.json({ status: true, message: "WhatsApp connecting..." });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/whatsapp/disconnect/:id", async (req, res) => {
    try {
        const { disconnectChannel } = await import("../../service/whatsapp.js");
        await disconnectChannel(req.params.id, true);
        res.json({ status: true, message: "WhatsApp disconnected" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.get("/whatsapp/groups/:id", async (req, res) => {
    try {
        const { getChannelGroups } = await import("../../service/whatsapp.js");
        const groups = await getChannelGroups(req.params.id);
        res.json({ status: true, data: groups });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /accounts/:id — delete account
adminRouter.delete("/accounts/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        logUser(account.email || `account:${id}`, 'API', 'DELETE-ACCOUNT');

        const userName = `sip:${account.email}`;
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length > 0) {
            if (userInfo.fsChannelUUID) {
                try { await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName); } catch (_) {}
            }
            global.db.deleteUserInfo(userName);
        }

        global.db.deleteAccount(id);
        global.db.logEvent('account_deleted', account.email, null, `Account deleted`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.json({ status: true, message: `Account ${account.email} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/create — create a new room
adminRouter.post("/rooms/create", (req, res) => {
    try {
        const { id, name, short_code, timezone } = req.body;
        if (!id || !name || !short_code) {
            return res.status(400).json({ status: false, error: "id, name, and short_code are required" });
        }
        const roomId = parseInt(id);
        const existing = global.db.getRoom(roomId);
        if (existing) {
            return res.status(409).json({ status: false, error: "Room with this ID already exists" });
        }
        const room = global.db.createRoom(roomId, name, short_code, timezone);
        global.db.logEvent('room_created', null, roomId, `Room ${name} (${short_code}) created`);
        emitStateChange('rooms');
        res.status(201).json({ status: true, data: room });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /rooms/:roomId — update room name/code
adminRouter.put("/rooms/:roomId", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const existing = global.db.getRoom(roomId);
        if (!existing) return res.status(404).json({ status: false, error: "Room not found" });
        const updated = global.db.updateRoom(roomId, req.body);
        global.db.logEvent('room_updated', null, roomId, `Room updated`);
        emitStateChange('rooms');
        res.json({ status: true, data: updated });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /rooms/:roomId/delete — delete a room
adminRouter.delete("/rooms/:roomId/delete", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const existing = global.db.getRoom(roomId);
        if (!existing) return res.status(404).json({ status: false, error: "Room not found" });
        global.db.deleteRoom(roomId);
        global.db.logEvent('room_deleted', null, roomId, `Room ${existing.name} deleted`);
        emitStateChange('rooms');
        res.json({ status: true, message: `Room ${existing.name} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/honk — honk a room
adminRouter.post("/rooms/:roomId/honk", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        logUser(`room:${roomId}`, 'API', 'HONK');
        global.freeswitch.honkRoom(roomId);
        global.db.logEvent('honk', null, roomId, 'Admin honked room');
        emitStateChange('rooms');
        res.json({ status: true, message: `Honk sent to room ${roomId}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/listen — dial an admin SIP client into the conference as listener
adminRouter.post("/rooms/:roomId/listen", async (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const { email } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "email is required" });

        const account = global.db.getAccountByEmail(email);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const sipUser = email.includes('@') ? email.replace('@', '.at.') : email;
        const fsIp = global.config.FREESWITCH_PUBLIC_IP;

        const { getConnection } = await import("../../service/freeswitch/connection.js");
        const conn = getConnection();

        const contact = await new Promise((resolve, reject) => {
            const lookups = [
                `sofia_contact ${profile}/${sipUser}@${fsIp}`,
                `sofia_contact ${profile}/${email}`,
            ];
            const tryLookup = (idx) => {
                if (idx >= lookups.length) { reject(new Error("Admin SIP client not registered")); return; }
                conn.api(lookups[idx], (resp) => {
                    const body = resp.getBody().trim();
                    if (!body || body.startsWith('-ERR') || body === 'error/user_not_registered') {
                        tryLookup(idx + 1);
                    } else {
                        resolve(body);
                    }
                });
            };
            tryLookup(0);
        });

        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;
        const roomName = global.config.ROOM_NAME[roomId] || roomId;
        const cmd = `originate {origination_caller_id_name='LISTEN-${roomName}',origination_caller_id_number='LISTEN'}${contact} &conference(${roomId}@${confProfile}++flags{mute})`;

        const result = await new Promise((resolve, reject) => {
            conn.api(cmd, (resp) => {
                const body = resp.getBody().trim();
                if (body.startsWith('+OK')) resolve(body.replace('+OK ', '').trim());
                else reject(new Error(body));
            });
        });

        logUser(email, 'API', `LISTEN room ${roomName}`);
        global.db.logEvent('listen', email, roomId, `Admin listening to ${roomName}`);
        res.json({ status: true, uuid: result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Network Announcements (Audio Ads) ──

import multer from 'multer';
import { execFileSync } from 'child_process';

const announcementsDir = path.join(__dirname, '..', '..', 'data', 'announcements');
if (!fs.existsSync(announcementsDir)) fs.mkdirSync(announcementsDir, { recursive: true });

const adUpload = multer({
    dest: announcementsDir,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^audio\//.test(file.mimetype) || /\.(wav|mp3|ogg|m4a)$/i.test(file.originalname)) cb(null, true);
        else cb(new Error('Only audio files are allowed'));
    },
});

adminRouter.get("/audio-ads", async (req, res) => {
    try {
        const ads = global.db.getAllAudioAds();
        const { getActivePlaybacks } = await import("../../service/announcements.js");
        const active = getActivePlaybacks();
        res.json({ status: true, data: ads, active });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/audio-ads", adUpload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: false, error: "Audio file is required" });

        const { label, rooms } = req.body;
        if (!label) return res.status(400).json({ status: false, error: "Label is required" });

        const parsedRooms = rooms ? JSON.parse(rooms) : [];
        const originalName = req.file.originalname;
        const wavPath = path.join(announcementsDir, `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.wav`);

        // Convert to WAV 8kHz mono for FreeSWITCH
        try {
            execFileSync('ffmpeg', ['-y', '-i', req.file.path, '-ar', '8000', '-ac', '1', wavPath], { stdio: 'ignore' });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ status: false, error: "Audio conversion failed" });
        }
        fs.unlinkSync(req.file.path);

        // Get duration
        let durationMs = 0;
        try {
            const probe = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath], { encoding: 'utf8' });
            durationMs = Math.round(parseFloat(probe.trim()) * 1000);
        } catch {}

        const ad = global.db.createAudioAd({ label, audio_path: wavPath, original_filename: originalName, rooms: parsedRooms, duration_ms: durationMs });
        res.status(201).json({ status: true, data: ad });
    } catch (err) {
        if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.put("/audio-ads/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.updateAudioAd(id, req.body);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        res.json({ status: true, data: ad });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/audio-ads/:id/replace", adUpload.single('audio'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.getAudioAd(id);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        if (!req.file) return res.status(400).json({ status: false, error: "Audio file is required" });

        const { label, rooms, enabled } = req.body;
        const originalName = req.file.originalname;
        const wavPath = path.join(announcementsDir, `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.wav`);

        try {
            execFileSync('ffmpeg', ['-y', '-i', req.file.path, '-ar', '8000', '-ac', '1', wavPath], { stdio: 'ignore' });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ status: false, error: "Audio conversion failed" });
        }
        fs.unlinkSync(req.file.path);

        if (ad.audio_path) try { fs.unlinkSync(ad.audio_path); } catch {}

        let durationMs = 0;
        try {
            const probe = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath], { encoding: 'utf8' });
            durationMs = Math.round(parseFloat(probe.trim()) * 1000);
        } catch {}

        const updates = { audio_path: wavPath, original_filename: originalName, duration_ms: durationMs };
        if (label) updates.label = label;
        if (rooms) updates.rooms = JSON.parse(rooms);
        if (enabled !== undefined) updates.enabled = parseInt(enabled);

        const result = global.db.updateAudioAd(id, updates);
        res.json({ status: true, data: result });
    } catch (err) {
        if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.delete("/audio-ads/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.getAudioAd(id);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        if (ad.audio_path) try { fs.unlinkSync(ad.audio_path); } catch {}
        global.db.deleteAudioAd(id);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/audio-ads/:id/play", async (req, res) => {
    try {
        const { playAd } = await import("../../service/announcements.js");
        const results = await playAd(parseInt(req.params.id));
        res.json({ status: true, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.post("/audio-ads/:id/stop", async (req, res) => {
    try {
        const { stopAllRooms } = await import("../../service/announcements.js");
        const ad = global.db.getAudioAd(parseInt(req.params.id));
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        const rooms = JSON.parse(ad.rooms || '[]');
        const { stopAd } = await import("../../service/announcements.js");
        for (const room of rooms) stopAd(room, 'admin');
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.get("/audio-ads/:id/stats", (req, res) => {
    try {
        const stats = global.db.getAdStats(parseInt(req.params.id));
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

adminRouter.get("/audio-ads/play-log", (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 100);
        const ad_id = req.query.ad_id ? parseInt(req.query.ad_id) : undefined;
        const result = global.db.getAdPlayLog({ ad_id, page, pageSize });
        res.json({ status: true, ...result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});
