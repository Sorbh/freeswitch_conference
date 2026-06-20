import express from "express";
import { logUser, logSystem } from "../../service/logger.js";
import { sendRoomChangeNotification } from "../../service/rdlSocket.js";
import { changeUserRoom } from "../admin/users.js";
import { acceptByUserName, declineByUserName, hangupDirectCallByUserName, hasPendingCall, isInDirectCall, isPendingCaller, noteDirectCallHookEvent, shouldKeepDirectCallMuted } from "../../service/freeswitch/directCall.js";

export const yealinkRouter = express.Router();

function _getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim().replace('::ffff:', '');
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp.trim().replace('::ffff:', '');
    return (req.ip || '').replace('::ffff:', '');
}

function _findUserByMac(mac, clientIp) {
    if (!mac) return null;
    const formatted = mac.match(/.{1,2}/g).join(':').toLowerCase();
    const userInfo = global.db.findUserInfo('mac', formatted);
    if (!userInfo || Object.keys(userInfo).length === 0) return null;

    if (clientIp && userInfo.ip) {
        if (clientIp !== userInfo.ip) {
            logSystem('YEALINK', `IP mismatch for MAC ${formatted}: req=${clientIp} db=${userInfo.ip}`);
            return null;
        }
    }

    return userInfo;
}

function _extractMac(req) {
    let mac = req.query.mac || null;
    if (mac && String(mac).includes('$')) mac = null;
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
        logSystem('YEALINK', `API /onhook mac=${_extractMac(req)} ip=${_getClientIp(req)}`);
        const userInfo = _findUserByMac(_extractMac(req), _getClientIp(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });
        noteDirectCallHookEvent(userInfo.userName, 'on_hook');
        if (isInDirectCall(userInfo.userName)) {
            hangupDirectCallByUserName(userInfo.userName, 'yealink_on_hook');
            logUser(userInfo.userName, 'YEALINK', 'ONHOOK (end direct call)');
            return res.json({ status: true, message: "Direct call ending" });
        }
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
        logSystem('YEALINK', `API /offhook mac=${_extractMac(req)} ip=${_getClientIp(req)}`);
        const userInfo = _findUserByMac(_extractMac(req), _getClientIp(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });
        noteDirectCallHookEvent(userInfo.userName, 'off_hook');
        if (hasPendingCall(userInfo.userName)) {
            acceptByUserName(userInfo.userName);
            logUser(userInfo.userName, 'YEALINK', 'OFFHOOK (accept direct call)');
            return res.json({ status: true, message: "Direct call accepted" });
        }
        if (isPendingCaller(userInfo.userName)) {
            logUser(userInfo.userName, 'YEALINK', 'OFFHOOK ignored — waiting for direct call answer');
            return res.json({ status: true, message: "Waiting for direct call answer" });
        }
        if (shouldKeepDirectCallMuted(userInfo.userName)) {
            const activeRoom = userInfo.currentRoom || userInfo.room;
            if (userInfo.fsMemberId && global.freeswitch?.muteByMemberId) {
                global.freeswitch.muteByMemberId(activeRoom, userInfo.fsMemberId, userInfo.userName);
            }
            userInfo.mute = true;
            global.db.setUserInfo(userInfo.userName, userInfo);
            global.db.eventEmitter.emit('STATE_CHANGE', { type: 'state_change', scope: 'users', userName: userInfo.userName });
            logUser(userInfo.userName, 'YEALINK', 'OFFHOOK ignored — direct call returned muted');
            return res.json({ status: true, message: "Returned to room muted" });
        }
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

// GET /direct-call/decline?mac=... — softkey decline for pending private direct call
yealinkRouter.get("/direct-call/decline", (req, res) => {
    try {
        logSystem('YEALINK', `API /direct-call/decline mac=${_extractMac(req)} ip=${_getClientIp(req)}`);
        const userInfo = _findUserByMac(_extractMac(req), _getClientIp(req));
        if (!userInfo) return res.status(400).type('application/xml').send(_yealinkMessage("User not found"));

        const declined = declineByUserName(userInfo.userName, 'yealink_decline');
        if (!declined) return res.status(409).type('application/xml').send(_yealinkMessage("No pending direct call"));

        logUser(userInfo.userName, 'YEALINK', 'DIRECT DECLINE');
        res.type('application/xml').send(_yealinkMessage("Private call declined"));
    } catch (err) {
        res.status(500).type('application/xml').send(_yealinkMessage(err.message));
    }
});

// GET /updateroom?mac=...&room=... — softkey room switch, hang up and reconnect to new room
yealinkRouter.get("/updateroom", async (req, res) => {
    try {
        logSystem('YEALINK', `API /updateroom mac=${_extractMac(req)} room=${req.query.room} ip=${_getClientIp(req)}`);
        const userInfo = _findUserByMac(_extractMac(req), _getClientIp(req));
        if (!userInfo) return res.status(400).json({ status: false, error: "User not found" });

        const newRoom = parseInt(req.query.room);
        if (!newRoom) return res.status(400).json({ status: false, error: "room is required" });

        await changeUserRoom(userInfo.userName, newRoom, 'yealink-softkey');

        if (userInfo.userId) {
            sendRoomChangeNotification(userInfo.userId, newRoom);
        } else {
            logSystem('YEALINK', `No userId for ${userInfo.userName}, skipping panel notification`);
        }

        res.json({ status: true, message: `Room changed to ${newRoom}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

function _yealinkMessage(message) {
    const safeMessage = String(message || '').replace(/[<>&'"]/g, (char) => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
    }[char]));
    return `<YealinkIPPhoneTextScreen Timeout="2"><Title>Redline</Title><Text>${safeMessage}</Text></YealinkIPPhoneTextScreen>`;
}
