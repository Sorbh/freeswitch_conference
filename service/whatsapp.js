import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { logSystem } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', 'data');

const sessions = new Map();

function _randomDelay(minMs, maxMs) {
    return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

function _authFile(channelId) {
    return path.join(AUTH_DIR, `whatsapp_${channelId}.json`);
}

async function _useSingleFileAuthState(filePath) {
    const { proto, initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys');

    let data = {};
    if (fs.existsSync(filePath)) {
        try { data = JSON.parse(fs.readFileSync(filePath, 'utf8'), BufferJSON.reviver); } catch { data = {}; }
    }

    // Baileys calls keys.set on every message (Signal key updates), which used to
    // JSON.stringify + writeFileSync the entire auth state (>1MB) on the main loop
    // each time. Coalesce bursts into a single serialized async write instead.
    let _writing = false;
    let _dirty = false;
    const _flush = async () => {
        while (_dirty) {
            _dirty = false;
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(data, BufferJSON.replacer, 2));
            } catch (err) {
                logSystem('WHATSAPP', `auth state write failed: ${err.message}`);
            }
        }
        _writing = false;
    };
    const writeData = () => {
        _dirty = true;
        if (_writing) return;
        _writing = true;
        setImmediate(_flush);
    };

    const creds = data.creds || initAuthCreds();

    const state = {
        creds,
        keys: {
            get: (type, ids) => {
                const result = {};
                for (const id of ids) {
                    const val = data[`${type}-${id}`];
                    if (val) result[id] = val;
                }
                return result;
            },
            set: (keyData) => {
                for (const [type, entries] of Object.entries(keyData)) {
                    for (const [id, value] of Object.entries(entries)) {
                        if (value) data[`${type}-${id}`] = value;
                        else delete data[`${type}-${id}`];
                    }
                }
                writeData();
            },
        },
    };

    const saveCreds = () => {
        data.creds = state.creds;
        writeData();
    };

    return { state, saveCreds };
}

function _getSession(channelId) {
    return sessions.get(Number(channelId)) || { state: 'disconnected', sock: null, qr: null, phone: null };
}

export function getChannelStatus(channelId) {
    const s = _getSession(channelId);
    return {
        state: s.state,
        qr: s.state === 'qr_pending' ? s.qr : undefined,
        phone: s.phone || undefined,
    };
}

export function getAllStatuses() {
    const result = {};
    for (const [id, s] of sessions) {
        result[id] = {
            state: s.state,
            phone: s.phone || undefined,
        };
    }
    return result;
}

export async function connectChannel(channelId) {
    channelId = Number(channelId);
    const existing = sessions.get(channelId);
    if (existing?.sock) return;

    const { default: makeWASocket, DisconnectReason } = await import('@whiskeysockets/baileys');
    const QRCode = (await import('qrcode')).default;

    const authFile = _authFile(channelId);
    const { state: authState, saveCreds } = await _useSingleFileAuthState(authFile);

    const session = { state: 'connecting', sock: null, qr: null, phone: null, reconnectAttempted: false };
    sessions.set(channelId, session);

    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        defaultQueryTimeoutMs: undefined,
        browser: ['Mac OS', 'Chrome', '14.4.1'],
        logger: pino({ level: 'warn' }),
    });

    session.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                session.qr = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
                session.state = 'qr_pending';
                logSystem('WHATSAPP', `[ch:${channelId}] QR code generated — waiting for scan`);
            } catch (err) {
                logSystem('WHATSAPP', `[ch:${channelId}] QR generation failed: ${err.message}`);
            }
        }

        if (connection === 'open') {
            session.state = 'ready';
            session.qr = null;
            session.reconnectAttempted = false;
            session.phone = sock.user?.name || sock.user?.id?.split(':')[0] || null;
            logSystem('WHATSAPP', `[ch:${channelId}] Connected as ${session.phone || 'unknown'}`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            session.sock = null;
            session.qr = null;

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                session.state = 'disconnected';
                session.phone = null;
                try { fs.unlinkSync(_authFile(channelId)); } catch {}
                logSystem('WHATSAPP', `[ch:${channelId}] Logged out — session cleared, reconnect to scan QR`);
            } else if (!session.reconnectAttempted) {
                session.reconnectAttempted = true;
                logSystem('WHATSAPP', `[ch:${channelId}] Disconnected (code ${statusCode}) — reconnecting`);
                setTimeout(() => connectChannel(channelId).catch(e => {
                    logSystem('WHATSAPP', `[ch:${channelId}] Reconnect failed: ${e.message}`);
                    session.state = 'disconnected';
                }), 3000);
            } else {
                session.state = 'disconnected';
                logSystem('WHATSAPP', `[ch:${channelId}] Disconnected (code ${statusCode}) — not reconnecting`);
            }
        }
    });

    logSystem('WHATSAPP', `[ch:${channelId}] Initializing...`);
}

export async function disconnectChannel(channelId, deleteSession = false) {
    channelId = Number(channelId);
    const session = sessions.get(channelId);
    if (session?.sock) {
        try { await session.sock.logout(); } catch {}
        try { session.sock.end(); } catch {}
    }
    sessions.delete(channelId);

    if (deleteSession) {
        const authFile = _authFile(channelId);
        try { fs.unlinkSync(authFile); } catch {}
    }
    logSystem('WHATSAPP', `[ch:${channelId}] Disconnected${deleteSession ? ' (session deleted)' : ''}`);
}

export async function getChannelGroups(channelId) {
    const session = _getSession(channelId);
    if (session.state !== 'ready' || !session.sock) throw new Error('WhatsApp not connected');

    const groups = await session.sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
        id: g.id,
        name: g.subject,
    })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendChannelMessage(channelId, groupId, text, audioPath) {
    const session = _getSession(channelId);
    if (session.state !== 'ready' || !session.sock) throw new Error('WhatsApp not connected');

    if (audioPath && fs.existsSync(audioPath)) {
        await session.sock.sendMessage(groupId, {
            audio: { url: audioPath },
            mimetype: 'audio/mp4',
        });
        if (text) await _randomDelay(3000, 3000);
    }

    if (text) {
        await session.sock.sendMessage(groupId, { text });
    }

    logSystem('WHATSAPP', `[ch:${channelId}] Message sent to ${groupId}`);
}

export async function sendChannelImage(channelId, groupId, caption, imagePath) {
    const session = _getSession(channelId);
    if (session.state !== 'ready' || !session.sock) throw new Error('WhatsApp not connected');

    await session.sock.sendMessage(groupId, {
        image: { url: imagePath },
        caption: caption || undefined,
    });
    logSystem('WHATSAPP', `[ch:${channelId}] Image sent to ${groupId}`);
}

export async function initialize() {
    const files = fs.readdirSync(AUTH_DIR).filter(f => f.match(/^whatsapp_\d+\.json$/));

    let count = 0;
    for (const file of files) {
        const channelId = Number(file.match(/^whatsapp_(\d+)\.json$/)[1]);
        try {
            await connectChannel(channelId);
            count++;
        } catch (err) {
            logSystem('WHATSAPP', `[ch:${channelId}] Auto-connect failed: ${err.message}`);
        }
    }
    logSystem('WHATSAPP', count > 0 ? `${count} session(s) restored` : 'No saved sessions');
}

export async function shutdownAll() {
    for (const [channelId, session] of sessions) {
        if (session.sock) {
            try { session.sock.end(); } catch {}
        }
    }
    sessions.clear();
    logSystem('WHATSAPP', 'All sessions closed');
}
