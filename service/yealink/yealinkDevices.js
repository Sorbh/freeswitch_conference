import { ymcs } from './yealinkApi.js';

async function listDevices({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listDevices', { filter, limit });
}

async function getDevice(deviceId) {
    return ymcs.get(`/v2/dm/devices/${deviceId}`);
}

async function createDevice({ mac, sn, deviceType, modelId, ...rest }) {
    return ymcs.post('/v2/dm/devices', { mac, sn, deviceType, modelId, ...rest });
}

async function createManyDevices(devices) {
    return ymcs.post('/v2/dm/addDevices', { devices });
}

async function createManyByMac(devices) {
    return ymcs.post('/v2/dm/addDevicesByMac', { devices });
}

async function updateDevice(deviceId, fields) {
    return ymcs.patch(`/v2/dm/devices/${deviceId}`, fields);
}

async function deleteDevice(deviceId) {
    return ymcs.delete(`/v2/dm/devices/${deviceId}`);
}

async function deleteManyDevices(deviceIds, deviceType) {
    return ymcs.post('/v2/dm/delDevices', { deviceIds, deviceType });
}

async function getDeviceConfig(deviceId) {
    return ymcs.get(`/v2/dm/devices/${deviceId}/configs`);
}

async function rebootDevices(deviceIds, deviceType) {
    return ymcs.post('/v2/dm/device/reboot', { deviceIds, deviceType });
}

async function resetDevices(deviceIds, deviceType) {
    return ymcs.post('/v2/dm/device/reset', { deviceIds, deviceType });
}

async function getDeviceIdByMac(deviceType, macs) {
    return ymcs.post('/v2/dm/deviceId', { deviceType, deviceIds: macs, deviceIdType: 'mac' });
}

export {
    listDevices,
    getDevice,
    createDevice,
    createManyDevices,
    createManyByMac,
    updateDevice,
    deleteDevice,
    deleteManyDevices,
    getDeviceConfig,
    rebootDevices,
    resetDevices,
    getDeviceIdByMac,
};
