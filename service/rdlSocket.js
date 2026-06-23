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
        const { user_email, room } = eventData || {};
        logSystem('RDL-SOCKET', `room.change.to_sip email=${user_email} room=${room}`);
        try {
            if (!user_email) {
                logSystem('RDL-SOCKET', `room.change.to_sip missing user_email`);
                return;
            }
            const userName = `sip:${user_email}`;
            const userInfo = global.db.getUserInfo(userName);
            if (!userInfo || Object.keys(userInfo).length === 0) {
                logSystem('RDL-SOCKET', `email ${user_email} not found`);
                return;
            }
            await changeUserRoom(userName, parseInt(room), 'rdl-socket');
        } catch (e) {
            logSystem('RDL-SOCKET', `room.change.to_sip error: ${e.message}`);
        }
    });
}

export function sendRoomChangeNotification(userEmail, room) {
    if (!socket || !socket.connected) {
        logSystem('RDL-SOCKET', `Cannot send room change — not connected`);
        return;
    }
    const email = userEmail.replace(/^sip:/, '');
    socket.emit('production:room.change.to_panel', { user_email: email, room });
    logSystem('RDL-SOCKET', `room.change.to_panel email=${email} room=${room}`);
}
