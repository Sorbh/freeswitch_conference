import { sqlite } from './connection.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60;

const SAFE_COLUMNS = 'b.id, b.room, b.room_name, b.part_details, b.created_at, b.duration_ms, b.display_name, b.listener_count';

function getMarketplaceListings({ page = 1, pageSize = 20, room, year, make, model } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - SEVEN_DAYS;

    const conditions = [
        'b.answered = 0',
        'b.has_parts_request = 1',
        'b.part_details IS NOT NULL',
        'b.created_at > ?',
        `json_extract(b.part_details, '$.year') IS NOT NULL AND json_extract(b.part_details, '$.year') != 'null'`,
        `json_extract(b.part_details, '$.make') IS NOT NULL AND json_extract(b.part_details, '$.make') != 'null'`,
    ];
    const params = [cutoff];

    if (room) {
        conditions.push('b.room = ?');
        params.push(room);
    }

    // JSON filters — SQLite json_extract
    if (year) {
        conditions.push("json_extract(b.part_details, '$.year') = ?");
        params.push(String(year));
    }
    if (make) {
        conditions.push("LOWER(json_extract(b.part_details, '$.make')) = LOWER(?)");
        params.push(String(make));
    }
    if (model) {
        conditions.push("LOWER(json_extract(b.part_details, '$.model')) = LOWER(?)");
        params.push(String(model));
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const total = sqlite.prepare(
        `SELECT COUNT(*) as count FROM broadcast_log b ${where}`
    ).get(...params).count;

    const offset = (page - 1) * pageSize;

    const rows = sqlite.prepare(
        `SELECT ${SAFE_COLUMNS} FROM broadcast_log b ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return {
        data: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

// Unlike the list query, answered listings ARE returned here — the public page shows
// them in a "request filled" state instead of 404ing (they were pinged to IndexNow).
function getMarketplaceListingById(id) {
    return sqlite.prepare(
        `SELECT ${SAFE_COLUMNS}, b.answered FROM broadcast_log b WHERE b.id = ? AND b.has_parts_request = 1 AND b.part_details IS NOT NULL`
    ).get(id) || null;
}

function getMarketplaceResponseCount(broadcastId, ip) {
    return sqlite.prepare(
        'SELECT COUNT(*) as count FROM marketplace_responses WHERE broadcast_id = ? AND ip = ?'
    ).get(broadcastId, ip).count;
}

function getIpResponseCount(ip, windowSeconds = 3600) {
    const since = Math.floor(Date.now() / 1000) - windowSeconds;
    return sqlite.prepare(
        'SELECT COUNT(*) as count FROM marketplace_responses WHERE ip = ? AND created_at > ?'
    ).get(ip, since).count;
}

function createMarketplaceResponse({ broadcastId, name, company, phone, email, message, ip }) {
    const result = sqlite.prepare(
        `INSERT INTO marketplace_responses (broadcast_id, name, company, phone, email, message, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(broadcastId, name, company || null, phone, email, message || null, ip || null);
    return Number(result.lastInsertRowid);
}

function getMarketplaceResponsesForBroadcast(broadcastId) {
    return sqlite.prepare(
        'SELECT * FROM marketplace_responses WHERE broadcast_id = ? ORDER BY created_at DESC'
    ).all(broadcastId);
}

function getMarketplaceResponseCountForBroadcast(broadcastId) {
    return sqlite.prepare(
        'SELECT COUNT(*) as count FROM marketplace_responses WHERE broadcast_id = ?'
    ).get(broadcastId).count;
}

function getMarketplaceRoomStats(roomId) {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - SEVEN_DAYS;

    const totalBroadcasts = sqlite.prepare(
        `SELECT COUNT(*) as count FROM broadcast_log WHERE room = ? AND has_parts_request = 1 AND part_details IS NOT NULL`
    ).get(roomId).count;

    const activeBroadcasts = sqlite.prepare(
        `SELECT COUNT(*) as count FROM broadcast_log WHERE room = ? AND has_parts_request = 1 AND part_details IS NOT NULL AND created_at > ?`
    ).get(roomId, cutoff).count;

    const yardCount = sqlite.prepare(
        `SELECT COUNT(*) as count FROM accounts WHERE room = ? AND active = 1`
    ).get(roomId).count;

    const topMakes = sqlite.prepare(
        `SELECT json_extract(part_details, '$.make') as name, COUNT(*) as count
         FROM broadcast_log
         WHERE room = ? AND has_parts_request = 1 AND part_details IS NOT NULL
           AND json_extract(part_details, '$.make') IS NOT NULL
           AND json_extract(part_details, '$.make') != 'null'
         GROUP BY name ORDER BY count DESC LIMIT 5`
    ).all(roomId);

    const topParts = sqlite.prepare(
        `SELECT json_extract(part_details, '$.part') as name, COUNT(*) as count
         FROM broadcast_log
         WHERE room = ? AND has_parts_request = 1 AND part_details IS NOT NULL
           AND json_extract(part_details, '$.part') IS NOT NULL
           AND json_extract(part_details, '$.part') != 'null'
         GROUP BY name ORDER BY count DESC LIMIT 5`
    ).all(roomId);

    return { totalBroadcasts, activeBroadcasts, yardCount, topMakes, topParts };
}

function getRelatedListings(broadcastId, make, room, limit = 4) {
    if (!make || make === 'null') return [];
    return sqlite.prepare(
        `SELECT ${SAFE_COLUMNS} FROM broadcast_log b
         WHERE b.id != ? AND b.room = ? AND b.has_parts_request = 1
           AND b.part_details IS NOT NULL
           AND LOWER(json_extract(b.part_details, '$.make')) = LOWER(?)
           AND json_extract(b.part_details, '$.year') IS NOT NULL AND json_extract(b.part_details, '$.year') != 'null'
           AND json_extract(b.part_details, '$.model') IS NOT NULL AND json_extract(b.part_details, '$.model') != 'null'
         ORDER BY b.created_at DESC LIMIT ?`
    ).all(broadcastId, room, make, limit);
}

function getAllRoomStats() {
    return sqlite.prepare(
        `SELECT b.room, b.room_name, COUNT(*) as broadcasts,
                (SELECT COUNT(*) FROM accounts WHERE room = b.room AND active = 1) as yards
         FROM broadcast_log b
         WHERE b.has_parts_request = 1 AND b.part_details IS NOT NULL
         GROUP BY b.room
         HAVING broadcasts > 0
         ORDER BY broadcasts DESC`
    ).all();
}

function getMarketplaceStats() {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - SEVEN_DAYS;

    const activeListings = sqlite.prepare(
        `SELECT COUNT(*) as count FROM broadcast_log
         WHERE answered = 0 AND has_parts_request = 1 AND part_details IS NOT NULL AND created_at > ?`
    ).get(cutoff).count;

    const totalResponses = sqlite.prepare(
        'SELECT COUNT(*) as count FROM marketplace_responses'
    ).get().count;

    const listingsWithResponses = sqlite.prepare(
        `SELECT COUNT(DISTINCT mr.broadcast_id) as count
         FROM marketplace_responses mr
         JOIN broadcast_log b ON b.id = mr.broadcast_id
         WHERE b.answered = 0 AND b.has_parts_request = 1 AND b.part_details IS NOT NULL AND b.created_at > ?`
    ).get(cutoff).count;

    return {
        activeListings,
        totalResponses,
        responseRate: activeListings > 0 ? Math.round((listingsWithResponses / activeListings) * 100) : 0,
    };
}

export {
    getMarketplaceListings,
    getMarketplaceListingById,
    getMarketplaceResponseCount,
    getIpResponseCount,
    createMarketplaceResponse,
    getMarketplaceResponsesForBroadcast,
    getMarketplaceResponseCountForBroadcast,
    getMarketplaceStats,
    getMarketplaceRoomStats,
    getRelatedListings,
    getAllRoomStats,
};
