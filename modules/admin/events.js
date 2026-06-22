import express from "express";
import { getClientSSEUsers } from "../client/events.js";

export const eventsRouter = express.Router();

const streamClients = new Set();
const roomClients = new Set();
const fsLogClients = new Set();
const phoneLogClients = new Set();
const debugLogClients = new Set();

function broadcast(clients, frame) {
    for (const client of clients) {
        const res = client.res || client;
        res.write(frame);
    }
}

let _listenersRegistered = false;
function _ensureListeners() {
    if (_listenersRegistered) return;
    _listenersRegistered = true;

    for (const evt of ['EVENT_LOG', 'USER_SYNC', 'STATE_EVENT', 'BROADCAST_LOG']) {
        global.db.eventEmitter.on(evt, (eventData) => {
            if (streamClients.size === 0 && roomClients.size === 0) return;
            let payload = eventData;
            if (evt === 'USER_SYNC' && eventData.userName) {
                const sseUsers = getClientSSEUsers();
                const un = eventData.userName;
                payload = { ...eventData, sseConnected: sseUsers.has(un) || sseUsers.has(`sip:${un}`) };
            }
            const frame = `data: ${JSON.stringify(payload)}\n\n`;
            broadcast(streamClients, frame);

            if (evt !== 'EVENT_LOG' && roomClients.size > 0) {
                for (const client of roomClients) {
                    if (eventData.room === client.room || eventData.type === 'state_event') {
                        client.res.write(frame);
                    }
                }
            }
        });
    }

    global.db.eventEmitter.on('FS_LOG', (entry) => {
        if (fsLogClients.size === 0) return;
        const frame = `data: ${JSON.stringify(entry)}\n\n`;
        for (const client of fsLogClients) {
            if (client.search) {
                const q = client.search;
                const hay = `${entry.from || ''}\0${entry.to || ''}\0${entry.callId || ''}\0${entry.method || ''}\0${entry.transport || ''}\0${entry.message || ''}`.toLowerCase();
                if (!hay.includes(q)) continue;
            }
            client.res.write(frame);
        }
    });
    global.db.eventEmitter.on('PHONE_LOG', (entry) => {
        if (phoneLogClients.size === 0) return;
        const frame = `data: ${JSON.stringify(entry)}\n\n`;
        for (const client of phoneLogClients) {
            if (client.mac && entry.mac !== client.mac) continue;
            client.res.write(frame);
        }
    });
    global.db.eventEmitter.on('DEBUG_LOG', (entry) => {
        if (debugLogClients.size === 0) return;
        broadcast(debugLogClients, `data: ${JSON.stringify(entry)}\n\n`);
    });
}

const SSE_HEADERS = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
};

eventsRouter.get("/stream", (req, res) => {
    _ensureListeners();
    res.writeHead(200, SSE_HEADERS);
    res.write('data: {"type":"connected"}\n\n');
    streamClients.add(res);
    req.on('close', () => { streamClients.delete(res); });
});

eventsRouter.get("/room/:room", (req, res) => {
    _ensureListeners();
    const room = parseInt(req.params.room);
    if (!room) return res.status(400).end();
    res.writeHead(200, SSE_HEADERS);
    const client = { res, room };
    roomClients.add(client);
    req.on('close', () => { roomClients.delete(client); });
});

eventsRouter.get("/fs-log", (req, res) => {
    _ensureListeners();
    res.writeHead(200, SSE_HEADERS);
    res.write('data: {"type":"connected"}\n\n');
    const search = req.query.search?.toLowerCase() || '';
    const client = { res, search };
    fsLogClients.add(client);
    req.on('close', () => { fsLogClients.delete(client); });
});

eventsRouter.get("/phone-log", (req, res) => {
    _ensureListeners();
    res.writeHead(200, SSE_HEADERS);
    res.write('data: {"type":"connected"}\n\n');
    const mac = req.query.mac?.toLowerCase() || '';
    const client = { res, mac };
    phoneLogClients.add(client);
    req.on('close', () => { phoneLogClients.delete(client); });
});

eventsRouter.get("/debug-log", (req, res) => {
    _ensureListeners();
    res.writeHead(200, SSE_HEADERS);
    res.write('data: {"type":"connected"}\n\n');
    debugLogClients.add(res);
    req.on('close', () => { debugLogClients.delete(res); });
});
