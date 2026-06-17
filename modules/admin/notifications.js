import express from "express";
import multer from "multer";
import fs from "fs";

const router = express.Router();
const msgUpload = multer({ dest: '/tmp/hq-msg-uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

// --- Notification Channels ---

// GET /notifications — list all notification channels
router.get("/notifications", (req, res) => {
    try {
        const channels = global.db.getAllNotificationChannels();
        res.json({ status: true, data: channels });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /notifications/template-info — default template and available variables
router.get("/notifications/template-info", async (req, res) => {
    try {
        const { DEFAULT_TEMPLATE, TEMPLATE_VARS } = await import("../../service/notifier.js");
        res.json({ status: true, data: { defaultTemplate: DEFAULT_TEMPLATE, variables: TEMPLATE_VARS } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /notifications — create a notification channel
router.post("/notifications", (req, res) => {
    try {
        const { type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled } = req.body;
        if (type !== 'whatsapp' && (!bot_token || !chat_id)) {
            return res.status(400).json({ status: false, error: "bot_token and chat_id are required" });
        }
        const channel = global.db.createNotificationChannel({
            type, label, bot_token, chat_id,
            room: room ? parseInt(room) : null,
            message_template: message_template || null,
            send_answered: send_answered ?? 1,
            send_unanswered: send_unanswered ?? 1,
            enabled: enabled ?? 1,
        });
        res.status(201).json({ status: true, data: channel });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /notifications/:id — update a notification channel
router.put("/notifications/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = global.db.getNotificationChannel(id);
        if (!existing) return res.status(404).json({ status: false, error: "Channel not found" });
        const updated = global.db.updateNotificationChannel(id, req.body);
        res.json({ status: true, data: updated });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /notifications/:id — delete a notification channel
router.delete("/notifications/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = global.db.getNotificationChannel(id);
        if (!existing) return res.status(404).json({ status: false, error: "Channel not found" });
        global.db.deleteNotificationChannel(id);
        res.json({ status: true, message: "Channel deleted" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /notifications/:id/test — send a test message
router.post("/notifications/:id/test", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const channel = global.db.getNotificationChannel(id);
        if (!channel) return res.status(404).json({ status: false, error: "Channel not found" });

        const { testNotificationChannel } = await import("../../service/notifier.js");
        const result = await testNotificationChannel(channel);
        res.json({ status: true, data: result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /notifications/:id/send — send custom text + optional image
router.post("/notifications/:id/send", msgUpload.single("image"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const channel = global.db.getNotificationChannel(id);
        if (!channel) return res.status(404).json({ status: false, error: "Channel not found" });

        const text = req.body.text || "";
        const imagePath = req.file?.path || null;

        if (!text && !imagePath) {
            return res.status(400).json({ status: false, error: "Provide text or image" });
        }

        const { sendCustomMessage } = await import("../../service/notifier.js");
        await sendCustomMessage(channel, text, imagePath);

        if (imagePath) { try { fs.unlinkSync(imagePath); } catch {} }

        res.json({ status: true });
    } catch (err) {
        if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
        res.status(500).json({ status: false, error: err.message });
    }
});

// --- WhatsApp Connection (per channel) ---

router.get("/whatsapp/statuses", async (req, res) => {
    try {
        const { getAllStatuses } = await import("../../service/whatsapp.js");
        res.json({ status: true, data: getAllStatuses() });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.get("/whatsapp/status/:id", async (req, res) => {
    try {
        const { getChannelStatus } = await import("../../service/whatsapp.js");
        res.json({ status: true, data: getChannelStatus(req.params.id) });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/whatsapp/connect/:id", async (req, res) => {
    try {
        const { connectChannel } = await import("../../service/whatsapp.js");
        await connectChannel(req.params.id);
        res.json({ status: true, message: "WhatsApp connecting..." });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.post("/whatsapp/disconnect/:id", async (req, res) => {
    try {
        const { disconnectChannel } = await import("../../service/whatsapp.js");
        await disconnectChannel(req.params.id, true);
        res.json({ status: true, message: "WhatsApp disconnected" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

router.get("/whatsapp/groups/:id", async (req, res) => {
    try {
        const { getChannelGroups } = await import("../../service/whatsapp.js");
        const groups = await getChannelGroups(req.params.id);
        res.json({ status: true, data: groups });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
