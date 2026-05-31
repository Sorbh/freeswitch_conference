const SEPARATOR = '───────────────────────────────────────────────────────';
const DOUBLE_SEP = '═══════════════════════════════════════════════════════';

const userBuffers = new Map();
const FLUSH_DELAY = 800;

function _shortName(userName) {
    return (userName || '').replace('sip:', '');
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

export function logUser(userName, tag, message) {
    const key = userName || '__unknown__';
    if (!userBuffers.has(key)) {
        userBuffers.set(key, { lines: [], timer: null });
    }
    const buf = userBuffers.get(key);
    buf.lines.push({ tag, message });

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

    const name = _shortName(key);
    const lines = buf.lines;
    const headerLine = lines[0];

    console.log('');
    console.log(`┌─ ${headerLine.tag} ── ${name} ${'─'.repeat(Math.max(1, 46 - name.length - headerLine.tag.length))}`);
    if (headerLine.message) {
        console.log(`│  ${headerLine.message}`);
    }
    for (let i = 1; i < lines.length; i++) {
        console.log(`│  ${lines[i].tag.padEnd(6)} ${lines[i].message}`);
    }
    console.log(`└${'─'.repeat(55)}`);

    buf.lines = [];
    buf.timer = null;
    userBuffers.delete(key);
}
