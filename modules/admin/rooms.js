import express from "express";
import { logUser } from "../../service/logger.js";
import { emitStateChange } from "./routesApi.js";

const router = express.Router();

// GET /rooms — returns room stats + member list per room
router.get("/rooms", (req, res) => {
    try {
        const dbRooms = global.db.getAllRooms();
        const rooms = {};
        for (const r of dbRooms) {
            rooms[r.id] = {
                room: r.id,
                roomName: r.name,
                shortCode: r.short_code,
                timezone: r.timezone || 'America/Chicago',
                auto_transcribe: !!r.auto_transcribe,
                total: 0,
                online: 0,
                inCall: 0,
                unmuted: 0,
                members: [],
                accountCount: 0,
            };
        }

        const accounts = global.db.getAllAccounts();
        const accountCountByRoom = {};
        for (const acc of accounts) {
            if (acc.room) {
                accountCountByRoom[acc.room] = (accountCountByRoom[acc.room] || 0) + 1;
            }
        }
        for (const [roomId, count] of Object.entries(accountCountByRoom)) {
            if (rooms[roomId]) rooms[roomId].accountCount = count;
        }

        const users = global.db.getAllUserInfo();
        for (const user of users) {
            const room = user.room;
            if (!rooms[room]) {
                rooms[room] = {
                    room,
                    roomName: `Room ${room}`,
                    shortCode: '',
                    total: 0,
                    online: 0,
                    inCall: 0,
                    unmuted: 0,
                    members: [],
                    accountCount: accountCountByRoom[room] || 0,
                };
            }
            rooms[room].total++;
            if (user.online) rooms[room].online++;
            if (user.connectionState === 'connected') rooms[room].inCall++;
            if (!user.mute) rooms[room].unmuted++;
            rooms[room].members.push({
                userName: user.userName,
                callerIdName: user.callerIdName,
                online: user.online,
                connectionState: user.connectionState,
                mute: user.mute
            });
        }
        res.json({ status: true, data: Object.values(rooms) });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms/config — returns room names/codes for frontend
router.get("/rooms/config", (req, res) => {
    try {
        const rooms = global.db.getAllRooms();
        const names = {};
        const codes = {};
        for (const r of rooms) {
            names[r.id] = r.name;
            codes[r.id] = r.short_code;
        }
        res.json({ status: true, data: { rooms, names, codes } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /rooms/:roomId — returns room detail with timeline
router.get("/rooms/:roomId", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const users = global.db.filter(u => u.room === roomId);
        const events = global.db.getEvents(50, null).filter(e => e.room === roomId);
        res.json({
            status: true,
            data: {
                room: roomId,
                roomName: global.config.ROOM_NAME?.[roomId] || `Room ${roomId}`,
                members: users,
                timeline: events
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/create — create a new room
router.post("/rooms/create", (req, res) => {
    try {
        const { id, name, short_code, timezone } = req.body;
        if (!id || !name || !short_code) {
            return res.status(400).json({ status: false, error: "id, name, and short_code are required" });
        }
        const roomId = parseInt(id);
        const existing = global.db.getRoom(roomId);
        if (existing) {
            return res.status(409).json({ status: false, error: "Room with this ID already exists" });
        }
        const room = global.db.createRoom(roomId, name, short_code, timezone);
        global.db.logEvent('room_created', null, roomId, `Room ${name} (${short_code}) created`);
        emitStateChange('rooms');
        res.status(201).json({ status: true, data: room });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /rooms/:roomId — update room name/code
router.put("/rooms/:roomId", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const existing = global.db.getRoom(roomId);
        if (!existing) return res.status(404).json({ status: false, error: "Room not found" });
        const updated = global.db.updateRoom(roomId, req.body);
        global.db.logEvent('room_updated', null, roomId, `Room updated`);
        emitStateChange('rooms');
        res.json({ status: true, data: updated });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /rooms/:roomId/delete — delete a room
router.delete("/rooms/:roomId/delete", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const existing = global.db.getRoom(roomId);
        if (!existing) return res.status(404).json({ status: false, error: "Room not found" });
        global.db.deleteRoom(roomId);
        global.db.logEvent('room_deleted', null, roomId, `Room ${existing.name} deleted`);
        emitStateChange('rooms');
        res.json({ status: true, message: `Room ${existing.name} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/honk — honk a room
router.post("/rooms/:roomId/honk", (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        logUser(`room:${roomId}`, 'API', 'HONK');
        global.freeswitch.honkRoom(roomId);
        global.db.logEvent('honk', null, roomId, 'Admin honked room');
        emitStateChange('rooms');
        res.json({ status: true, message: `Honk sent to room ${roomId}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /rooms/:roomId/listen — dial an admin SIP client into the conference as listener
router.post("/rooms/:roomId/listen", async (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const { email } = req.body;
        if (!email) return res.status(400).json({ status: false, error: "email is required" });

        const account = global.db.getAccountByEmail(email);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const profile = global.config.FREESWITCH_SOFIA_PROFILE;
        const sipUser = email.includes('@') ? email.replace('@', '.at.') : email;
        const fsIp = global.config.FREESWITCH_PUBLIC_IP;

        const { getConnection } = await import("../../service/freeswitch/connection.js");
        const conn = getConnection();

        const contact = await new Promise((resolve, reject) => {
            const lookups = [
                `sofia_contact ${profile}/${sipUser}@${fsIp}`,
                `sofia_contact ${profile}/${email}`,
            ];
            const tryLookup = (idx) => {
                if (idx >= lookups.length) { reject(new Error("Admin SIP client not registered")); return; }
                conn.api(lookups[idx], (resp) => {
                    const body = resp.getBody().trim();
                    if (!body || body.startsWith('-ERR') || body === 'error/user_not_registered') {
                        tryLookup(idx + 1);
                    } else {
                        resolve(body);
                    }
                });
            };
            tryLookup(0);
        });

        const confProfile = global.config.FREESWITCH_CONFERENCE_PROFILE;
        const roomName = global.config.ROOM_NAME[roomId] || roomId;
        const cmd = `originate {origination_caller_id_name='LISTEN-${roomName}',origination_caller_id_number='LISTEN'}${contact} &conference(${roomId}@${confProfile}++flags{mute})`;

        const result = await new Promise((resolve, reject) => {
            conn.api(cmd, (resp) => {
                const body = resp.getBody().trim();
                if (body.startsWith('+OK')) resolve(body.replace('+OK ', '').trim());
                else reject(new Error(body));
            });
        });

        logUser(email, 'API', `LISTEN room ${roomName}`);
        global.db.logEvent('listen', email, roomId, `Admin listening to ${roomName}`);
        res.json({ status: true, uuid: result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
