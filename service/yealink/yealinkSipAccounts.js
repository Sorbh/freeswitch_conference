import { ymcs } from './yealinkApi.js';

async function listAccounts({ filter = {}, limit = 100, skip = 0, autoCount = true } = {}) {
    return ymcs.post('/v2/dm/listAccounts', { filter, limit, skip, autoCount });
}

async function createAccount({ registerName, username, password, sipServer1Host, sipServer1Port, ...rest }) {
    return ymcs.post('/v2/dm/sipAccounts', {
        registerName, username, password,
        sipServer1: { host: sipServer1Host, port: sipServer1Port },
        ...rest,
    });
}

async function updateAccount(accountId, fields) {
    return ymcs.patch(`/v2/dm/sipAccounts/${accountId}`, fields);
}

async function deleteAccounts(accountIds) {
    return ymcs.post('/v2/dm/delAccounts', { accountIds });
}

async function bindAccounts(deviceId, accounts) {
    return ymcs.post(`/v2/dm/devices/${deviceId}/bindAccounts`, accounts);
}

async function unbindAccounts(deviceId, accountIds) {
    return ymcs.post(`/v2/dm/devices/${deviceId}/unbindAccounts`, { accountIds });
}

async function getBoundAccounts(deviceId) {
    return ymcs.get(`/v2/dm/devices/${deviceId}/boundAccounts`);
}

export {
    listAccounts,
    createAccount,
    updateAccount,
    deleteAccounts,
    bindAccounts,
    unbindAccounts,
    getBoundAccounts,
};
