import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH env override exists for smoke-testing against a copy; production uses the default
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'freeswitch_conference.db');

// Live binding: set once by open() (called from schema.js init()), then visible to all importers
export let sqlite;

export const eventEmitter = new EventEmitter();

export function open() {
    sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
}

// ── Generic table/debug utilities ──

function getTableInfo(tableName) {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    return { count: count.count, rows };
}

function getTables() {
    return sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
}

function rawQuery(sql) {
    return sqlite.prepare(sql).all();
}

export { getTableInfo, getTables, rawQuery };
