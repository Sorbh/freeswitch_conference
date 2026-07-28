import express from "express";
import { logUser, logSystem } from "../../service/logger.js";
import { changeUserRoom } from "../admin/users.js";
import { declineByUserName } from "../../service/freeswitch/directCall.js";
import { handleHttpHookEvent, isSyslogActive, isYealinkHookSuppressed } from "../../service/phoneEvents.js";

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

// GET /onhook?mac=... — Action URL: phone on-hook (syslog fallback)
yealinkRouter.get("/onhook", (req, res) => {
    try {
        const mac = _extractMac(req);
        const userInfo = _findUserByMac(mac, _getClientIp(req));
        if (!userInfo) return res.json({ status: false, error: "User not found" });
        if (userInfo.mac && isSyslogActive(userInfo.mac)) return res.json({ status: true, message: "syslog active" });
        if (isYealinkHookSuppressed(userInfo)) return res.json({ status: true, message: "web takeover active" });
        logSystem('YEALINK', `ACTION onhook (syslog fallback) ${userInfo.callerIdName || userInfo.userName}`);
        handleHttpHookEvent(userInfo.userName, 'on_hook');
        res.json({ status: true, message: "onhook" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /offhook?mac=... — Action URL: phone off-hook (syslog fallback)
yealinkRouter.get("/offhook", (req, res) => {
    try {
        const mac = _extractMac(req);
        const userInfo = _findUserByMac(mac, _getClientIp(req));
        if (!userInfo) return res.json({ status: false, error: "User not found" });
        if (userInfo.mac && isSyslogActive(userInfo.mac)) return res.json({ status: true, message: "syslog active" });
        if (isYealinkHookSuppressed(userInfo)) return res.json({ status: true, message: "web takeover active" });
        logSystem('YEALINK', `ACTION offhook (syslog fallback) ${userInfo.callerIdName || userInfo.userName}`);
        handleHttpHookEvent(userInfo.userName, 'off_hook');
        res.json({ status: true, message: "offhook" });
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
