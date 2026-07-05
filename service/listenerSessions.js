// Ephemeral SIP credentials for listen-only conference access.
//
// Public landing-page listeners and admin room monitoring both mint a
// one-time username/password here instead of shipping static SIP creds
// in a browser bundle. The FreeSWITCH directory endpoint resolves
// "listener-*" users from this map during digest auth; entries expire
// after AUTH_TTL_MS and are single-purpose (one INVITE).
//
// Security model:
//   - public sessions get user_context=public_listen so the dialplan
//     can only route them to muted conference legs (listen-<room>)
//   - admin sessions keep user_context=default (existing numeric route)
//   - global + per-IP concurrency caps and an hourly per-IP mint limit
import crypto from "crypto";

const AUTH_TTL_MS = 60 * 1000;          // window to complete SIP digest auth
const MAX_PUBLIC_SESSIONS = 20;         // concurrent public listeners (global)
const MAX_PER_IP = 3;                   // concurrent public listeners per IP
const MAX_MINTS_PER_IP_HOUR = 10;       // session creates per IP per hour
const SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000; // drop tracking after 4h

const sessions = new Map();             // user -> session
const mintLog = new Map();              // ip -> [timestamps]

function _now() {
    return Date.now();
}

function _sweep() {
    const now = _now();
    for (const [user, s] of sessions) {
        // unused sessions die at auth TTL; used ones are kept (call may be
        // long-lived) but dropped from tracking after SESSION_LIFETIME_MS
        if (!s.authenticated && now > s.createdAt + AUTH_TTL_MS) sessions.delete(user);
        else if (now > s.createdAt + SESSION_LIFETIME_MS) sessions.delete(user);
    }
    for (const [ip, times] of mintLog) {
        const recent = times.filter(t => now - t < 60 * 60 * 1000);
        if (recent.length === 0) mintLog.delete(ip);
        else mintLog.set(ip, recent);
    }
}
setInterval(_sweep, 30 * 1000).unref();

function _activePublicSessions() {
    _sweep();
    return [...sessions.values()].filter(s => s.type === 'public');
}

export function mintPublicSession(room, ip) {
    _sweep();

    const recentMints = (mintLog.get(ip) || []).filter(t => _now() - t < 60 * 60 * 1000);
    if (recentMints.length >= MAX_MINTS_PER_IP_HOUR) {
        return { error: 'rate_limited' };
    }

    const active = _activePublicSessions();
    if (active.length >= MAX_PUBLIC_SESSIONS) {
        return { error: 'listener_limit_reached' };
    }
    if (active.filter(s => s.ip === ip).length >= MAX_PER_IP) {
        return { error: 'ip_limit_reached' };
    }

    const user = `listener-${crypto.randomBytes(8).toString('hex')}`;
    const password = crypto.randomBytes(24).toString('base64url');
    sessions.set(user, {
        type: 'public',
        user,
        password,
        room,
        ip,
        createdAt: _now(),
        authenticated: false,
    });
    mintLog.set(ip, [...recentMints, _now()]);
    return { user, password };
}

export function mintAdminSession(room, adminEmail) {
    _sweep();
    const user = `admin-listen-${crypto.randomBytes(8).toString('hex')}`;
    const password = crypto.randomBytes(24).toString('base64url');
    sessions.set(user, {
        type: 'admin',
        user,
        password,
        room,
        adminEmail,
        createdAt: _now(),
        authenticated: false,
    });
    return { user, password };
}

// Called by the FreeSWITCH directory endpoint during digest auth.
// FS hits the directory more than once per INVITE (challenge + sip_auth),
// so we allow lookups for a short window after first auth, then the
// credential goes dark — it cannot be replayed for a later INVITE.
const REUSE_WINDOW_MS = 30 * 1000;

export function lookupSession(user) {
    if (!user || (!user.startsWith('listener-') && !user.startsWith('admin-listen-'))) return null;
    const s = sessions.get(user);
    if (!s) return null;
    const now = _now();
    if (!s.authenticated) {
        if (now > s.createdAt + AUTH_TTL_MS) {
            sessions.delete(user);
            return null;
        }
        s.authenticated = true;
        s.firstAuthAt = now;
        return s;
    }
    if (now > s.firstAuthAt + REUSE_WINDOW_MS) return null;
    return s;
}

export function listenerStats() {
    const active = _activePublicSessions();
    return { publicSessions: active.length, maxPublic: MAX_PUBLIC_SESSIONS };
}
