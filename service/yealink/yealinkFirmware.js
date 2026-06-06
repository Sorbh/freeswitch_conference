import { ymcs } from './yealinkApi.js';

async function listOfficialFirmwares({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listOfficalFirmwares', { filter, limit });
}

async function listCustomFirmwares({ filter = {}, limit = 100 } = {}) {
    return ymcs.post('/v2/dm/listFirmwares', { filter, limit });
}

async function pushFirmware(firmwareId, deviceIds, deviceType) {
    return ymcs.post(`/v2/dm/firmwares/${firmwareId}/push`, { deviceIds, deviceType });
}

async function pushOfficialFirmware(officalFirmwareId, deviceIds, deviceType) {
    return ymcs.post(`/v2/dm/officalFirmwares/${officalFirmwareId}/push`, { deviceIds, deviceType });
}

export { listOfficialFirmwares, listCustomFirmwares, pushFirmware, pushOfficialFirmware };
