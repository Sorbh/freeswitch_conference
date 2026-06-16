import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /events — returns recent event log from DB
router.get("/events", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const eventType = req.query.type || null;
        const events = global.db.getEvents(limit, eventType);
        res.json({ status: true, data: events });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /system — returns system health
router.get("/system", async (req, res) => {
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
router.get("/system/audio-health", async (req, res) => {
    try {
        const { runAudioHealthCheck } = await import("../../service/audioHealth.js");
        const results = await runAudioHealthCheck();
        res.json({ status: true, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
