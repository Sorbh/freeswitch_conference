import responseMessages from "./responseMessages.js";
import service from "./service.js";

export default class ActionController {

    newCall = async (request, response) => {
        console.log(request.url);
        try {
            const data = await service.initiateCall(`sip:${request.query.user_name}`);
            return response.status(200).json({ message: 'new call api working fine', data });
        } catch (err) {
            return response.status(400).json(responseMessages.responseMessages.newCallFailed);
        }
    };

    endCall = async (request, response) => {
        console.log(request.url);
        const data = await service.endCall(`sip:${request.query.user_name}`);
        return response.status(200).json({ ...responseMessages.responseMessages.callEnded, data });
    };

    status = async (request, response) => {
        console.log(request.url);
        const data = global.db.getUserInfo(`sip:${request.query.user_name}`);
        return response.status(200).json({ ...responseMessages.responseMessages.successStatus, data });
    };

    onHook = async (request, response) => {
        console.log(request.url);
        const userInfo = global.db.findUserInfo('mac', `${request.query.mac.match(/.{1,2}/g).join(':')}`.toLowerCase());
        if (this._checkValidUser(userInfo)) {
            return response.status(400).json(responseMessages.responseMessages.userNotFound);
        }
        service.mute(userInfo);
        userInfo.mute = true;
        global.db.setUserInfo(userInfo.userName, userInfo);
        return response.status(200).json({ message: 'onHook api working fine' });
    };

    offhook = async (request, response) => {
        console.log(request.url);
        const userInfo = global.db.findUserInfo('mac', `${request.query.mac.match(/.{1,2}/g).join(':')}`.toLowerCase());
        if (this._checkValidUser(userInfo)) {
            return response.status(400).json(responseMessages.responseMessages.userNotFound);
        }
        service.unmute(userInfo);
        userInfo.mute = false;
        global.db.setUserInfo(userInfo.userName, userInfo);
        return response.status(200).json({ message: 'offhook api working fine' });
    };

    login = async (request, response) => {
        console.log(request.url);
        const userInfo = global.db.findUserInfo('mac', `${request.query.mac.match(/.{1,2}/g).join(':')}`.toLowerCase());
        if (this._checkValidUser(userInfo)) {
            return response.status(400).json(responseMessages.responseMessages.userNotFound);
        }
        userInfo.authState = global.AuthState.LOGIN;
        userInfo.login_expire = Math.floor(Date.now() / 1000) + global.config.loginExpireTime;
        global.db.setUserInfo(userInfo.userName, userInfo);
        return response.status(200).json({ message: 'User Logged in' });
    };

    logout = async (request, response) => {
        console.log(request.url);
        var userInfo = global.db.findUserInfo('mac', `${request.query.mac.match(/.{1,2}/g).join(':')}`.toLowerCase());
        if (this._checkValidUser(userInfo)) {
            return response.status(400).json(responseMessages.responseMessages.userNotFound);
        }
        await service.endCall(userInfo.userName);
        userInfo = global.db.getUserInfo(userInfo.userName);
        userInfo.authState = global.AuthState.LOGOUT;
        global.db.setUserInfo(userInfo.userName, userInfo);
        return response.status(200).json({ message: 'User logged out' });
    };

    allEndCall = async (request, response) => {
        console.log(request.url);
        const data = await service.allEndCall();
        return response.status(200).json({ message: 'end call all api working fine', data });
    };

    allNewCall = async (request, response) => {
        console.log(request.url);
        try {
            const data = await service.allNewCall();
            return response.status(200).json({ message: 'new call all api working fine', data });
        } catch (error) {
            return response.status(400).json({ message: 'Error in initiating calls' });
        }
    };

    allStatus = async (request, response) => {
        console.log(request.url);

        if (request.query.keep_alive) {
            console.log(`[KEEP-ALIVE] Keep-alive connected from ${request.ip}`);
            response.setHeader('Content-Type', 'text/event-stream');
            response.setHeader('Cache-Control', 'no-cache');
            response.setHeader('Connection', 'keep-alive');
            response.flushHeaders();
            const data = global.db.getAllUserInfo();
            response.write(`data: ${JSON.stringify({ message: 'Status all api working fine', data })}\n\n`);
            global.db.eventEmitter.on('USER_UPDATE', (msg) => {
                response.write(`data: ${JSON.stringify({ message: 'Status all api working fine', data: [msg] })}\n\n`);
            });
            request.on('close', () => {
                console.log(`[KEEP-ALIVE] Keep-alive disconnected from ${request.ip}`);
                response.end();
            });
            return;
        }

        const data = global.db.getAllUserInfo();
        return response.status(200).json({ message: 'Status all api working fine', data });
    };

