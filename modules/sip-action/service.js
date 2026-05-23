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

async function thirdPartyCallControl(userName) {
    const userInfo = global.db.getUserInfo(userName);

    if (Object.keys(userInfo).length === 0) {
        console.log(`User ${userName} is not registered yet`);
        return userInfo;
    }

    if (userInfo.authState === AuthState.LOGOUT) {
        console.log(`User ${userName} is logged-out`);
        return userInfo;
    }

    if (userInfo.connectionState === ConnectionState.CONNECTING) {
        console.log(`User ${userName} already connecting`);
        return userInfo;
    }

    if (userInfo.connectionState === ConnectionState.CONNECTED) {
        console.log(`User ${userName} already in call`);
        return userInfo;
    }

    if (userInfo.connectionState === ConnectionState.RETRY) {
        if (userInfo.retryCount > 2) {
            userInfo.connectionState = ConnectionState.ERROR;
            userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            userInfo.retryCount = 0;
            global.db.setUserInfo(userName, userInfo);
            console.log(`${userName} reached max retries, aborting`);
            return userInfo;
        }
        userInfo.retryCount = (userInfo.retryCount || 0) + 1;
    }

    userInfo.connectionState = ConnectionState.CONNECTING;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
    global.db.setUserInfo(userName, userInfo);

    const roomName = global.config.ROOM_NAME[userInfo.room] || userInfo.room;
    console.log(`[CALL] START ${userName} -> ${roomName}${userInfo.retryCount ? ` (retry ${userInfo.retryCount}/2)` : ''}`);

    try {
        const result = await global.freeswitch.originateToConference(userName);
        return result;
    } catch (err) {
        console.error(`[CALL] FAILED ${userName}: ${err.message}`);

        const updatedInfo = global.db.getUserInfo(userName);

        if (updatedInfo.connectionState === ConnectionState.HANGUP) {
            console.error(`[CALL] ${userName} hung up during connect, skip retry`);
            updatedInfo.connectionState = ConnectionState.ERROR;
            updatedInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
            updatedInfo.error = `${userName} originate failed: ${err.message}`;
            global.db.setUserInfo(userName, updatedInfo);
            return updatedInfo;
        }

        updatedInfo.connectionState = ConnectionState.RETRY;
        updatedInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
        updatedInfo.error = `${userName} originate failed: ${err.message}`;
        global.db.setUserInfo(userName, updatedInfo);

        console.log(`Retrying ${userName} in 5s`);
        setTimeout(() => thirdPartyCallControl(userName), 5000);

        return updatedInfo;
    }
}

async function allNewCall() {
    const usersInfo = global.db.getAllUserInfo();

    for (const userInfo of usersInfo) {
        thirdPartyCallControl(userInfo.userName);
    }

    return global.db.getAllUserInfo();
}

async function endCall(userName) {
    const userInfo = global.db.getUserInfo(userName);

    userInfo.connectionState = ConnectionState.HANGUP;
    userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);

    if (userInfo.fsChannelUUID) {
        try {
            await global.freeswitch.hangupCall(userInfo.fsChannelUUID);
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

service.thirdPartyCallControl = thirdPartyCallControl;

export default { service, thirdPartyCallControl, endCall, mute, unmute, allEndCall, allNewCall, ConnectionState, AuthState, showMessage };
