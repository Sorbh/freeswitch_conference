import cors from "cors";
import dotenv from 'dotenv';
import 'dotenv/config';
import express from "express";
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import config from './config/config.js';
global.config = config;
console.log('Config loaded');

// Database (SQLite)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { default: dbService } = await import('./service/dbService.js');
global.db = dbService.db;
global.db.init();
console.log('Database initialized');

// FreeSWITCH ESL
const { default: freeswitchService } = await import('./service/freeswitchService.js');
global.freeswitch = freeswitchService.freeswitch;

try {
    await global.freeswitch.connect();
    console.log('FreeSWITCH ESL connected');
} catch (err) {
    console.error(`FreeSWITCH ESL connection failed: ${err.message}`);
    console.log('Continuing without FreeSWITCH — API will work but calls will fail');
}

// Call service (depends on freeswitch + db)
const { default: callService } = await import('./modules/sip-action/service.js');
global.callService = callService;
console.log('Call service loaded');

// End all calls on startup, then reconnect all logged-in users
await callService.allEndCall();

// On startup, reconnect all logged-in users
const allUsers = global.db.getAllUserInfo();
for (const user of allUsers) {
    global.freeswitch.ensureInConference(user.userName);
}

// Express
import ApiRouter from "./routes/api.js";
const { json, urlencoded } = express;

const app = express();

app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/", new ApiRouter().apiRouter);

const PORT = process.env.PORT || 4007;
const HTTPS_PORT = process.env.HTTPS_PORT || 4008;

var server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`HTTP server listening at http://localhost:${PORT}/api/v1/`);
});

const tlsDir = path.join(__dirname, 'config', 'tls');
if (fs.existsSync(path.join(tlsDir, 'key.pem')) && fs.existsSync(path.join(tlsDir, 'cert.pem'))) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(path.join(tlsDir, 'key.pem')),
        cert: fs.readFileSync(path.join(tlsDir, 'cert.pem')),
    }, app);
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS server listening at https://localhost:${HTTPS_PORT}/api/v1/`);
        console.log(`Test page: https://50.28.84.57:${HTTPS_PORT}/test-sip.html`);
    });
} else {
    console.log('No TLS certs found, HTTPS disabled');
}

console.log(`DB Debug: http://localhost:${PORT}/api/v1/debug/tables`);
console.log(`Conferences: http://localhost:${PORT}/api/v1/debug/conferences`);

// Keep-alive
setInterval(() => {
    fetch(`http://localhost:${PORT}/api/v1/test/test`).catch(() => { });
}, 30000);

process.stdin.resume();

process
    .on('SIGTERM', shutdown('SIGTERM'))
    .on('SIGINT', shutdown('SIGINT'))
    .on('SIGUSR1', shutdown('SIGUSR1'))
    .on('exit', shutdown('exit'))
    .on('uncaughtException', (err) => shutdown('uncaughtException', err));

function shutdown(signal, err) {
    return (err) => {
        console.log('Triggering All Call End');
        callService.allEndCall();
        console.log(`${signal}...`);
        if (err) console.error(err.stack || err);
        setTimeout(() => {
            console.log('...waited 5s, exiting.');
            process.exit(err ? 1 : 0);
        }, 5000).unref();
    };
}

const nDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Calcutta' });
console.log(nDate);