    updateRoom = async (request, response) => {
        try {
            console.log(request.url);

            let macAddress = request.query.mac ? request.query.mac.match(/.{1,2}/g).join(':') : null;

            if (!macAddress) {
                const userAgent = request.headers["user-agent"];
                if (userAgent && userAgent.includes("Yealink")) {
                    const macMatch = userAgent.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                    macAddress = macMatch ? macMatch[0] : null;
                }
            }

            var userInfo = global.db.findUserInfo('mac', macAddress.toLowerCase());
            if (this._checkValidUser(userInfo)) {
                return response.status(400).json(responseMessages.responseMessages.userNotFound);
            }
            await service.endCall(userInfo.userName);
            userInfo = global.db.getUserInfo(userInfo.userName);
            userInfo.room = parseInt(request.query.room);
            global.db.setUserInfo(userInfo.userName, userInfo);
            await service.initiateCall(userInfo.userName);

            return response.status(200).json({ message: 'Updated the room and refreshed the call' });
        } catch (error) {
            return response.status(400).json({ message: `Unable to update room: ${error}` });
        }
    };

    statusUpdate = async (request, response) => {
        console.log(request.url);
        try {
            const { email, status } = request.body;
            const missingFields = Object.keys({ email, status }).filter(key => request.body[key] === undefined);

            if (missingFields.length) {
                return response.status(400).json({ ...responseMessages.responseMessages.missingField, field: missingFields });
            }

            var userInfo = global.db.getUserInfo(`sip:${email}`);
            if (this._checkValidUser(userInfo)) {
                return response.status(400).json(responseMessages.responseMessages.userNotFound);
            }

            if (![global.AuthState.LOGIN, global.AuthState.LOGOUT].includes(status)) {
                return response.status(400).json(responseMessages.responseMessages.notValidAuthStatus);
            }

            if (status === global.AuthState.LOGIN) {
                userInfo.login_expire = Math.floor(Date.now() / 1000) + global.config.loginExpireTime;
            } else {
                await service.endCall(userInfo.userName);
                userInfo = global.db.getUserInfo(`sip:${email}`);
            }

            userInfo.authState = status;
            global.db.setUserInfo(`sip:${email}`, userInfo);

            return response.status(200).json({
                ...responseMessages.responseMessages.successStatus,
                message: `${userInfo.userName} status updated successfully`,
                data: userInfo,
            });
        } catch (error) {
            return response.status(400).json({ ...responseMessages.responseMessages.somethingWentWrong, error });
        }
    };

    showmessage = async (request, response) => {
        console.log(request.url);
        const userInfo = global.db.findUserInfo('mac', `${request.query.mac.match(/.{1,2}/g).join(':')}`.toLowerCase());
        if (this._checkValidUser(userInfo)) {
            return response.status(400).json(responseMessages.responseMessages.userNotFound);
        }
        await service.showMessage(userInfo.contact, request.query.message);
        return response.status(200).json({ message: 'Show Message' });
    };

    honkRoom = async (request, response) => {
        console.log(request.url);
        global.freeswitch.honkRoom(request.query.room);
        return response.status(200).json({ message: 'Action done' });
    };

    deleteAccount = async (request, response) => {
        console.log(request.url);
        try {
            global.db.deleteUserInfo(`sip:${request.body.user_name}`);
            return response.status(200).json({ ...responseMessages.responseMessages.successStatus, message: 'User deleted successfully' });
        } catch (error) {
            return response.status(400).json({ ...responseMessages.responseMessages.somethingWentWrong, error: error.message });
        }
    };

    _checkValidUser(userInfo) {
        if (userInfo == null || userInfo === undefined || JSON.stringify(userInfo) === '{}') {
            return true;
        }
    }
}
