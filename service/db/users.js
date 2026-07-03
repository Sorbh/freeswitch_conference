import { sqlite, eventEmitter } from './connection.js';
import { getAccountByEmail } from './accounts.js';

function getUserInfo(userName) {
    const row = sqlite.prepare('SELECT * FROM users WHERE user_name = ?').get(userName);
    if (!row) return {};
    return _rowToUserInfo(row);
}

function setUserInfo(userName, userInfo) {
    const existing = sqlite.prepare('SELECT user_name FROM users WHERE user_name = ?').get(userName);

    if (existing) {
        sqlite.prepare(`
            UPDATE users SET
                user_id = ?, contact = ?, mac = ?, ip = ?, port = ?,
                room = ?, current_room = ?, connection_state = ?, auth_state = ?, mute = ?,
                online = ?, payment = ?, retry_count = ?, login_expire = ?,
                last_connection_state_update = ?, fs_channel_uuid = ?, fs_member_id = ?,
                caller_id_name = ?, caller_id_html = ?, user_agent = ?, error = ?,
                redline_data = ?, client_type = ?, registration_state = ?, reachable = ?,
                err_fallback_stage = ?, err_fallback_at = ?,
                last_seen = COALESCE(?, last_seen),
                updated_at = strftime('%s', 'now')
            WHERE user_name = ?
        `).run(
            userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.currentRoom || userInfo.room, userInfo.connectionState, userInfo.authState, userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData,
            userInfo.clientType || 'unknown',
            userInfo.registrationState || 'unregistered',
            userInfo.reachable ? 1 : 0,
            userInfo.errFallbackStage || 0, userInfo.errFallbackAt || null,
            userInfo.lastSeen || null,
            userName
        );
    } else {
        sqlite.prepare(`
            INSERT INTO users (
                user_name, user_id, contact, mac, ip, port,
                room, current_room, connection_state, auth_state, mute,
                online, payment, retry_count, login_expire,
                last_connection_state_update, fs_channel_uuid, fs_member_id,
                caller_id_name, caller_id_html, user_agent, error, redline_data, client_type,
                registration_state, reachable, err_fallback_stage, err_fallback_at, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userName, userInfo.userId, userInfo.contact, userInfo.mac, userInfo.ip, userInfo.port,
            userInfo.room, userInfo.currentRoom || userInfo.room, userInfo.connectionState || 'ideal', userInfo.authState || 'logout', userInfo.mute ? 1 : 0,
            userInfo.online ? 1 : 0, userInfo.payment ? 1 : 0, userInfo.retryCount || 0, userInfo.login_expire,
            userInfo.lastConnectionStateUpdate, userInfo.fsChannelUUID, userInfo.fsMemberId,
            userInfo.callerIdName, userInfo.callerIdHtml, userInfo.userAgent, userInfo.error,
            typeof userInfo.redlineData === 'object' ? JSON.stringify(userInfo.redlineData) : userInfo.redlineData,
            userInfo.clientType || 'unknown',
            userInfo.registrationState || 'unregistered',
            userInfo.reachable ? 1 : 0,
            userInfo.errFallbackStage || 0, userInfo.errFallbackAt || null,
            userInfo.lastSeen || null
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const talkingUsers = global.freeswitch?.getTalkingUsers?.() || new Set();
    const email = userName.replace(/^sip:/, '');
    const acct = getAccountByEmail(email);
    eventEmitter.emit('USER_SYNC', {
        type: 'user_sync', userName, ...userInfo,
        talking: talkingUsers.has(userName),
        last_seen: userInfo.lastSeen || userInfo.updatedAt || userInfo.createdAt,
        online_duration: userInfo.online && userInfo.lastConnectionStateUpdate ? now - userInfo.lastConnectionStateUpdate : 0,
        _kickout: acct?.kickout ?? null,
        _active: acct?.active ?? null,
    });
}

function touchLastSeen(userName) {
    sqlite.prepare('UPDATE users SET last_seen = strftime(\'%s\', \'now\') WHERE user_name = ?').run(userName);
}

function updateUserInfo(userName, updates) {
    const userInfo = getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;
    Object.assign(userInfo, updates);
    setUserInfo(userName, userInfo);
}

function getAllUserInfo() {
    const rows = sqlite.prepare('SELECT * FROM users').all();
    return rows.map(_rowToUserInfo);
}

function findUserInfo(key, value) {
    const columnMap = { mac: 'mac', room: 'room', userId: 'user_id' };
    const column = columnMap[key];

    if (column) {
        const row = sqlite.prepare(`SELECT * FROM users WHERE ${column} = ?`).get(value);
        return row ? _rowToUserInfo(row) : {};
    }

    const rows = sqlite.prepare('SELECT * FROM users').all();
    for (const row of rows) {
        const userInfo = _rowToUserInfo(row);
        if (userInfo[key] == value) return userInfo;
    }

    console.error(`No Matching Keys ${key} & Values ${value}`);
    return {};
}

function filter(callback) {
    const rows = sqlite.prepare('SELECT * FROM users').all();
    return rows.map(_rowToUserInfo).filter(callback);
}

function deleteUserInfo(userName) {
    sqlite.prepare('DELETE FROM users WHERE user_name = ?').run(userName);
}

function resetAllConnectionStates() {
    sqlite.prepare(`
        UPDATE users SET
            connection_state = 'ideal',
            fs_channel_uuid = NULL,
            fs_member_id = NULL,
            mute = 1,
            online = 0,
            updated_at = strftime('%s', 'now')
    `).run();
    console.log('All user connection states reset to ideal');
}
function _rowToUserInfo(row) {
    let redlineData = row.redline_data;
    try {
        if (typeof redlineData === 'string') redlineData = JSON.parse(redlineData);
    } catch { }

    return {
        userName: row.user_name,
        userId: row.user_id,
        contact: row.contact,
        mac: row.mac,
        ip: row.ip,
        port: row.port,
        room: row.room,
        currentRoom: row.current_room,
        connectionState: row.connection_state,
        authState: row.auth_state,
        mute: !!row.mute,
        online: !!row.online,
        payment: !!row.payment,
        retryCount: row.retry_count,
        login_expire: row.login_expire,
        lastConnectionStateUpdate: row.last_connection_state_update,
        fsChannelUUID: row.fs_channel_uuid,
        fsMemberId: row.fs_member_id,
        callerIdName: row.caller_id_name,
        callerIdHtml: row.caller_id_html,
        userAgent: row.user_agent,
        error: row.error,
        redlineData: redlineData,
        clientType: row.client_type || 'unknown',
        registrationState: row.registration_state || 'unregistered',
        reachable: !!row.reachable,
        lastSeen: row.last_seen,
        errFallbackStage: row.err_fallback_stage || 0,
        errFallbackAt: row.err_fallback_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export {
    getUserInfo, setUserInfo, touchLastSeen, updateUserInfo, getAllUserInfo,
    findUserInfo, filter, deleteUserInfo, resetAllConnectionStates,
};
