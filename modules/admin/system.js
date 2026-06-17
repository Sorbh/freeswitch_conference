import express from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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

// ── SIP User-Agent Blocklist (iptables on port 5070 UDP) ──

const SIP_PORT = '5070';

function _parseBlockedUAs() {
    try {
        const output = execSync('iptables -S INPUT 2>/dev/null', { encoding: 'utf8' });
        const seen = new Set();
        const blocked = [];
        for (const line of output.split('\n')) {
            if (line.includes(`--dport ${SIP_PORT}`) && line.includes('--string') && line.includes('-j DROP')) {
                const match = line.match(/--string "([^"]+)"/);
                if (match && !seen.has(match[1])) {
                    seen.add(match[1]);
                    blocked.push(match[1]);
                }
            }
        }
        return blocked;
    } catch {
        return [];
    }
}

function _sanitizeUA(ua) {
    return ua.replace(/["`$\\]/g, '').trim();
}

function _applyIptablesRule(ua) {
    execSync(`iptables -I INPUT -p udp --dport ${SIP_PORT} -m string --string "${ua}" --algo bm -j DROP`);
    execSync(`iptables -I INPUT -p tcp --dport ${SIP_PORT} -m string --string "${ua}" --algo bm -j DROP`);
}

function _removeIptablesRule(ua) {
    try { execSync(`iptables -D INPUT -p udp --dport ${SIP_PORT} -m string --string "${ua}" --algo bm -j DROP`); } catch {}
    try { execSync(`iptables -D INPUT -p tcp --dport ${SIP_PORT} -m string --string "${ua}" --algo bm -j DROP`); } catch {}
}

export function reapplyBlocklist() {
    const uas = global.db.getBlockedUAs();
    const active = _parseBlockedUAs();
    let applied = 0;
    for (const ua of uas) {
        if (!active.includes(ua)) {
            try { _applyIptablesRule(ua); applied++; } catch {}
        }
    }
    if (uas.length) console.log(`SIP blocklist: ${uas.length} UAs in DB, ${applied} iptables rules applied`);
}

router.get("/system/sip-blocklist", (req, res) => {
    try {
        res.json({ status: true, data: global.db.getBlockedUAs() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/system/sip-blocklist", (req, res) => {
    try {
        const { user_agent } = req.body;
        if (!user_agent || typeof user_agent !== 'string' || !user_agent.trim()) {
            return res.status(400).json({ status: false, error: "user_agent is required" });
        }
        const ua = _sanitizeUA(user_agent);
        if (!ua) return res.status(400).json({ status: false, error: "Invalid user agent" });
        const existing = global.db.getBlockedUAs();
        if (existing.includes(ua)) {
            return res.status(409).json({ status: false, error: "Already blocked" });
        }
        _applyIptablesRule(ua);
        global.db.addBlockedUA(ua);
        res.json({ status: true, data: global.db.getBlockedUAs() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.delete("/system/sip-blocklist/:user_agent", (req, res) => {
    try {
        const ua = _sanitizeUA(decodeURIComponent(req.params.user_agent));
        _removeIptablesRule(ua);
        global.db.removeBlockedUA(ua);
        res.json({ status: true, data: global.db.getBlockedUAs() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
