import { ymcs } from './yealinkApi.js';

async function listGroups({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listDeviceGroups', { filter, limit });
}

async function createGroup({ groupName, deviceType, ...rest }) {
    return ymcs.post('/v2/dm/deviceGroups', { groupName, deviceType, ...rest });
}

async function updateGroup(deviceGroupId, fields) {
    return ymcs.patch(`/v2/dm/deviceGroups/${deviceGroupId}`, fields);
}

async function deleteGroup(deviceGroupId) {
    return ymcs.delete(`/v2/dm/deviceGroups/${deviceGroupId}`);
}

async function addDevicesToGroup(deviceGroupId, deviceIds) {
    return ymcs.post(`/v2/dm/deviceGroups/${deviceGroupId}/addDevices`, { deviceIds });
}

async function removeDevicesFromGroup(deviceGroupId, deviceIds) {
    return ymcs.post(`/v2/dm/deviceGroups/${deviceGroupId}/delDevices`, { deviceIds });
}

async function listGroupDevices(deviceGroupId, { filter = {}, limit = 100 } = {}) {
    return ymcs.post(`/v2/dm/deviceGroups/${deviceGroupId}/listDevices`, { filter, limit });
}

export {
    listGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addDevicesToGroup,
    removeDevicesFromGroup,
    listGroupDevices,
};
