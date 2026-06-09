import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";
import { logUser } from "../../service/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let adminRouter = express.Router();

function emitStateChange(scope, detail = {}) {
    global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope, ...detail });
}

// GET /account-lookup?email=... — public endpoint to get account info after SIP auth
adminRouter.get("/account-lookup", (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ status: false, error: "Email is required" });
        const account = global.db.getAccountByEmail(email);
        if (!account) {
            return res.status(404).json({ status: false, error: "Account not found" });
        }
        const { password, ...safe } = account;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

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
        const stats = global.db.getBroadcastStats(days);
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/recent — recent broadcasts with recordings
adminRouter.get("/broadcasts/recent", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const broadcasts = global.db.getRecentBroadcasts(limit);
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
        const data = global.db.getHourlyBroadcasts(hours);
        res.json({ status: true, data });
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

// GET /events/fs-log — SSE endpoint for FreeSWITCH log stream
adminRouter.get("/events/fs-log", (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write('data: {"type":"connected"}\n\n');

    const onLog = (entry) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    global.db.eventEmitter.on('FS_LOG', onLog);

    req.on('close', () => {
        global.db.eventEmitter.off('FS_LOG', onLog);
    });
});

// GET /events/phone-log — SSE endpoint for phone syslog stream
adminRouter.get("/events/phone-log", (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write('data: {"type":"connected"}\n\n');

    const onLog = (entry) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    global.db.eventEmitter.on('PHONE_LOG', onLog);

    req.on('close', () => {
        global.db.eventEmitter.off('PHONE_LOG', onLog);
    });
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
            userInfo.connectionState = 'hangup';
            userInfo.fsChannelUUID = null;
            userInfo.fsMemberId = null;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            global.db.setUserInfo(userName, userInfo);
            getConnectionHandlers().delete(savedUuid);
            await global.freeswitch.hangupCall(savedUuid, userName);
            // Wait for FreeSWITCH to send BYE to client
            await new Promise(r => setTimeout(r, 1000));
        }

        // Reset state so callGate doesn't block on stale error/retry
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
        let reconnected = 0;

        const { initiateCall } = await import("../../service/freeswitch/callGate.js");

        for (const user of users) {
            if (!user.online) continue;
            if (roomId && (user.currentRoom || user.room) !== roomId) continue;

            if (user.fsChannelUUID) {
                try {
                    getConnectionHandlers().delete(user.fsChannelUUID);
                    await global.freeswitch.hangupCall(user.fsChannelUUID, user.userName);
                } catch (e) {
                    console.error(`[RECONNECT-ALL] Hangup failed for ${user.userName}:`, e.message);
                }
            }

            user.connectionState = 'ideal';
            user.fsChannelUUID = null;
            user.fsMemberId = null;
            user.error = null;
            user.retryCount = 0;
            user.errFallbackStage = 0;
            user.errFallbackAt = null;
            global.db.setUserInfo(user.userName, user);

            initiateCall(user.userName).catch(() => {});
            reconnected++;
        }

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

        // If user is in an active call, hangup and reconnect in new room
        if (userInfo.connectionState === 'connected' && userInfo.fsChannelUUID) {
            try {
                getConnectionHandlers().delete(userInfo.fsChannelUUID);
                await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName);
                logUser(userName, 'API', `HANGUP for room change`);
            } catch (e) {
                console.error(`[ROOM-CHANGE] Hangup failed for ${userName}:`, e.message);
            }
            // Short delay then reconnect in new room
            setTimeout(async () => {
                try {
                    const freshUser = global.db.getUserInfo(userName);
                    if (freshUser && freshUser.online) {
                        const { initiateCall } = await import("../../service/freeswitch/callGate.js");
                        await initiateCall(userName);
                        logUser(userName, 'API', `RECONNECT in room ${room}`);
                    }
                } catch (e) {
                    console.error(`[ROOM-CHANGE] Reconnect failed for ${userName}:`, e.message);
                }
            }, 1500);
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
        const allowed = ['email', 'password', 'display_name', 'company_name', 'company_phone', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'kickout'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                fields[key] = key === 'room' ? parseInt(req.body[key]) : req.body[key];
            }
        }

        const updated = global.db.updateAccount(id, fields);
        if (!updated) return res.status(400).json({ status: false, error: "No valid fields to update" });

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
        if (!bot_token || !chat_id) {
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
        const { id, name, short_code } = req.body;
        if (!id || !name || !short_code) {
            return res.status(400).json({ status: false, error: "id, name, and short_code are required" });
        }
        const roomId = parseInt(id);
        const existing = global.db.getRoom(roomId);
        if (existing) {
            return res.status(409).json({ status: false, error: "Room with this ID already exists" });
        }
        const room = global.db.createRoom(roomId, name, short_code);
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
