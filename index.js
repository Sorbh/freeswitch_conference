import cors from "cors";
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import 'dotenv/config';
import express from "express";
import fs from 'fs';
import https from 'https';
import path from "path";
import { fileURLToPath } from 'url';
import ViteExpress from "vite-express";
ViteExpress.config({ mode: "production", inlineViteConfig: { base: "/" } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import config from './config/config.js';
global.config = config;
import { logStartup, logSystem } from './service/logger.js';

const _startupLines = ['Config loaded'];

// Database (SQLite)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { default: dbService } = await import('./service/dbService.js');
global.db = dbService.db;
global.db.init();
_startupLines.push('Database initialized');

// Seed admin account on first run
if (global.db.adminCount() === 0) {
    const { default: bcrypt } = await import('bcryptjs');
    const seedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hotlinehq.com';
    const seedPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomUUID().slice(0, 16);
    const seedName = process.env.SEED_ADMIN_NAME || 'Admin';
    const passwordHash = await bcrypt.hash(seedPassword, 12);
    global.db.createAdmin({ email: seedEmail, passwordHash, name: seedName, role: 'admin', createdBy: null });
    _startupLines.push(`Seed admin created: ${seedEmail} / ${process.env.SEED_ADMIN_PASSWORD ? '***' : seedPassword}`);
}

// Reapply SIP UA blocklist iptables rules from DB
import { reapplyBlocklist } from "./modules/admin/system.js";
reapplyBlocklist();

// Express — start HTTP servers first so FreeSWITCH xml_curl can always reach us
import ApiRouter from "./routes/api.js";
const { json, urlencoded } = express;

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/recordings", express.static(path.join(__dirname, "recordings")));

app.use("/api/v1/", new ApiRouter().apiRouter);

const PORT = process.env.PORT || 4007;

const tlsDir = path.join(__dirname, 'config', 'tls');
if (fs.existsSync(path.join(tlsDir, 'key.pem')) && fs.existsSync(path.join(tlsDir, 'cert.pem'))) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(path.join(tlsDir, 'key.pem')),
        cert: fs.readFileSync(path.join(tlsDir, 'cert.pem')),
    }, app);
    httpsServer.listen(PORT, () => {
        ViteExpress.bind(app, httpsServer);
        _startupLines.push(`HTTPS listening at https://localhost:${PORT}/`);
    });
    app.listen(4070, '127.0.0.1', () => {
        _startupLines.push('Internal HTTP listening at http://127.0.0.1:4070/');
    });
} else {
    ViteExpress.listen(app, PORT, () => {
        _startupLines.push(`Server listening at http://localhost:${PORT} (no TLS certs found)`);
    });
}

// FreeSWITCH ESL
const { default: freeswitchService } = await import('./service/freeswitchService.js');
global.freeswitch = freeswitchService.freeswitch;

try {
    await global.freeswitch.connect();
    _startupLines.push('FreeSWITCH ESL connected');
} catch (err) {
    _startupLines.push(`FreeSWITCH ESL FAILED: ${err.message} — API only`);
}

// Global state constants
global.ConnectionState = { IDEAL: 'ideal', CONNECTING: 'connecting', CONNECTED: 'connected', HANGUP: 'hangup', RETRY: 'retry', ERROR: 'error' };
global.AuthState = { LOGIN: 'login', LOGOUT: 'logout' };

import { allEndCall } from './modules/admin/routesApi.js';

// Alerting service
import { checkCriticalUser, startCriticalAlert, stopCriticalAlert } from './service/alerting.js';
global.alerting = { checkCriticalUser, startCriticalAlert, stopCriticalAlert };

// WhatsApp client (auto-restores session if available)
import { initialize as initWhatsApp } from './service/whatsapp.js';
try {
    await initWhatsApp();
    _startupLines.push('WhatsApp client initialized');
} catch (err) {
    _startupLines.push(`WhatsApp client skipped: ${err.message}`);
}

// Phone events (syslog for Yealink hook detection)
import { startSyslogServer } from './service/phoneEvents.js';
startSyslogServer(global.config.SYSLOG_PORT || 515);

// Announcement scheduler
import { startScheduler } from './service/announcementScheduler.js';
startScheduler();
_startupLines.push('Announcement scheduler started');

// On startup: reset all connection states (previous server session is gone)
global.db.resetAllConnectionStates();

// Kill any leftover channels in FreeSWITCH
try {
    await new Promise((resolve) => {
        global.freeswitch.getConferenceList().then(resolve).catch(resolve);
    });
} catch { }

// Debug routes removed for security
_startupLines.push(new Date().toLocaleString());
logStartup(_startupLines);

// Keep-alive
setInterval(() => {
    fetch(`http://127.0.0.1:4070/api/v1/test/test`).catch(() => { });
}, 30000);

// Room snapshots every 5 minutes
setInterval(() => {
    try { global.db.snapshotRoomCounts(); } catch {}
}, 5 * 60 * 1000);
global.db.snapshotRoomCounts();

// Clean old snapshots once a day
setInterval(() => {
    try { global.db.cleanOldSnapshots(14); } catch {}
}, 24 * 60 * 60 * 1000);

// Clean expired refresh tokens every hour
setInterval(() => {
    try { global.db.cleanExpiredRefreshTokens(); } catch {}
}, 60 * 60 * 1000);

process.stdin.resume();

process
    .on('SIGTERM', shutdown('SIGTERM'))
    .on('SIGINT', shutdown('SIGINT'))
    .on('SIGUSR1', shutdown('SIGUSR1'))
    .on('exit', shutdown('exit'))
    .on('uncaughtException', (err) => shutdown('uncaughtException', err));

function shutdown(signal) {
    return async (err) => {
        console.log(`${signal} received — shutting down`);
        if (err) console.error(err.stack || err);

        // Lock gate first — prevents _onCallHangup from re-initiating calls during shutdown
        try {
            const { lockCalls } = await import('./service/freeswitch/callGate.js');
            lockCalls('shutdown');
        } catch { }

        // End all active FreeSWITCH calls first — sends BYE to clients
        try {
            await allEndCall();
            console.log('All calls ended — BYE sent to clients');
        } catch (e) {
            console.error('Failed to end calls:', e.message);
        }

        // Close all WhatsApp sessions (keep auth)
        try {
            const { shutdownAll } = await import('./service/whatsapp.js');
            await shutdownAll();
        } catch { }

        // Then reset DB state
        try {
            global.db.resetAllConnectionStates();
        } catch { }

        setTimeout(() => {
            console.log('Exiting.');
            process.exit(err ? 1 : 0);
        }, 3000).unref();
    };
}

