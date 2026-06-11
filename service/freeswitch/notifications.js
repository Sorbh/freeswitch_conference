// Yealink XML notifications via SIP NOTIFY. Sends screen messages,
// execute commands, and action URIs to Yealink phones through FreeSWITCH.
// Uses sendevent NOTIFY with contact-uri for reliable delivery through NAT.
import { getConnection } from './connection.js';
import { logUser, logSystem } from '../logger.js';
import modesl from 'modesl';

function _resolveContactLookups(userName) {
    const fsIp = global.config.FREESWITCH_PUBLIC_IP || '50.28.84.57';
    const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';
    const email = userName.startsWith('sip:') ? userName.replace('sip:', '') : userName;
    const encoded = email.includes('@') ? email.replace('@', '.at.') : email;
    return [`${profile}/${encoded}@${fsIp}`, `${profile}/${email}`];
}

function _extractContactUri(sofiaContact) {
    // sofia_contact returns: sofia/internal/sip:user@ip:port;received=natIp:natPort;fs_nat=yes;...
    const sipMatch = sofiaContact.match(/sip:([^;>]+)/);
    if (!sipMatch) return null;

    const base = sipMatch[0];
    const receivedMatch = sofiaContact.match(/received=([^;]+)/);
    if (receivedMatch) return `sip:${base.replace('sip:', '').split('@')[0]}@${receivedMatch[1]}`;
    return base;
}

const _contactCache = new Map();
const CACHE_TTL_MS = 60_000;

function _resolveContact(userName, cb) {
    const cached = _contactCache.get(userName);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
        return cb(cached.uri);
    }

    const lookups = _resolveContactLookups(userName);
    const tryLookup = (idx) => {
        if (idx >= lookups.length) return cb(null);
        const conn = getConnection();
        if (!conn) return cb(null);
        conn.api(`sofia_contact ${lookups[idx]}`, (res) => {
            const raw = (res.getBody() || '').trim();
            if (!raw || raw.startsWith('-ERR') || raw.startsWith('error/')) {
                return tryLookup(idx + 1);
            }
            const contactUri = _extractContactUri(raw);
            if (contactUri) _contactCache.set(userName, { uri: contactUri, ts: Date.now() });
            cb(contactUri);
        });
    };
    tryLookup(0);
}

export function invalidateContactCache(userName) {
    if (userName) _contactCache.delete(userName);
    else _contactCache.clear();
}

function _sendNotify(userName, eventString, contentType, xmlBody) {
    const email = userName.startsWith('sip:') ? userName.replace('sip:', '') : userName;

    _resolveContact(userName, (contactUri) => {
        if (!contactUri) return;
        const conn = getConnection();
        if (!conn) return;

        const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';
        const e = new modesl.Event('NOTIFY');
        e.addHeader('profile', profile);
        e.addHeader('event-string', eventString);
        e.addHeader('content-type', contentType);
        e.addHeader('contact-uri', contactUri);
        e.addHeader('to-uri', `sip:${email}`);
        e.addHeader('from-uri', `sip:${email}`);
        e.addBody(xmlBody);

        conn.sendEvent(e, () => {});
    });
}

export function showMessage(targets, message, timeout = 4) {
    if (!Array.isArray(targets)) targets = [targets];

    const xmlBody = `<YealinkIPPhoneTextScreen Timeout="${timeout}" LockIn="yes" Beep="yes"><Title>Redline</Title><Text>${message}</Text></YealinkIPPhoneTextScreen>`;

    let sent = 0;
    for (const target of targets) {
        if (!target) continue;
        _sendNotify(target, 'Yealink-xml', 'application/xml', xmlBody);
        sent++;
    }
    if (sent > 0) logSystem('NOTIFY', `message -> ${sent} phone${sent > 1 ? 's' : ''}`);

    global.db?.eventEmitter?.emit('USER_UPDATE', { type: 'message', message, targets });
}

export function sendCommands(targets, commands) {
    if (!Array.isArray(targets)) targets = [targets];

    const items = (Array.isArray(commands) ? commands : [commands])
        .map(cmd => `<ExecuteItem URI="${cmd}"/>`)
        .join('');
    const xmlBody = `<YealinkIPPhoneExecute Beep="yes">${items}</YealinkIPPhoneExecute>`;

    let sent = 0;
    for (const target of targets) {
        if (!target) continue;
        _sendNotify(target, 'Yealink-xml', 'application/xml', xmlBody);
        sent++;
    }
    if (sent > 0) logSystem('NOTIFY', `commands -> ${sent} phone${sent > 1 ? 's' : ''}`);

    global.db?.eventEmitter?.emit('USER_UPDATE', { type: 'commands', commands, targets });
}

export function sendActionUri(targets, actionUri) {
    if (!Array.isArray(targets)) targets = [targets];

    for (const target of targets) {
        if (!target) continue;
        _sendNotify(target, 'ACTION-URI', 'message/sipfrag', actionUri);
    }
}
