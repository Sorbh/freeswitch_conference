import { sqlite } from './connection.js';

function createRoomRequest({ accountId, email, requestedCity, requestedState, message, source }) {
    const result = sqlite.prepare(`
        INSERT INTO room_requests (account_id, email, requested_city, requested_state, message, source)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(accountId || null, email || null, requestedCity || null, requestedState || null, message || null, source || 'dashboard');
    return Number(result.lastInsertRowid);
}

function getRoomRequests(status) {
    const where = status ? 'WHERE r.status = ?' : '';
    const args = status ? [status] : [];
    return sqlite.prepare(`
        SELECT r.*, a.company_name, a.display_name, a.city AS account_city, a.zip AS account_zip
        FROM room_requests r
        LEFT JOIN accounts a ON a.id = r.account_id
        ${where}
        ORDER BY r.created_at DESC
    `).all(...args);
}

// Pending demand grouped by state (case-insensitive), for the admin dashboard
function getRoomRequestStats() {
    return sqlite.prepare(`
        SELECT UPPER(TRIM(COALESCE(NULLIF(requested_state, ''), 'unknown'))) AS state,
               COUNT(*) AS pending
        FROM room_requests
        WHERE status = 'pending'
        GROUP BY state
        ORDER BY pending DESC
    `).all();
}

function updateRoomRequestStatus(id, status, roomId) {
    sqlite.prepare('UPDATE room_requests SET status = ?, room_id = ? WHERE id = ?')
        .run(status, roomId ?? null, id);
}

function getPendingRoomRequestsByState(state) {
    return sqlite.prepare(`
        SELECT r.*, a.company_name, a.display_name
        FROM room_requests r
        LEFT JOIN accounts a ON a.id = r.account_id
        WHERE r.status = 'pending'
          AND UPPER(TRIM(COALESCE(r.requested_state, ''))) = UPPER(TRIM(?))
        ORDER BY r.created_at ASC
    `).all(state);
}

function getPendingRoomRequestByAccount(accountId) {
    return sqlite.prepare(
        "SELECT * FROM room_requests WHERE account_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
    ).get(accountId) || null;
}

export {
    createRoomRequest, getRoomRequests, getRoomRequestStats,
    updateRoomRequestStatus, getPendingRoomRequestsByState,
    getPendingRoomRequestByAccount,
};
