import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { handleHttpHookEvent } from "../../service/phoneEvents.js";

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

        let conferenceList = '';
        try {
            conferenceList = await global.freeswitch.getConferenceList();
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
                conferenceList,
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
        console.log(`[API] RECONNECT ${userName}`);
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
        console.log(`[API] KICKOUT ${userName}`);
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
        }

        emitStateChange('users', { userName });
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true, kickout: !!kickout });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/kickout-all — kickout all users and disconnect all calls
adminRouter.post("/users/kickout-all", async (req, res) => {
    try {
        console.log('[API] KICKOUT-ALL');
        const accounts = global.db.getAllAccounts();
        const users = global.db.getAllUserInfo();
        let kicked = 0;
        let disconnected = 0;

        for (const account of accounts) {
            if (!account.kickout) {
                global.db.updateAccount(account.id, { kickout: 1 });
                kicked++;
            }
        }

        for (const user of users) {
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

        global.db.logEvent('kickout_all', null, null, `All users kicked: ${kicked} accounts, ${disconnected} calls ended`);
        emitStateChange('users');
        emitStateChange('rooms');
        emitStateChange('dashboard');
        res.json({ status: true, kicked, disconnected });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/mute — mute a user
adminRouter.post("/users/:userName/mute", (req, res) => {
    try {
        const userName = req.params.userName;
        console.log(`[API] MUTE ${userName}`);
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
        console.log(`[API] UNMUTE ${userName}`);
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
        console.log(`[API] HOOK ${userName} event=${event}`);

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

// POST /users/:userName/room — change user's room
adminRouter.post("/users/:userName/room", (req, res) => {
    try {
        const userName = req.params.userName;
        console.log(`[API] ROOM-CHANGE ${userName} -> ${req.body.room}`);
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
        emitStateChange('users', { userName });
        emitStateChange('rooms');
        emitStateChange('dashboard');
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
        console.log(`[API] CREATE-ACCOUNT ${req.body.email}`);
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
        console.log(`[API] UPDATE-ACCOUNT id=${id}`);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const fields = {};
        const allowed = ['email', 'password', 'display_name', 'company_name', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'kickout'];
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

// DELETE /accounts/:id — delete account
adminRouter.delete("/accounts/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        console.log(`[API] DELETE-ACCOUNT id=${id}`);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        global.db.deleteAccount(id);
        global.db.logEvent('account_deleted', account.email, null, `Account deleted`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.json({ status: true, message: `Account ${account.email} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/honk — honk a room
adminRouter.post("/rooms/:roomId/honk", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        console.log(`[API] HONK room=${roomId}`);
        global.freeswitch.honkRoom(roomId);
        global.db.logEvent('honk', null, roomId, 'Admin honked room');
        emitStateChange('rooms');
        res.json({ status: true, message: `Honk sent to room ${roomId}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});
