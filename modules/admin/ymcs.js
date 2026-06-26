import express from "express";
import { logUser } from "../../service/logger.js";

const router = express.Router();

// GET /ymcs/sync-all-device-ids — SSE: list all YMCS devices, match email to DB, save device ID
router.get("/ymcs/sync-all-device-ids", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { listDevices } = await import("../../service/yealink/yealinkDevices.js");
        const { getBoundAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        const allAccounts = global.db.getAllAccounts();
        const accountByEmail = {};
        for (const acc of allAccounts) {
            if (acc.email) accountByEmail[acc.email.toLowerCase().trim()] = acc;
        }

        send({ type: "info", message: "Fetching all devices from YMCS..." });
        const allDevices = [];
        let skip = 0;
        const limit = 100;
        let total = null;
        while (true) {
            const page = await listDevices({ filter: {}, limit, skip, autoCount: total === null });
            const devices = page?.data || [];
            if (total === null) total = page.total || 0;
            allDevices.push(...devices);
            skip += limit;
            if (devices.length < limit || skip >= total) break;
        }
        send({ type: "info", message: `Found ${allDevices.length} devices in YMCS` });

        let success = 0, failed = 0, skipped = 0;

        for (let i = 0; i < allDevices.length; i++) {
            const device = allDevices[i];
            const prefix = `[${i + 1}/${allDevices.length}] ${device.name || device.mac}`;

            try {
                const bound = await getBoundAccounts(device.id);
                const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

                if (!boundList.length) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — no account bound` });
                    continue;
                }

                const email = boundList[0].registerName?.toLowerCase()?.trim();
                if (!email) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — no registerName` });
                    continue;
                }

                const localAccount = accountByEmail[email];
                if (!localAccount) {
                    skipped++;
                    send({ type: "skip", message: `${prefix} — ${email} not in our DB` });
                    continue;
                }

                global.db.updateAccount(localAccount.id, {
                    ymcs_device_id: device.id,
                    ymcs_account_id: boundList[0].accountId,
                    sip_server_host: boundList[0].accountServer || null,
                });
                success++;
                logUser(localAccount.email || `account:${localAccount.id}`, 'API', `SYNC-DEVICE-ID → ${device.id}`);
                send({ type: "success", message: `${prefix} — ${email} → ${device.id}` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped, total: allDevices.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/update-all-device-accounts — SSE: for each account with account+device ID, unbind+rebind
router.get("/ymcs/update-all-device-accounts", async (req, res) => {
    const roomId = req.query.room ? parseInt(req.query.room) : null;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { unbindAccounts, bindAccounts, getBoundAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        let allAccounts = global.db.getAllAccounts();
        let roomLabel = "all";
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allAccounts = allAccounts.filter(a => a.room === roomId);
        }
        const eligible = allAccounts.filter(a => a.ymcs_account_id && a.ymcs_device_id);
        send({ type: "info", message: `Found ${allAccounts.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}accounts, ${eligible.length} eligible for rebind` });

        let success = 0, failed = 0;

        for (let i = 0; i < eligible.length; i++) {
            const acc = eligible[i];
            const prefix = `[${i + 1}/${eligible.length}] ${acc.email}`;

            try {
                const bound = await getBoundAccounts(acc.ymcs_device_id);
                const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

                if (boundList.length > 0) {
                    const oldIds = boundList.map(a => a.accountId);
                    await unbindAccounts(acc.ymcs_device_id, oldIds);
                }

                await bindAccounts(acc.ymcs_device_id, [{ accountId: acc.ymcs_account_id, lineId: 1, accountType: 0 }]);

                success++;
                logUser(acc.email || `account:${acc.id}`, 'API', `REBIND ${acc.display_name || acc.email || acc.ymcs_account_id} to device ${acc.ymcs_device_id}`);
                send({ type: "success", message: `${prefix} — rebound (unbound ${boundList.length} old)` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: eligible.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/update-all-sip-server — SSE: update SIP server host+port on all (or room-filtered) YMCS accounts
router.get("/ymcs/update-all-sip-server", async (req, res) => {
    const host = req.query.host;
    const port = parseInt(req.query.port);
    const roomId = req.query.room ? parseInt(req.query.room) : null;
    if (!host || !port) {
        return res.status(400).json({ status: false, error: "host and port query params required" });
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { updateAccount: updateYmcsAccount } = await import("../../service/yealink/yealinkSipAccounts.js");

        let roomLabel = "all";
        let allLocal = global.db.getAllAccounts();
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allLocal = allLocal.filter(a => a.room === roomId);
        }
        const accounts = allLocal.filter(a => a.ymcs_account_id).map(a => ({ accountId: a.ymcs_account_id, email: a.email }));
        send({ type: "info", message: `Found ${accounts.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}accounts, updating SIP server to ${host}:${port}...` });

        const password = process.env.SIP_DEFAULT_PASSWORD || '12345678';
        let success = 0, failed = 0;

        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const prefix = `[${i + 1}/${accounts.length}] ${acc.email || acc.accountId}`;

            try {
                await updateYmcsAccount(acc.accountId, {
                    registerName: acc.email,
                    username: acc.email,
                    password,
                    sipServer1: { host, port },
                });
                const localAccount = global.db.getAccountByEmail(acc.email);
                if (localAccount) {
                    global.db.updateAccount(localAccount.id, { sip_server_host: host, sip_server_port: String(port) });
                }
                success++;
                send({ type: "success", message: `${prefix} — updated to ${host}:${port}` });
            } catch (err) {
                failed++;
                send({ type: "error", message: `${prefix} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: accounts.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/reboot-all-devices — SSE: reboot all (or room-filtered) YMCS devices
router.get("/ymcs/reboot-all-devices", async (req, res) => {
    const roomId = req.query.room ? parseInt(req.query.room) : null;

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { rebootDevices } = await import("../../service/yealink/yealinkDevices.js");

        let roomLabel = "all";
        let allLocal = global.db.getAllAccounts();
        if (roomId) {
            const room = global.db.getRoom(roomId);
            roomLabel = room?.name || `Room ${roomId}`;
            allLocal = allLocal.filter(a => a.room === roomId);
        }
        const allDevices = allLocal.filter(a => a.ymcs_device_id).map(a => ({ id: a.ymcs_device_id, email: a.email }));
        send({ type: "info", message: `Found ${allDevices.length} ${roomLabel === "all" ? "" : `"${roomLabel}" `}devices, sending reboot commands...` });

        let success = 0, failed = 0;

        // Reboot in batches of 50
        const batchSize = 50;
        for (let i = 0; i < allDevices.length; i += batchSize) {
            const batch = allDevices.slice(i, i + batchSize);
            const deviceIds = batch.map(d => d.id);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(allDevices.length / batchSize);

            try {
                const result = await rebootDevices(deviceIds, 1);
                const s = result?.successCount || 0;
                const f = result?.failureCount || 0;
                success += s;
                failed += f;
                send({ type: "success", message: `Batch ${batchNum}/${totalBatches} — ${s} rebooted, ${f} failed` });
                if (result?.errors?.length) {
                    for (const err of result.errors) {
                        send({ type: "error", message: `  ${err.field} — ${err.msg}` });
                    }
                }
            } catch (err) {
                failed += batch.length;
                send({ type: "error", message: `Batch ${batchNum}/${totalBatches} — ${err.message}` });
            }
        }

        send({ type: "done", success, failed, skipped: 0, total: allDevices.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/sync-room-sites — SSE: fetch YMCS sites and match to local rooms
router.get("/ymcs/sync-room-sites", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
        const { listSites } = await import("../../service/yealink/yealinkSites.js");
        send({ type: "info", message: "Fetching YMCS sites..." });

        const result = await listSites({ limit: 200 });
        const sites = result?.data || [];
        send({ type: "info", message: `Found ${sites.length} YMCS sites` });

        const rooms = global.db.getAllRooms();
        let matched = 0, skipped = 0;

        for (const site of sites) {
            const siteName = (site.name || '').toLowerCase().trim();
            if (!siteName) { skipped++; continue; }

            const room = rooms.find(r => {
                const roomName = (r.name || '').toLowerCase().trim();
                const shortCode = (r.short_code || '').toLowerCase().trim();
                const roomId = String(r.id);
                return roomName === siteName || shortCode === siteName || roomId === siteName;
            });

            if (room) {
                global.db.updateRoom(room.id, { ymcs_site_id: site.id, ymcs_parent_site_id: site.parentId || null });
                send({ type: "success", message: `${site.name} → Room "${room.name}" (${room.id})` });
                matched++;
            } else {
                send({ type: "skip", message: `${site.name} — no matching room` });
                skipped++;
            }
        }

        send({ type: "done", success: matched, failed: 0, skipped, total: sites.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

// GET /ymcs/sync-room-groups — SSE: fetch YMCS groups and match to local rooms
router.get("/ymcs/sync-room-groups", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
        const { listGroups } = await import("../../service/yealink/yealinkGroups.js");
        send({ type: "info", message: "Fetching YMCS groups..." });

        const result = await listGroups({ limit: 200 });
        const groups = result?.data || [];
        send({ type: "info", message: `Found ${groups.length} YMCS groups` });

        const rooms = global.db.getAllRooms();
        let matched = 0, skipped = 0;

        for (const group of groups) {
            const groupName = (group.name || group.groupName || '').toLowerCase().trim();
            const groupDesc = (group.description || '').toLowerCase().trim();
            if (!groupName) { skipped++; continue; }

            const room = rooms.find(r => {
                const roomName = (r.name || '').toLowerCase().trim();
                const shortCode = (r.short_code || '').toLowerCase().trim();
                const roomId = String(r.id);
                return roomName === groupName || shortCode === groupName || roomId === groupName || roomId === groupDesc;
            });

            if (room) {
                global.db.updateRoom(room.id, { ymcs_group_id: group.id });
                send({ type: "success", message: `${group.name || group.groupName} → Room "${room.name}" (${room.id})` });
                matched++;
            } else {
                send({ type: "skip", message: `${group.name || group.groupName} — no matching room` });
                skipped++;
            }
        }

        send({ type: "done", success: matched, failed: 0, skipped, total: groups.length });
    } catch (err) {
        send({ type: "error", message: `Fatal: ${err.message}` });
        send({ type: "done", success: 0, failed: 1, skipped: 0, total: 0 });
    }
    res.end();
});

export default router;
