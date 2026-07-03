import { sqlite } from './connection.js';

// ── Push subscriptions ──

function upsertPushSubscription({ accountId, endpoint, p256dh, auth, userAgent }) {
    sqlite.prepare(`
        INSERT INTO push_subscriptions (account_id, endpoint, p256dh, auth, user_agent)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            account_id = excluded.account_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            user_agent = excluded.user_agent
    `).run(accountId, endpoint, p256dh, auth, userAgent || null);
}

function deletePushSubscriptionByEndpoint(endpoint) {
    sqlite.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function getPushSubscriptionsByAccount(accountId) {
    return sqlite.prepare('SELECT * FROM push_subscriptions WHERE account_id = ?').all(accountId);
}

export { upsertPushSubscription, deletePushSubscriptionByEndpoint, getPushSubscriptionsByAccount };
