import { ymcs } from './yealinkApi.js';

// --- Device Configs ---

async function listDeviceConfigs({ limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listDeviceConfigs', { limit });
}

async function getDeviceConfig(configId) {
    return ymcs.get(`/v2/dm/deviceConfigs/${configId}`);
}

async function createDeviceConfig({ name, modelId, ...rest }) {
    return ymcs.post('/v2/dm/deviceConfigs', { name, modelId, ...rest });
}

async function updateDeviceConfig(configId, { name, modelId, ...rest }) {
    return ymcs.patch(`/v2/dm/deviceConfigs/${configId}`, { name, modelId, ...rest });
}

async function deleteDeviceConfigs(configIds) {
    return ymcs.post('/v2/dm/delDeviceConfigs', { configIds });
}

async function pushDeviceConfig(configId) {
    return ymcs.post(`/v2/dm/deviceConfigs/${configId}/push`);
}

// --- Site Configs ---

async function listSiteConfigs({ limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listSiteConfigs', { limit });
}

async function getSiteConfig(configId) {
    return ymcs.get(`/v2/dm/siteConfigs/${configId}`);
}

async function createSiteConfig({ name, siteId, deviceType, ...rest }) {
    return ymcs.post('/v2/dm/siteConfigs', { name, siteId, deviceType, ...rest });
}

async function updateSiteConfig(configId, { name, siteId, deviceType, ...rest }) {
    return ymcs.patch(`/v2/dm/siteConfigs/${configId}`, { name, siteId, deviceType, ...rest });
}

async function deleteSiteConfigs(configIds) {
    return ymcs.post('/v2/dm/delSiteConfigs', { configIds });
}

async function pushSiteConfig(configId) {
    return ymcs.post(`/v2/dm/siteConfigs/${configId}/push`);
}

// --- Group Configs ---

async function listGroupConfigs({ limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listGroupConfigs', { limit });
}

async function getGroupConfig(configId) {
    return ymcs.get(`/v2/dm/groupConfigs/${configId}`);
}

async function createGroupConfig({ name, deviceGroupId, deviceType, ...rest }) {
    return ymcs.post('/v2/dm/groupConfigs', { name, deviceGroupId, deviceType, ...rest });
}

async function updateGroupConfig(configId, { name, deviceGroupId, deviceType, ...rest }) {
    return ymcs.patch(`/v2/dm/groupConfigs/${configId}`, { name, deviceGroupId, deviceType, ...rest });
}

async function deleteGroupConfigs(configIds) {
    return ymcs.post('/v2/dm/delGroupConfigs', { configIds });
}

async function pushGroupConfig(configId) {
    return ymcs.post(`/v2/dm/groupConfigs/${configId}/push`);
}

export {
    listDeviceConfigs, getDeviceConfig, createDeviceConfig, updateDeviceConfig, deleteDeviceConfigs, pushDeviceConfig,
    listSiteConfigs, getSiteConfig, createSiteConfig, updateSiteConfig, deleteSiteConfigs, pushSiteConfig,
    listGroupConfigs, getGroupConfig, createGroupConfig, updateGroupConfig, deleteGroupConfigs, pushGroupConfig,
};
