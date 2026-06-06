import { ymcs } from './yealinkApi.js';

// --- RPS Devices ---

async function listRpsDevices({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/rps/listDevices', { filter, limit });
}

async function createRpsDevice({ mac, sn, serverId, ...rest }) {
    return ymcs.post('/v2/rps/devices', { mac, sn, serverId, ...rest });
}

async function createManyRpsDevices(devices) {
    return ymcs.post('/v2/rps/addDevices', { devices });
}

async function updateRpsDevice(rpsDeviceId, fields) {
    return ymcs.patch(`/v2/rps/devices/${rpsDeviceId}`, fields);
}

async function deleteRpsDevices(ids, idType = 'id') {
    return ymcs.post('/v2/rps/deleteDevices', { ids, idType });
}

// --- RPS Servers ---

async function listRpsServers({ limit = 100 } = {}) {
    return ymcs.post('/v2/rps/listServers', { limit });
}

async function createRpsServer({ serverName, url, authName, password, ...rest }) {
    return ymcs.post('/v2/rps/servers', { serverName, url, authName, password, ...rest });
}

async function updateRpsServer(rpsServerId, fields) {
    return ymcs.patch(`/v2/rps/servers/${rpsServerId}`, fields);
}

async function deleteRpsServer(rpsServerId) {
    return ymcs.delete(`/v2/rps/servers/${rpsServerId}`);
}

export {
    listRpsDevices,
    createRpsDevice,
    createManyRpsDevices,
    updateRpsDevice,
    deleteRpsDevices,
    listRpsServers,
    createRpsServer,
    updateRpsServer,
    deleteRpsServer,
};
