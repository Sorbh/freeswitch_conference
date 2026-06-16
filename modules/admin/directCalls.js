import express from "express";

const router = express.Router();

// GET /direct-calls — list direct calls with optional filters
router.get("/direct-calls", (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const status = req.query.status || undefined;
        const calls = global.db.getDirectCalls(limit);
        const filtered = status ? calls.filter(c => c.status === status) : calls;
        res.json({ status: true, data: filtered });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /direct-calls/:id — single direct call detail
router.get("/direct-calls/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const call = global.db.getDirectCallById(id);
        if (!call) return res.status(404).json({ status: false, error: "Call not found" });
        res.json({ status: true, data: call });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
