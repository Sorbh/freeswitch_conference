import express from "express";

export let debugRouter = express.Router();

debugRouter.get("/tables", (req, res) => {
    const tables = global.db.getTables();
    return res.status(200).json({ tables });
});

debugRouter.get("/table/:name", (req, res) => {
    try {
        const data = global.db.getTableInfo(req.params.name);
        return res.status(200).json(data);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

debugRouter.get("/query", (req, res) => {
    try {
        if (!req.query.sql) {
            return res.status(400).json({ error: "sql query parameter required" });
        }
        const data = global.db.rawQuery(req.query.sql);
        return res.status(200).json({ count: data.length, rows: data });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

debugRouter.get("/conferences", async (req, res) => {
    try {
        const list = await global.freeswitch.getConferenceList();
        return res.status(200).json({ conferences: list });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
