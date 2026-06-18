import express from "express";
import { logUser, logSystem } from "../../service/logger.js";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { initiateCall } from "../../service/freeswitch/callGate.js";

export const yealinkRouter = express.Router();

function _findUserByMac(mac) {
    if (!mac) return null;
    const formatted = mac.match(/.{1,2}/g).join(':').toLowerCase();
    return global.db.findUserInfo('mac', formatted);
}

function _extractMac(req) {
    let mac = req.query.mac || null;
    if (!mac) {
        const ua = req.headers["user-agent"];
        if (ua && ua.includes("Yealink")) {
            const m = ua.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            mac = m ? m[0].replace(/[:-]/g, '') : null;
        }
    }
    return mac;
}

// GET /onhook?mac=... — phone on-hook, mute user in conference
yealinkRouter.get("/onhook", (req, res) => {
    try {
        const userInfo = _findUserByMac(_extractMac(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });
        global.freeswitch.muteUser(userInfo.mac.toLowerCase());
        userInfo.mute = true;
        global.db.setUserInfo(userInfo.userName, userInfo);
        logSystem('PHONE', `ON HOOK ${userInfo.callerIdName || userInfo.userName} (yealink-api)`);
        logUser(userInfo.userName, 'YEALINK', 'ONHOOK (mute)');
        res.json({ status: true, message: "onHook api working fine" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /offhook?mac=... — phone off-hook, unmute user in conference
yealinkRouter.get("/offhook", (req, res) => {
    try {
        const userInfo = _findUserByMac(_extractMac(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });
        global.freeswitch.unmuteUser(userInfo.mac.toLowerCase());
        userInfo.mute = false;
        global.db.setUserInfo(userInfo.userName, userInfo);
        logSystem('PHONE', `OFF HOOK ${userInfo.callerIdName || userInfo.userName} (yealink-api)`);
        logUser(userInfo.userName, 'YEALINK', 'OFFHOOK (unmute)');
        res.json({ status: true, message: "offhook api working fine" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /updateroom?mac=...&room=... — softkey room switch, hang up and reconnect to new room
yealinkRouter.get("/updateroom", async (req, res) => {
    try {
        const userInfo = _findUserByMac(_extractMac(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });

        const oldRoom = userInfo.currentRoom || userInfo.room;
        const newRoom = parseInt(req.query.room);
        if (!newRoom) return res.status(400).json({ status: false, error: "room is required" });

        const oldRoomName = global.config.ROOM_NAME?.[oldRoom] || oldRoom;
        const newRoomName = global.config.ROOM_NAME?.[newRoom] || newRoom;
        const userName = userInfo.userName;

        const oldUuid = userInfo.fsChannelUUID;
        if (oldUuid) {
            getConnectionHandlers().delete(oldUuid);
            global.freeswitch.hangupCall(oldUuid, userName).catch(() => {});
        }

        userInfo.currentRoom = newRoom;
        userInfo.connectionState = 'ideal';
        userInfo.fsChannelUUID = null;
        userInfo.fsMemberId = null;
        userInfo.error = null;
        userInfo.retryCount = 0;
        userInfo.errFallbackStage = 0;
        userInfo.errFallbackAt = null;
        userInfo.mute = true;
        global.db.setUserInfo(userName, userInfo);
        logUser(userName, 'YEALINK', `ROOM-CHANGE ${oldRoomName} -> ${newRoomName} (softkey)`);

        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName });
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'rooms' });
        global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'dashboard' });

        await initiateCall(userName);

        res.json({ status: true, message: `Room changed: ${oldRoomName} -> ${newRoomName}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});
