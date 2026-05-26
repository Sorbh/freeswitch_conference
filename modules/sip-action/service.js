import { initiateCall, canInitiateCall } from '../../service/freeswitch/callGate.js';

const service = {};

const ConnectionState = {
    IDEAL: 'ideal',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    HANGUP: 'hangup',
    RETRY: 'retry',
    ERROR: 'error',
};
global.ConnectionState = ConnectionState;

const AuthState = {
    LOGIN: 'login',
    LOGOUT: 'logout',
};
global.AuthState = AuthState;

async function allNewCall() {
    const usersInfo = global.db.getAllUserInfo();

    for (const userInfo of usersInfo) {
        initiateCall(userInfo.userName);
    }

    return global.db.getAllUserInfo();
}

async function endCall(userName) {
    const userInfo = global.db.getUserInfo(userName);

    userInfo.connectionState = ConnectionState.HANGUP;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);

    if (userInfo.fsChannelUUID) {
        try {
            await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName);
        } catch (err) {
            console.error(`${userName} hangup error: ${err.message}`);
        }
        userInfo.fsChannelUUID = null;
        userInfo.fsMemberId = null;
    }

    global.db.setUserInfo(userName, userInfo);
    return userInfo;
}

async function allEndCall() {
    const usersInfo = global.db.getAllUserInfo();

    for (const userInfo of usersInfo) {
        await endCall(userInfo.userName);
    }

    return global.db.getAllUserInfo();
}

async function mute(userInfo) {
    global.freeswitch.muteUser(userInfo.mac.toLowerCase());
}

async function unmute(userInfo) {
    global.freeswitch.unmuteUser(userInfo.mac.toLowerCase());
}

async function showMessage(contact, message) {
    global.freeswitch.showMessage(contact, message);
}

async function sendCommands(contacts, commands) {
    global.freeswitch.sendCommands(contacts, commands);
}

async function sendActionUri(contacts, actionUri) {
    global.freeswitch.sendActionUri(contacts, actionUri);
}

service.initiateCall = initiateCall;

export default { service, initiateCall, endCall, mute, unmute, allEndCall, allNewCall, ConnectionState, AuthState, showMessage, sendCommands, sendActionUri };
