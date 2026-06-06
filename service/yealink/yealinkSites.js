import { ymcs } from './yealinkApi.js';

async function listSites({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listSites', { filter, limit });
}

async function getSite(siteId) {
    return ymcs.get(`/v2/dm/sites/${siteId}`);
}

async function createSite({ name, parentId, description }) {
    return ymcs.post('/v2/dm/sites', { name, parentId, description });
}

async function updateSite(siteId, fields) {
    return ymcs.patch(`/v2/dm/sites/${siteId}`, fields);
}

async function deleteSite(siteId) {
    return ymcs.delete(`/v2/dm/sites/${siteId}`);
}

export { listSites, getSite, createSite, updateSite, deleteSite };
