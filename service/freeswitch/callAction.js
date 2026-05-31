// Call action commands sent to FreeSWITCH via ESL.
// Hangup, mute/unmute, honk, conference list query.
import { getConnection } from './connection.js';
import { logUser, logSystem } from '../logger.js';

export function hangupCall(uuid, userName) {
    return new Promise((resolve) => {
        if (!uuid) {
            resolve();
            return;
        }
        if (!userName) {
            const users = global.db.filter(u => u.fsChannelUUID === uuid);
            userName = users.length > 0 ? users[0].userName : null;
        }
        getConnection().api(`uuid_kill ${uuid}`, (response) => {
            logUser(userName || 'unknown', 'ACTION', 'KILL');
            resolve();
        });
    });
}

export function muteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;
    userInfo.mute = true;
    global.db.setUserInfo(userInfo.userName, userInfo);
    muteByMemberId(userInfo.room, userInfo.fsMemberId, userInfo.userName);
}

export function unmuteUser(mac) {
    const userInfo = global.db.findUserInfo('mac', mac);
    if (Object.keys(userInfo).length === 0 || !userInfo.fsMemberId) return;
    userInfo.mute = false;
    global.db.setUserInfo(userInfo.userName, userInfo);
    unmuteByMemberId(userInfo.room, userInfo.fsMemberId, userInfo.userName);
}

export function muteByMemberId(room, memberId, userName) {
    const roomName = global.config.ROOM_NAME[room] || room;
    getConnection().api(`conference ${room} mute ${memberId}`, (response) => {
        logUser(userName || 'unknown', 'ACTION', `MUTE -> ${roomName} (member ${memberId})`);
    });
}

export function unmuteByMemberId(room, memberId, userName) {
    const roomName = global.config.ROOM_NAME[room] || room;
    getConnection().api(`conference ${room} unmute ${memberId}`, (response) => {
        logUser(userName || 'unknown', 'ACTION', `UNMUTE -> ${roomName} (member ${memberId})`);
    });
}

export function conferenceKick(room, memberId, userName) {
    return new Promise((resolve) => {
        if (!memberId) { resolve(); return; }
        const roomName = global.config.ROOM_NAME[room] || room;
        getConnection().api(`conference ${room} kick ${memberId}`, (response) => {
            logUser(userName || 'unknown', 'ACTION', `KICK from ${roomName} (member ${memberId})`);
            resolve();
        });
    });
}

export function honkRoom(room) {
    const audioFile = global.config.HONK_AUDIO_FILE;
    const roomName = global.config.ROOM_NAME[room] || room;
    getConnection().api(`conference ${room} play ${audioFile}`, (response) => {
        logSystem('ACTION', `HONK ${roomName}`);
        global.db.logEvent('honk', null, room, `Honk played in ${roomName}`);
    });
}

export function getConferenceList() {
    return new Promise((resolve) => {
        getConnection().api('conference list', (response) => {
            logSystem('ACTION', 'Conference list queried');
            resolve(response.getBody().trim());
        });
    });
}
