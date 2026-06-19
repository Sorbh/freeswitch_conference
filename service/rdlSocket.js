// Socket.IO bridge to Redline main API (apis.redlineusedautoparts.com).
// Inbound: post.created → honk room, room.change.to_sip → change user room.
// Outbound: room.change.to_panel → notify panel of softkey room change.
import { io } from 'socket.io-client';
import { logSystem } from './logger.js';
import { changeUserRoom } from '../modules/admin/users.js';

let socket = null;

export function initRdlSocket() {
    const url = global.config.RDL_SOCKET_URL || 'wss://apis.redlineusedautoparts.com:3002';

    socket = io(url, {
        secure: true,
        rejectUnauthorized: false,
        reconnection: true,
        reconnectionDelay: 5000,
    });

    socket.on('connect', () => {
        logSystem('RDL-SOCKET', `Connected to ${url} (${socket.id})`);
        socket.emit('joinRoom', { userId: 100000, room: 'public' });
        socket.emit('joinRoom', { userId: 100000, room: 'us' });
        socket.emit('joinRoom', { userId: 100000, room: '2' });
        socket.emit('joinRoom', { userId: 100000, room: 100000 });
    });

    socket.on('connect_error', (err) => {
        logSystem('RDL-SOCKET', `Connection error: ${err.message}`);
    });

    socket.on('disconnect', (reason) => {
        logSystem('RDL-SOCKET', `Disconnected: ${reason}`);
    });

    // Inbound: new post → honk default room
    socket.on('production:post.created', async () => {
        logSystem('RDL-SOCKET', 'post.created → honking room');
        try {
            const defaultRoom = Object.keys(global.config.ROOM_NAME || {})[0];
            if (defaultRoom) global.freeswitch.honkRoom(parseInt(defaultRoom));
        } catch (e) {
            logSystem('RDL-SOCKET', `post.created error: ${e.message}`);
        }
    });

    // Inbound: panel changed user's room
    socket.on('production:room.change.to_sip', async (eventData) => {
        const { user_id, room } = eventData || {};
        logSystem('RDL-SOCKET', `room.change.to_sip userId=${user_id} room=${room}`);
        try {
            const users = global.db.filter(u => u.userId === user_id);
            if (users.length === 0) {
                logSystem('RDL-SOCKET', `userId ${user_id} not found`);
                return;
            }
            await changeUserRoom(users[0].userName, parseInt(room), 'rdl-socket');
        } catch (e) {
            logSystem('RDL-SOCKET', `room.change.to_sip error: ${e.message}`);
        }
    });
}

export function sendRoomChangeNotification(userId, room) {
    if (!socket || !socket.connected) {
        logSystem('RDL-SOCKET', `Cannot send room change — not connected`);
        return;
    }
    socket.emit('production:room.change.to_panel', { user_id: userId, room });
    logSystem('RDL-SOCKET', `room.change.to_panel userId=${userId} room=${room}`);
}
