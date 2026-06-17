import express from "express";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { handleHttpHookEvent, getActiveMacs } from "../../service/phoneEvents.js";
import { logUser } from "../../service/logger.js";
import { emitStateChange, endCall, allEndCall } from "./routesApi.js";

const router = express.Router();

// GET /users — returns all users with calculated fields + account details
router.get("/users", (req, res) => {
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
        const activeMacs = getActiveMacs();

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
                syslogActive: u.mac ? activeMacs.has(u.mac) : false,
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
router.get("/users/:userName", (req, res) => {
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

// POST /users/:userName/reconnect — force reconnect a user
router.post("/users/:userName/reconnect", async (req, res) => {
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
router.post("/users/:userName/kickout", async (req, res) => {
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
router.post("/users/kickout-all", async (req, res) => {
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
router.post("/users/kickin-all", (req, res) => {
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
router.post("/users/reconnect-all", async (req, res) => {
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
router.post("/users/:userName/endcall", async (req, res) => {
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
router.post("/users/endcall-all", async (req, res) => {
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
router.post("/users/:userName/mute", (req, res) => {
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
        const activeRoom = userInfo.currentRoom || userInfo.room;
        global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userName);
        userInfo.mute = true;
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('mute', userName, activeRoom, 'Muted');
        emitStateChange('users', { userName });
        res.json({ status: true, message: `Mute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/unmute — unmute a user
router.post("/users/:userName/unmute", (req, res) => {
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
        const activeRoom = userInfo.currentRoom || userInfo.room;
        global.freeswitch.unmuteByMemberId(activeRoom, userInfo.fsMemberId, userName);
        userInfo.mute = false;
        global.db.setUserInfo(userName, userInfo);
        global.db.logEvent('unmute', userName, activeRoom, 'Unmuted');
        emitStateChange('users', { userName });
        res.json({ status: true, message: `Unmute command sent for ${userName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /users/:userName/hook — web client hook event (mute/unmute)
router.post("/users/:userName/hook", (req, res) => {
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
router.post("/users/:userName/room", async (req, res) => {
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

export default router;
