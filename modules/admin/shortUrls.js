import express from "express";
const router = express.Router();

// GET /short-urls — list all short URLs
router.get("/short-urls", (req, res) => {
    try {
        const data = global.db.getAllShortUrls();
        res.json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /short-urls — create a short URL
router.post("/short-urls", (req, res) => {
    try {
        const { destination_url, label, expires_at } = req.body;
        if (!destination_url) {
            return res.status(400).json({ status: false, error: "destination_url is required" });
        }
        const code = global.db.generateShortCode();
        let expiresAtUnix = null;
        if (expires_at) {
            const parsed = new Date(expires_at);
            expiresAtUnix = isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
        }
        const data = global.db.createShortUrl({ code, destinationUrl: destination_url, label, expiresAt: expiresAtUnix });
        res.status(201).json({ status: true, data });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /short-urls/:id — delete a short URL
router.delete("/short-urls/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        global.db.deleteShortUrl(id);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
