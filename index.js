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
ViteExpress.config({
    mode: "production",
    inlineViteConfig: { base: "/admin/" },
    ignorePaths: /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|ico|webp|map|json)$/,
});

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
const setNoStoreHtml = (res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
};

const sendAssetNotFound = (res) => {
    res.status(404).type("text/plain").send("Asset not found");
};

app.use(cors({ origin: true, credentials: true }));
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
// Admin app assets (dist/assets/) at /admin/
const adminDistDir = path.join(__dirname, "dist");
const adminAssets = express.static(path.join(adminDistDir, "assets"), { index: false });
const sendAdminIndex = (req, res) => {
    setNoStoreHtml(res);
    res.sendFile(path.join(adminDistDir, "index.html"));
};
app.use("/admin/assets", adminAssets);
app.get("/admin/assets/*", (req, res) => sendAssetNotFound(res));
app.use("/admin", express.static(adminDistDir, { index: false }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/recordings", express.static(path.join(__dirname, "recordings")));

// Short URL redirect
app.get("/s/:code", (req, res) => {
    const row = global.db.getShortUrlByCode(req.params.code);
    if (!row) return res.status(404).send("Not found");
    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) return res.status(410).send("Link expired");
    global.db.incrementShortUrlClicks(req.params.code);
    res.redirect(302, row.destination_url);
});

// Short URL CRUD — localhost only (no auth needed)
import shortUrlsLocalRouter from "./modules/admin/shortUrls.js";
app.use("/local", (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
    res.status(403).json({ status: false, error: "Localhost only" });
}, shortUrlsLocalRouter);

app.use("/api/v1/", new ApiRouter().apiRouter);

// Admin SPA fallback — any /admin/* that didn't match static files
app.get("/admin", sendAdminIndex);
app.get("/admin/", sendAdminIndex);
app.get("/admin/*", (req, res) => {
    if (path.extname(req.path)) return sendAssetNotFound(res);
    sendAdminIndex(req, res);
});

// Client app — serve at / (must be AFTER /api and /admin)
const clientDistDir = path.join(__dirname, "dist-client");
if (fs.existsSync(clientDistDir)) {
    const clientAssets = express.static(path.join(clientDistDir, "assets"), { index: false });
    const clientIndexPath = path.join(clientDistDir, "index.html");
    const sendClientIndex = (req, res) => {
        let html = fs.readFileSync(clientIndexPath, "utf8");
        html = html
            .replaceAll('src="/assets/', 'src="/hotlinehq/assets/')
            .replaceAll('href="/assets/', 'href="/hotlinehq/assets/')
            .replaceAll('href="/favicon.svg"', 'href="/hotlinehq/favicon.svg"');
        setNoStoreHtml(res);
        res.type("html").send(html);
    };

    app.use("/hotlinehq/assets", clientAssets);
    app.get("/hotlinehq/assets/*", (req, res) => sendAssetNotFound(res));
    app.get("/hotlinehq/favicon.svg", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "favicon.svg"));
    });
    app.get("/hotlinehq", sendClientIndex);
    app.get("/hotlinehq/*", sendClientIndex);

    app.use("/assets", clientAssets);
    app.get("/assets/*", (req, res) => sendAssetNotFound(res));
    app.use(express.static(clientDistDir, { index: false }));
    // SPA fallback for client app — skip API, admin, and static file paths
    app.get("*", (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.startsWith('/recordings/')) return next();
        if (path.extname(req.path)) return next();
        sendClientIndex(req, res);
    });
}

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

// Redline main API socket bridge
import { initRdlSocket } from './service/rdlSocket.js';
initRdlSocket();
_startupLines.push('RDL socket bridge started');

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
