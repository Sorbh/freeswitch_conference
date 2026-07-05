import express from "express";
import { mintAdminSession } from "../../service/listenerSessions.js";

// Sub-routers
import usersRouter from "./users.js";
import roomsRouter from "./rooms.js";
import broadcastsRouter from "./broadcasts.js";
import systemRouter from "./system.js";
import accountsRouter from "./accounts.js";
import ymcsRouter from "./ymcs.js";
import notificationsRouter from "./notifications.js";
import audioAdsRouter from "./audioAds.js";
import directCallsRouter from "./directCalls.js";
import shortUrlsRouter from "./shortUrls.js";

export let adminRouter = express.Router();

export function emitStateChange(scope, detail = {}) {
    global.db.eventEmitter.emit('STATE_EVENT', { type: 'state_event', scope, ...detail });
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

// POST /listen/session — ephemeral SIP creds for admin room monitoring
// (replaces the hardcoded admin-listen password that used to ship in the bundle)
adminRouter.post("/listen/session", (req, res) => {
    const roomId = parseInt(req.body?.room);
    if (!roomId) return res.status(400).json({ status: false, error: 'Invalid room' });
    const session = mintAdminSession(roomId, req.user?.email);
    res.json({
        status: true,
        data: {
            user: session.user,
            password: session.password,
            domain: global.config.FREESWITCH_PUBLIC_IP,
            wsUrl: global.config.PUBLIC_WSS_URL,
            expiresIn: 60,
        },
    });
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

// Mount sub-routers
adminRouter.use("/", usersRouter);
adminRouter.use("/", roomsRouter);
adminRouter.use("/", broadcastsRouter);
adminRouter.use("/", systemRouter);
adminRouter.use("/", accountsRouter);
adminRouter.use("/", ymcsRouter);
adminRouter.use("/", notificationsRouter);
adminRouter.use("/", audioAdsRouter);
adminRouter.use("/", directCallsRouter);
adminRouter.use("/", shortUrlsRouter);
