import express from "express";

const router = express.Router();

// GET /broadcasts — returns broadcast stats
router.get("/broadcasts", (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const stats = global.db.getBroadcastStats(days, room);
        res.json({ status: true, data: stats });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/list — paginated broadcast list with filters
router.get("/broadcasts/list", (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 100);
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const answered = req.query.answered !== undefined ? parseInt(req.query.answered) : undefined;
        const dateFrom = req.query.dateFrom ? Math.floor(new Date(req.query.dateFrom).getTime() / 1000) : undefined;
        const dateTo = req.query.dateTo ? Math.floor(new Date(req.query.dateTo + 'T23:59:59').getTime() / 1000) : undefined;

        const result = global.db.getPaginatedBroadcasts({ page, pageSize, room, answered, dateFrom, dateTo });
        res.json({ status: true, ...result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/recent — recent broadcasts with recordings
router.get("/broadcasts/recent", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const broadcasts = global.db.getRecentBroadcasts(limit, type);
        res.json({ status: true, data: broadcasts });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/timeline — hourly broadcast data
router.get("/broadcasts/timeline", (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = global.db.getBroadcastStats(days);
        res.json({ status: true, data: stats.hourly });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/availability — room user availability over time
router.get("/broadcasts/availability", (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 12;
        const data = global.db.getRoomSnapshots(hours);
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/hourly — stacked bar chart data
router.get("/broadcasts/hourly", (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 12;
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const data = global.db.getHourlyBroadcasts(hours, room);
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /broadcasts/:id/share — generate a share token for a broadcast
router.post("/broadcasts/:id/share", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        if (broadcast.share_token) {
            return res.json({ status: true, token: broadcast.share_token, url: `/b/${broadcast.share_token}` });
        }
        const token = global.db.generateBroadcastShareToken(id);
        res.json({ status: true, token, url: `/b/${token}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /broadcasts/:id/share — revoke a broadcast's share link
router.delete("/broadcasts/:id/share", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        global.db.revokeBroadcastShareToken(id);
        res.json({ status: true, message: "Share link revoked" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/activity — last N minutes for timeline
router.get("/broadcasts/activity", (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 30;
        const broadcasts = global.db.getTimelineBroadcasts(minutes);
        res.json({ status: true, data: broadcasts });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Settings (general) ──

router.get("/settings/general", (req, res) => {
    try {
        const s = global.db.getSettingsByPrefix('automute_');
        res.json({
            status: true,
            data: {
                automute_enabled: s.automute_enabled === '1',
                automute_timeout_ms: parseInt(s.automute_timeout_ms || '180000', 10),
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.put("/settings/general", (req, res) => {
    try {
        const { automute_enabled, automute_timeout_ms } = req.body;
        if (automute_enabled !== undefined) global.db.setSetting('automute_enabled', automute_enabled ? '1' : '0');
        if (automute_timeout_ms !== undefined) global.db.setSetting('automute_timeout_ms', String(Math.max(30000, parseInt(automute_timeout_ms))));
        res.json({ status: true, message: 'General settings updated' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ── Settings (audio/transcription) ──

router.get("/settings/audio", (req, res) => {
    try {
        const s = global.db.getSettingsByPrefix('stt_');
        res.json({
            status: true,
            data: {
                enabled: s.stt_enabled === '1',
                provider: s.stt_provider || 'deepgram',
                deepgram_api_key: s.stt_deepgram_api_key ? '••••' + (s.stt_deepgram_api_key || '').slice(-4) : '',
                deepgram_model: s.stt_deepgram_model || 'nova-3',
                openrouter_api_key: s.stt_openrouter_api_key ? '••••' + (s.stt_openrouter_api_key || '').slice(-4) : '',
                openrouter_model: s.stt_openrouter_model || 'openai/whisper-large-v3-turbo',
                language: s.stt_language || 'en',
                has_deepgram_key: !!s.stt_deepgram_api_key,
                has_openrouter_key: !!s.stt_openrouter_api_key,
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.put("/settings/audio", (req, res) => {
    try {
        const { enabled, provider, deepgram_api_key, deepgram_model, openrouter_api_key, openrouter_model, language } = req.body;
        if (enabled !== undefined) global.db.setSetting('stt_enabled', enabled ? '1' : '0');
        if (provider !== undefined) global.db.setSetting('stt_provider', provider);
        if (deepgram_api_key !== undefined && !deepgram_api_key.startsWith('••••')) {
            global.db.setSetting('stt_deepgram_api_key', deepgram_api_key);
        }
        if (deepgram_model !== undefined) global.db.setSetting('stt_deepgram_model', deepgram_model);
        if (openrouter_api_key !== undefined && !openrouter_api_key.startsWith('••••')) {
            global.db.setSetting('stt_openrouter_api_key', openrouter_api_key);
        }
        if (openrouter_model !== undefined) global.db.setSetting('stt_openrouter_model', openrouter_model);
        if (language !== undefined) global.db.setSetting('stt_language', language);
        res.json({ status: true, message: 'Audio settings updated' });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /broadcasts/:id/transcribe — trigger manual transcription
router.post("/broadcasts/:id/transcribe", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        if (!broadcast.recording_path) return res.status(400).json({ status: false, error: "No recording available" });

        const { transcribeBroadcast } = await import('../../service/transcription.js');
        const transcript = await transcribeBroadcast(id);
        res.json({ status: true, data: { transcription: transcript, status: 'completed' } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /broadcasts/:id/transcription — get transcription for a broadcast
router.get("/broadcasts/:id/transcription", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const broadcast = global.db.getBroadcastById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: "Broadcast not found" });
        res.json({
            status: true,
            data: {
                transcription: broadcast.transcription || null,
                status: broadcast.transcription_status || null,
                error: broadcast.transcription_error || null,
            },
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
