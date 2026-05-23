import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let adminRouter = express.Router();

// GET /dashboard — returns dashboard stats
adminRouter.get("/dashboard", (req, res) => {
    try {
        const stats = global.db.getDashboardStats();
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /users — returns all users with calculated fields
adminRouter.get("/users", (req, res) => {
    try {
        const users = global.db.getAllUserInfo();
        const now = Math.floor(Date.now() / 1000);
        const enriched = users.map(u => ({
            ...u,
            online_duration: u.online && u.lastConnectionStateUpdate
                ? now - u.lastConnectionStateUpdate
                : 0,
            last_seen: u.updatedAt || u.createdAt
        }));
        res.json({ status: true, data: enriched });
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
        const users = global.db.getAllUserInfo();
        const rooms = {};
        for (const user of users) {
            const room = user.room;
            if (!rooms[room]) {
                rooms[room] = {
                    room,
                    roomName: global.config.ROOM_NAME?.[room] || `Room ${room}`,
                    total: 0,
                    online: 0,
                    inCall: 0,
                    unmuted: 0,
                    members: []
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

    req.on('close', () => {
        global.db.eventEmitter.off('EVENT_LOG', onEvent);
        global.db.eventEmitter.off('USER_UPDATE', onEvent);
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

        let fsStatus = 'unknown';
        let conferenceList = '';
        try {
            conferenceList = await global.freeswitch.getConferenceList();
            fsStatus = 'connected';
        } catch {
            fsStatus = 'disconnected';
        }

        res.json({
            status: true,
            data: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                freeswitchStatus: fsStatus,
                conferenceList,
                dbSizeBytes: dbSize,
                nodeVersion: process.version,
                platform: process.platform
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
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }

        // Hangup existing call if any
        if (userInfo.fsChannelUUID) {
            await global.freeswitch.hangupCall(userInfo.fsChannelUUID);
        }

        // Reconnect
        const result = await global.freeswitch.originateToConference(userName);
        global.db.logEvent('reconnect', userName, userInfo.room, 'Admin forced reconnect');
        res.json({ status: true, data: result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/mute — mute a user
adminRouter.post("/users/:userName/mute", (req, res) => {
    try {
        const userName = req.params.userName;
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        if (!userInfo.mac) {
            return res.status(400).json({ status: false, error: "User has no MAC address" });
        }
        global.freeswitch.muteUser(userInfo.mac);
        global.db.logEvent('mute', userName, userInfo.room, 'Admin muted user');
        res.json({ status: true, message: `Mute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/unmute — unmute a user
adminRouter.post("/users/:userName/unmute", (req, res) => {
    try {
        const userName = req.params.userName;
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        if (!userInfo.mac) {
            return res.status(400).json({ status: false, error: "User has no MAC address" });
        }
        global.freeswitch.unmuteUser(userInfo.mac);
        global.db.logEvent('unmute', userName, userInfo.room, 'Admin unmuted user');
        res.json({ status: true, message: `Unmute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/room — change user's room
adminRouter.post("/users/:userName/room", (req, res) => {
    try {
        const userName = req.params.userName;
        const { room } = req.body;
        if (room === undefined || room === null) {
            return res.status(400).json({ status: false, error: "Room is required" });
        }
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || Object.keys(userInfo).length === 0) {
            return res.status(404).json({ status: false, error: "User not found" });
        }
        const oldRoom = userInfo.room;
        userInfo.room = parseInt(room);
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('room_change', userName, parseInt(room), `Moved from room ${oldRoom} to ${room}`);
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
        const { email, password, display_name, company_name, company_address, city, state, zip, room } = req.body;
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
            city,
            state,
            zip,
            room: room ? parseInt(room) : null,
        });

        const { password: _, ...safe } = account;
        global.db.logEvent('account_created', email, null, `Account created for ${company_name || email}`);
        res.status(201).json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /accounts/:id — update account
adminRouter.put("/accounts/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const fields = {};
        const allowed = ['email', 'password', 'display_name', 'company_name', 'company_address', 'city', 'state', 'zip', 'room', 'active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                fields[key] = key === 'room' ? parseInt(req.body[key]) : req.body[key];
            }
        }

        const updated = global.db.updateAccount(id, fields);
        if (!updated) return res.status(400).json({ status: false, error: "No valid fields to update" });

        const { password, ...safe } = updated;
        global.db.logEvent('account_updated', account.email, null, `Account updated`);
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /accounts/:id — delete account
adminRouter.delete("/accounts/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        global.db.deleteAccount(id);
        global.db.logEvent('account_deleted', account.email, null, `Account deleted`);
        res.json({ status: true, message: `Account ${account.email} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/honk — honk a room
adminRouter.post("/rooms/:roomId/honk", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        global.freeswitch.honkRoom(roomId);
        global.db.logEvent('honk', null, roomId, 'Admin honked room');
        res.json({ status: true, message: `Honk sent to room ${roomId}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});
