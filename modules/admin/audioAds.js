import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const announcementsDir = path.join(__dirname, '..', '..', 'data', 'announcements');
if (!fs.existsSync(announcementsDir)) fs.mkdirSync(announcementsDir, { recursive: true });

const adUpload = multer({
    dest: announcementsDir,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^audio\//.test(file.mimetype) || /\.(wav|mp3|ogg|m4a)$/i.test(file.originalname)) cb(null, true);
        else cb(new Error('Only audio files are allowed'));
    },
});

router.get("/audio-ads", async (req, res) => {
    try {
        const ads = global.db.getAllAudioAds();
        const { getActivePlaybacks } = await import("../../service/announcements.js");
        const active = getActivePlaybacks();
        res.json({ status: true, data: ads, active });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/audio-ads", adUpload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: false, error: "Audio file is required" });

        const { label, rooms, schedule_times, timezone, schedule_type, interval_minutes, window_start, window_end } = req.body;
        if (!label) return res.status(400).json({ status: false, error: "Label is required" });

        const parsedRooms = rooms ? JSON.parse(rooms) : [];
        const parsedSchedule = schedule_times ? JSON.parse(schedule_times) : [];
        const originalName = req.file.originalname;
        const wavPath = path.join(announcementsDir, `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.wav`);

        // Convert to WAV 8kHz mono for FreeSWITCH
        try {
            await execFileAsync('ffmpeg', ['-y', '-i', req.file.path, '-ar', '8000', '-ac', '1', wavPath], { timeout: 60000 });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ status: false, error: "Audio conversion failed" });
        }
        fs.unlinkSync(req.file.path);

        // Get duration
        let durationMs = 0;
        try {
            const { stdout: probe } = await execFileAsync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath], { encoding: 'utf8', timeout: 10000 });
            durationMs = Math.round(parseFloat(probe.trim()) * 1000);
        } catch {}

        const ad = global.db.createAudioAd({ label, audio_path: wavPath, original_filename: originalName, rooms: parsedRooms, duration_ms: durationMs, schedule_times: parsedSchedule, timezone: timezone || 'America/Phoenix', schedule_type: schedule_type || 'times', interval_minutes: parseInt(interval_minutes) || 0, window_start: window_start || null, window_end: window_end || null });
        res.status(201).json({ status: true, data: ad });
    } catch (err) {
        if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ status: false, error: err.message });
    }
});

router.put("/audio-ads/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.updateAudioAd(id, req.body);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        res.json({ status: true, data: ad });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/audio-ads/:id/replace", adUpload.single('audio'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.getAudioAd(id);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        if (!req.file) return res.status(400).json({ status: false, error: "Audio file is required" });

        const { label, rooms, enabled, schedule_times, timezone, schedule_type, interval_minutes, window_start, window_end } = req.body;
        const originalName = req.file.originalname;
        const wavPath = path.join(announcementsDir, `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.wav`);

        try {
            await execFileAsync('ffmpeg', ['-y', '-i', req.file.path, '-ar', '8000', '-ac', '1', wavPath], { timeout: 60000 });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ status: false, error: "Audio conversion failed" });
        }
        fs.unlinkSync(req.file.path);

        if (ad.audio_path) try { fs.unlinkSync(ad.audio_path); } catch {}

        let durationMs = 0;
        try {
            const { stdout: probe } = await execFileAsync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath], { encoding: 'utf8', timeout: 10000 });
            durationMs = Math.round(parseFloat(probe.trim()) * 1000);
        } catch {}

        const updates = { audio_path: wavPath, original_filename: originalName, duration_ms: durationMs };
        if (label) updates.label = label;
        if (rooms) updates.rooms = JSON.parse(rooms);
        if (enabled !== undefined) updates.enabled = parseInt(enabled);
        if (schedule_times) updates.schedule_times = JSON.parse(schedule_times);
        if (timezone) updates.timezone = timezone;
        if (schedule_type) updates.schedule_type = schedule_type;
        if (interval_minutes !== undefined) updates.interval_minutes = parseInt(interval_minutes) || 0;
        if (window_start !== undefined) updates.window_start = window_start || null;
        if (window_end !== undefined) updates.window_end = window_end || null;

        const result = global.db.updateAudioAd(id, updates);
        res.json({ status: true, data: result });
    } catch (err) {
        if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ status: false, error: err.message });
    }
});

router.delete("/audio-ads/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const ad = global.db.getAudioAd(id);
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        if (ad.audio_path) try { fs.unlinkSync(ad.audio_path); } catch {}
        global.db.deleteAudioAd(id);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/audio-ads/:id/play", async (req, res) => {
    try {
        const { playAd } = await import("../../service/announcements.js");
        const results = await playAd(parseInt(req.params.id));
        res.json({ status: true, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/audio-ads/:id/stop", async (req, res) => {
    try {
        const { stopAllRooms } = await import("../../service/announcements.js");
        const ad = global.db.getAudioAd(parseInt(req.params.id));
        if (!ad) return res.status(404).json({ status: false, error: "Ad not found" });
        const rooms = JSON.parse(ad.rooms || '[]');
        const { stopAd } = await import("../../service/announcements.js");
        for (const room of rooms) stopAd(room, 'admin');
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.get("/audio-ads/:id/stats", (req, res) => {
    try {
        const stats = global.db.getAdStats(parseInt(req.params.id));
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.get("/audio-ads/play-log", (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 100);
        const ad_id = req.query.ad_id ? parseInt(req.query.ad_id) : undefined;
        const result = global.db.getAdPlayLog({ ad_id, page, pageSize });
        res.json({ status: true, ...result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
