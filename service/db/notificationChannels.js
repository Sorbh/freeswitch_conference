import { sqlite } from './connection.js';

function getAllNotificationChannels() {
    return sqlite.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all();
}

function getNotificationChannel(id) {
    return sqlite.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id) || null;
}

function createNotificationChannel({ type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled }) {
    sqlite.prepare(`
        INSERT INTO notification_channels (type, label, bot_token, chat_id, room, message_template, send_answered, send_unanswered, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type || 'telegram', label || null, bot_token, chat_id, room || null, message_template || null, send_answered ?? 1, send_unanswered ?? 1, enabled ?? 1);
    return sqlite.prepare('SELECT * FROM notification_channels ORDER BY id DESC LIMIT 1').get();
}

function updateNotificationChannel(id, fields) {
    const allowed = ['type', 'label', 'bot_token', 'chat_id', 'room', 'message_template', 'send_answered', 'send_unanswered', 'enabled', 'skip_no_parts'];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key) && val !== undefined) {
            sets.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (sets.length === 0) return null;
    sets.push("updated_at = strftime('%s', 'now')");
    values.push(id);
    sqlite.prepare(`UPDATE notification_channels SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getNotificationChannel(id);
}

function deleteNotificationChannel(id) {
    sqlite.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);
}

function incrementNotificationDelivered(id) {
    sqlite.prepare('UPDATE notification_channels SET delivered_count = COALESCE(delivered_count, 0) + 1 WHERE id = ?').run(id);
}

function getEnabledNotificationChannels(room, answered) {
    let rows = sqlite.prepare('SELECT * FROM notification_channels WHERE enabled = 1').all();
    return rows.filter(ch => {
        if (ch.room && ch.room !== room) return false;
        if (answered && !ch.send_answered) return false;
        if (!answered && !ch.send_unanswered) return false;
        return true;
    });
}

export {
    getAllNotificationChannels, getNotificationChannel, createNotificationChannel,
    updateNotificationChannel, deleteNotificationChannel,
    incrementNotificationDelivered, getEnabledNotificationChannels,
};
