const SEPARATOR = '───────────────────────────────────────────────────────';
const DOUBLE_SEP = '═══════════════════════════════════════════════════════';

const userBuffers = new Map();
const FLUSH_DELAY = 800;

// Debug flag cache: email -> boolean
const debugCache = new Map();

function _shortName(userName) {
    return (userName || '').replace('sip:', '');
}

function _isDebugEnabled(userName) {
    const email = _shortName(userName);
    if (!email || email === '__unknown__') return false;
    if (debugCache.has(email)) return debugCache.get(email);
    try {
        const account = global.db?.getAccountByEmail?.(email);
        const enabled = !!(account?.debug);
        debugCache.set(email, enabled);
        return enabled;
    } catch {
        return false;
    }
}

export function invalidateDebugCache(email) {
    if (email) debugCache.delete(email);
    else debugCache.clear();
}

export function logSystem(label, message) {
    console.log(`  ${label}${message ? '  ' + message : ''}`);
}

export function logStartup(lines) {
    console.log('');
    console.log(DOUBLE_SEP);
    console.log('  SYSTEM STARTUP');
    console.log(DOUBLE_SEP);
    for (const line of lines) {
        console.log(`  ${line}`);
    }
    console.log('');
}

export function logBlocked(type, detail) {
    console.log('');
    console.log(`${SEPARATOR}`);
    console.log(`  BLOCKED │ ${type}: ${detail}`);
    console.log(`${SEPARATOR}`);
}

export function logUser(userName, tag, message, eslEvent) {
    const key = userName || '__unknown__';
    if (!userBuffers.has(key)) {
        userBuffers.set(key, { lines: [], timer: null });
    }
    const buf = userBuffers.get(key);
    buf.lines.push({ tag, message, eslEvent });

    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => _flush(key), FLUSH_DELAY);
}

export function logUserImmediate(userName, tag, message) {
    const key = userName || '__unknown__';
    if (userBuffers.has(key)) {
        const buf = userBuffers.get(key);
        buf.lines.push({ tag, message });
        if (buf.timer) clearTimeout(buf.timer);
        _flush(key);
    } else {
        if (!_isDebugEnabled(key)) return;
        const name = _shortName(key);
        console.log('');
        console.log(`┌─ ${name} ${'─'.repeat(Math.max(1, 53 - name.length))}`);
        console.log(`│  ${tag.padEnd(6)} ${message}`);
        console.log(`└${'─'.repeat(55)}`);
    }
}

function _flush(key) {
    const buf = userBuffers.get(key);
    if (!buf || buf.lines.length === 0) return;

    const debug = _isDebugEnabled(key);
    const name = _shortName(key);
    const lines = buf.lines;
    const headerLine = lines[0];

    if (!debug) {
        buf.lines = [];
        buf.timer = null;
        userBuffers.delete(key);
        return;
    }

    _emitDebugLog(key, lines);

    // Print to console for debug-enabled accounts
    {
        console.log('');
        console.log(`┌─ ${headerLine.tag} ── ${name} ${'─'.repeat(Math.max(1, 46 - name.length - headerLine.tag.length))}`);
        if (headerLine.message) {
            console.log(`│  ${headerLine.message}`);
        }
        for (let i = 1; i < lines.length; i++) {
            console.log(`│  ${lines[i].tag.padEnd(6)} ${lines[i].message}`);
        }

        // Verbose: dump ESL event headers for debug-enabled accounts
        for (const line of lines) {
            if (line.eslEvent && line.eslEvent.headers) {
                console.log(`│  ┈┈ ESL Headers ┈┈`);
                for (const h of line.eslEvent.headers) {
                    if (h.name && h.value && !h.name.startsWith('_')) {
                        console.log(`│    ${h.name}: ${h.value}`);
                    }
                }
            }
        }

        console.log(`└${'─'.repeat(55)}`);
    }

    buf.lines = [];
    buf.timer = null;
    userBuffers.delete(key);
}

function _emitDebugLog(userName, lines) {
    try {
        if (!global.db?.eventEmitter) return;
        const name = _shortName(userName);
        const logLines = lines.map(l => `${l.tag.padEnd(6)} ${l.message}`);
        global.db.eventEmitter.emit('DEBUG_LOG', {
            type: 'debug_log',
            userName: name,
            lines: logLines,
            timestamp: Math.floor(Date.now() / 1000),
        });
    } catch {}
}
