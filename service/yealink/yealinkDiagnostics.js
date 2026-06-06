import { ymcs } from './yealinkApi.js';

async function getDiagnosisStatus(diagnosisId) {
    return ymcs.get(`/v2/dm/diagnosis/${diagnosisId}/status`);
}

async function getNetworkInterfaces(deviceId) {
    return ymcs.get(`/v2/dm/devices/${deviceId}/networkInterfaces`);
}

async function startPacketCapture(deviceId, options = {}) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/startPacketCapture`, options);
}

async function stopPacketCapture(deviceId, diagnosisId) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/stopPacketCapture`, { diagnosisId });
}

async function captureScreenshot(deviceId) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/captureScreen`);
}

async function exportSyslog(deviceId) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/exportSyslog`);
}

async function exportConfig(deviceId) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/exportConfig`);
}

async function ping(deviceId, host, options = {}) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/ping`, { host, ...options });
}

async function traceroute(deviceId, host, options = {}) {
    return ymcs.put(`/v2/dm/devices/${deviceId}/traceroute`, { host, ...options });
}

export {
    getDiagnosisStatus,
    getNetworkInterfaces,
    startPacketCapture,
    stopPacketCapture,
    captureScreenshot,
    exportSyslog,
    exportConfig,
    ping,
    traceroute,
};
