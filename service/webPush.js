import webpush from 'web-push';
import config from '../config/config.js';
import { logSystem } from './logger.js';

let _configured = null;

function _ensureConfigured() {
    if (_configured !== null) return _configured;
    if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
        logSystem('PUSH', 'VAPID keys not set — web push disabled');
        _configured = false;
        return false;
    }
    webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
    _configured = true;
    return true;
}

export function getVapidPublicKey() {
    return _ensureConfigured() ? config.VAPID_PUBLIC_KEY : null;
}

// Send a payload to every subscription of an account. Prunes dead endpoints (404/410).
// Returns the number of successful sends.
export async function sendToAccount(accountId, payload, options = {}) {
    if (!_ensureConfigured()) return 0;
    const subs = global.db.getPushSubscriptionsByAccount(accountId);
    if (!subs.length) return 0;
    const body = JSON.stringify(payload);
    let sent = 0;
    for (const sub of subs) {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                body,
                { TTL: options.TTL ?? 3600, urgency: options.urgency ?? 'normal' }
            );
            sent++;
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                global.db.deletePushSubscriptionByEndpoint(sub.endpoint);
                logSystem('PUSH', `Pruned dead subscription for account ${accountId}`);
            } else {
                logSystem('PUSH', `Send failed for account ${accountId}: ${err.statusCode || ''} ${err.message}`);
            }
        }
    }
    return sent;
}

function _partsBody(partDetail, transcription) {
    if (partDetail) {
        const main = ['year', 'make', 'model']
            .map(k => partDetail[k]).filter(v => v && v !== 'null' && v !== 'not available').join(' ');
        const part = [partDetail.part, partDetail.specification]
            .filter(v => v && v !== 'null' && v !== 'not available').join(', ');
        const text = [main, part].filter(Boolean).join(' — ');
        if (text) return text;
    }
    if (transcription) {
        return transcription.length > 120 ? `${transcription.slice(0, 117)}...` : transcription;
    }
    return 'New parts request in your room';
}

// Push a parts-request broadcast to room members who were NOT connected to hear it live.
export async function notifyBroadcastPush(broadcastData) {
    if (!_ensureConfigured()) return;
    if (!broadcastData.hasPartsRequest) return;

    const { room, roomName, recordingPath, userName } = broadcastData;

    let full = null;
    if (recordingPath) {
        const row = global.db.getBroadcastByRecordingPath(recordingPath);
        if (row) full = global.db.getBroadcastById(row.id);
    }

    let partDetail = null;
    if (full?.part_details) {
        try { partDetail = typeof full.part_details === 'string' ? JSON.parse(full.part_details) : full.part_details; } catch {}
    }

    // Absolute URLs so notifications clicked from an external origin's worker still land here
    let url = `${config.CLIENT_APP_URL}/client/dashboard`;
    if (full) {
        const token = full.share_token || global.db.generateBroadcastShareToken(full.id);
        if (token) url = `${config.CLIENT_APP_URL}/b/${token}`;
    }

    const speaker = userName ? userName.replace('sip:', '') : '';
    const payload = {
        title: `Parts request — ${roomName || room}`,
        body: _partsBody(partDetail, full?.transcription || full?.local_transcription),
        tag: full ? `broadcast-${full.id}` : undefined,
        icon: `${config.CLIENT_APP_URL}/icons/icon-192.png`,
        url,
    };

    const accounts = global.db.getActiveAccountsByRoom(room);
    let sent = 0;
    for (const acct of accounts) {
        if (acct.email === speaker) continue;
        if (!acct.push_parts_requests) continue;
        const userInfo = global.db.getUserInfo(`sip:${acct.email}`);
        if (userInfo?.connectionState === 'connected') continue; // heard it live
        sent += await sendToAccount(acct.id, payload, { TTL: 3600, urgency: 'normal' });
    }
    if (sent) logSystem('PUSH', `Broadcast push sent to ${sent} device(s) for room ${roomName || room}`);
}

// Push an incoming direct call to the callee. Always sent (tab may be backgrounded);
// short TTL because a stale ring notification is useless.
export async function notifyDirectCallPush(callee, caller, callId) {
    if (!_ensureConfigured()) return;
    const acct = callee.account || global.db.getAccountByEmail(callee.email);
    if (!acct || !acct.push_direct_calls) return;

    const sent = await sendToAccount(acct.id, {
        title: `Incoming call — ${caller.displayName || caller.email}`,
        body: [caller.account?.company_name, caller.roomName].filter(Boolean).join(' · ') || 'Direct call on Hotline HQ',
        tag: `direct-call-${callId}`,
        icon: `${config.CLIENT_APP_URL}/icons/icon-192.png`,
        url: `${config.CLIENT_APP_URL}/client/dashboard`,
    }, { TTL: 60, urgency: 'high' });
    if (sent) logSystem('PUSH', `Direct-call push sent to ${callee.email} (${sent} device(s))`);
}
