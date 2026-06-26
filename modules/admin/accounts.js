import express from "express";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { invalidateDebugCache, logUser } from "../../service/logger.js";
import { emitStateChange } from "./routesApi.js";

const router = express.Router();

async function registerOnYmcs({ email, mac, sn, roomId, companyName, displayName }) {
    const roomData = global.db.getRoom(roomId);
    const siteId = roomData.ymcs_site_id;
    const groupId = roomData?.ymcs_group_id || null;
    const shortCode = roomData?.short_code || '';
    const displayLabel = `${companyName || ''} ${shortCode} / ${displayName || email}`.trim();
    const sipPassword = process.env.SIP_DEFAULT_PASSWORD || '12345678';
    const sipHost = process.env.FREESWITCH_PUBLIC_IP || '50.28.84.57';
    const sipPort = parseInt(process.env.SIP_PORT || '5070');

    const { createAccount: createYmcsAccount, bindAccounts, listAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");
    const { createDevice, listDevices, updateDevice } = await import("../../service/yealink/yealinkDevices.js");
    const { addDevicesToGroup } = await import("../../service/yealink/yealinkGroups.js");

    // 1. Create or find SIP account
    let ymcsAccountId;
    try {
        const ymcsAccount = await createYmcsAccount({
            registerName: email,
            username: email,
            password: sipPassword,
            sipServer1Host: sipHost,
            sipServer1Port: sipPort,
            displayName: displayLabel,
            label: 'REDLINE',
            ...(siteId ? { siteId } : {}),
        });
        ymcsAccountId = ymcsAccount.id;
    } catch (accErr) {
        const accErrMsg = accErr.response?.message || accErr.message || '';
        if (accErrMsg.includes('already exists') || accErrMsg.includes('Resource already exists')) {
            const existing = await listAccounts({ filter: { username: email }, limit: 1 });
            const found = existing?.data?.[0] || existing?.items?.[0];
            if (!found) throw new Error(`SIP account for ${email} exists in YMCS but could not be found`);
            ymcsAccountId = found.id;
            logUser(email, 'API', `YMCS-REGISTER reusing existing SIP account ${ymcsAccountId}`);
        } else {
            throw accErr;
        }
    }

    // 2. Create or find device
    const cleanMac = mac.replace(/[:-]/g, '');
    let ymcsDeviceId;
    try {
        const ymcsDevice = await createDevice({
            mac: cleanMac,
            sn,
            name: displayLabel,
            deviceType: 1,
            modelId: '02c47b640c3046dc86853c9ccfd37dd0',
            ...(siteId ? { siteId } : {}),
        });
        ymcsDeviceId = ymcsDevice.id;
    } catch (devErr) {
        const devErrMsg = devErr.response?.message || devErr.message || '';
        if (devErrMsg.includes('MAC has been added') || devErrMsg.includes('already exists')) {
            const existing = await listDevices({ filter: { mac: cleanMac }, limit: 1 });
            const found = existing?.data?.[0];
            if (!found) throw new Error(`MAC ${cleanMac} exists in YMCS but could not be found`);
            ymcsDeviceId = found.id;
            await updateDevice(ymcsDeviceId, { name: displayLabel });
            logUser(email, 'API', `YMCS-REGISTER reusing existing device ${ymcsDeviceId} for MAC ${cleanMac}, updated name`);
        } else {
            throw devErr;
        }
    }

    // 3. Bind device to SIP account
    await bindAccounts(ymcsDeviceId, [{ lineId: 1, accountType: 0, accountId: ymcsAccountId }]);

    // 4. Add device to group
    if (groupId) {
        await addDevicesToGroup(groupId, [ymcsDeviceId]);
    }

    return { ymcs_account_id: ymcsAccountId, ymcs_device_id: ymcsDeviceId, sip_server_host: sipHost, sip_server_port: String(sipPort) };
}

// --- Accounts CRUD ---

// GET /accounts — list all accounts
router.get("/accounts", (req, res) => {
    try {
        const accounts = global.db.getAllAccounts();
        const safe = accounts.map(({ password, ...rest }) => {
            rest.referral_count = global.db.getReferralCount(rest.id);
            if (rest.referred_by) {
                const referrer = global.db.getAccountById(rest.referred_by);
                rest.referred_by_name = referrer ? (referrer.company_name || referrer.email) : null;
            }
            return rest;
        });
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /accounts/:id — single account
router.get("/accounts/:id", (req, res) => {
    try {
        const account = global.db.getAccountById(parseInt(req.params.id));
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        const { password, ...safe } = account;
        res.json({ status: true, data: safe });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts — create account
router.post("/accounts", async (req, res) => {
    try {
        logUser(req.body.email, 'API', 'CREATE-ACCOUNT');
        const { email, password, display_name, company_name, company_phone, company_address, city, state, zip, room, extension, register_ymcs, mac, sn } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: false, error: "Email and password are required" });
        }

        const existing = global.db.getAccountByEmail(email);
        if (existing) {
            return res.status(409).json({ status: false, error: "Account with this email already exists" });
        }

        if (extension) {
            const extOwner = global.db.getAccountByExtension(parseInt(extension));
            if (extOwner) {
                return res.status(409).json({ status: false, error: `Extension *${extension} is already assigned to ${extOwner.email}` });
            }
        }

        if (register_ymcs && (!mac || !sn)) {
            return res.status(400).json({ status: false, error: "MAC address and Serial Number are required for YMCS registration" });
        }

        const roomId = room ? parseInt(room) : null;

        if (register_ymcs) {
            const roomData = roomId ? global.db.getRoom(roomId) : null;
            if (!roomData?.ymcs_site_id) {
                return res.status(400).json({ status: false, error: `Room "${roomData?.name || roomId || 'none'}" has no YMCS Site ID — sync room sites first` });
            }
        }

        const account = global.db.createAccount({
            email,
            password,
            displayName: display_name,
            companyName: company_name,
            companyAddress: company_address,
            companyPhone: company_phone,
            city,
            state,
            zip,
            room: roomId,
            extension: extension ? parseInt(extension) : null,
        });

        const sipUser = `sip:${email}`;
        const existingUser = global.db.getUserInfo(sipUser);
        if (!existingUser || Object.keys(existingUser).length === 0) {
            global.db.setUserInfo(sipUser, {
                callerIdName: display_name || email,
                room: roomId,
                connectionState: 'ideal',
                authState: 'logout',
                mute: true,
                online: false,
                payment: false,
                retryCount: 0,
            });
        }

        let ymcsResult = null;
        if (register_ymcs) {
            try {
                const result = await registerOnYmcs({ email, mac, sn, roomId, companyName: company_name, displayName: display_name });
                global.db.updateAccount(account.id, result);
                ymcsResult = { ymcs_account_id: result.ymcs_account_id, ymcs_device_id: result.ymcs_device_id };
                logUser(email, 'API', `YMCS-REGISTER account=${result.ymcs_account_id} device=${result.ymcs_device_id}`);
            } catch (ymcsErr) {
                console.error('[YMCS-REGISTER]', ymcsErr.message, ymcsErr.response ? JSON.stringify(ymcsErr.response) : '');
                ymcsResult = { error: ymcsErr.message };
            }
        }

        const { password: _, ...safe } = global.db.getAccountById(account.id);
        global.db.logEvent('account_created', email, null, `Account created for ${company_name || email}`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.status(201).json({ status: true, data: safe, ymcs: ymcsResult });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// PUT /accounts/:id — update account
router.put("/accounts/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        logUser(account.email || `account:${id}`, 'API', 'UPDATE-ACCOUNT');

        const fields = {};
        const allowed = ['email', 'password', 'display_name', 'company_name', 'company_phone', 'company_address', 'city', 'state', 'zip', 'room', 'active', 'kickout', 'debug', 'extension'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'room' || key === 'extension') fields[key] = req.body[key] != null ? parseInt(req.body[key]) : null;
                else fields[key] = req.body[key];
            }
        }

        if (fields.extension != null) {
            const extOwner = global.db.getAccountByExtension(fields.extension);
            if (extOwner && extOwner.id !== id) {
                return res.status(409).json({ status: false, error: `Extension *${fields.extension} is already assigned to ${extOwner.email}` });
            }
        }

        const updated = global.db.updateAccount(id, fields);
        if (!updated) return res.status(400).json({ status: false, error: "No valid fields to update" });

        if (fields.debug !== undefined) invalidateDebugCache(account.email);

        if (fields.display_name !== undefined || fields.company_name !== undefined || fields.room !== undefined) {
            const userName = `sip:${account.email}`;
            const userInfo = global.db.getUserInfo(userName);
            if (userInfo && Object.keys(userInfo).length > 0) {
                if (fields.room !== undefined) userInfo.room = fields.room;
                if (fields.display_name !== undefined || fields.company_name !== undefined) {
                    const co = fields.company_name !== undefined ? fields.company_name : account.company_name;
                    const dn = fields.display_name !== undefined ? fields.display_name : account.display_name;
                    userInfo.callerIdName = `${co || ''} / ${dn || account.email}`;
                }
                global.db.setUserInfo(userName, userInfo);
            }
        }

        // Disconnect call when deactivating or kicking out
        if (fields.active === 0 || fields.active === false || fields.kickout === 1 || fields.kickout === true) {
            const userName = `sip:${account.email}`;
            const userInfo = global.db.getUserInfo(userName);
            if (userInfo && Object.keys(userInfo).length > 0) {
                const savedUuid = userInfo.fsChannelUUID;
                const reason = fields.kickout ? 'kickout' : 'deactivation';

                // Update DB BEFORE killing call — prevents _onCallHangup from reconnecting
                userInfo.connectionState = 'hangup';
                userInfo.fsChannelUUID = null;
                userInfo.fsMemberId = null;
                userInfo.lastConnectionStateUpdate = Math.floor(Date.now() / 1000);
                global.db.setUserInfo(userName, userInfo);
                global.db.logEvent(reason, userName, userInfo.room, `Disconnected on account ${reason}`);

                if (savedUuid) {
                    getConnectionHandlers().delete(savedUuid);
                    try {
                        await global.freeswitch.hangupCall(savedUuid, userName);
                    } catch (hangupErr) {
                        console.error(`Failed to hangup call for ${userName}:`, hangupErr.message);
                    }
                }
            }
        }

        let ymcsResult = null;
        const { register_ymcs, mac, sn } = req.body;
        if (register_ymcs) {
            if (!mac || !sn) {
                return res.status(400).json({ status: false, error: "MAC address and Serial Number are required for YMCS registration" });
            }
            const ymcsRoomId = fields.room !== undefined ? fields.room : account.room;
            const ymcsRoomData = ymcsRoomId ? global.db.getRoom(ymcsRoomId) : null;
            if (!ymcsRoomData?.ymcs_site_id) {
                return res.status(400).json({ status: false, error: `Room "${ymcsRoomData?.name || ymcsRoomId || 'none'}" has no YMCS Site ID — sync room sites first` });
            }
            try {
                const result = await registerOnYmcs({
                    email: account.email,
                    mac, sn,
                    roomId: ymcsRoomId,
                    companyName: fields.company_name ?? account.company_name,
                    displayName: fields.display_name ?? account.display_name,
                });
                global.db.updateAccount(id, result);
                ymcsResult = { ymcs_account_id: result.ymcs_account_id, ymcs_device_id: result.ymcs_device_id };
                logUser(account.email, 'API', `YMCS-REGISTER account=${result.ymcs_account_id} device=${result.ymcs_device_id}`);
            } catch (ymcsErr) {
                console.error('[YMCS-REGISTER]', ymcsErr.message, ymcsErr.response ? JSON.stringify(ymcsErr.response) : '');
                ymcsResult = { error: ymcsErr.message };
            }
        }

        const refreshed = global.db.getAccountById(id);
        const { password, ...safe } = refreshed;
        global.db.logEvent('account_updated', account.email, null, `Account ${fields.active === 0 || fields.active === false ? 'deactivated' : 'updated'}`);
        emitStateChange('users', { userName: account.email });
        emitStateChange('dashboard');
        res.json({ status: true, data: safe, ymcs: ymcsResult });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// DELETE /accounts/:id — delete account
router.delete("/accounts/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        logUser(account.email || `account:${id}`, 'API', 'DELETE-ACCOUNT');

        const userName = `sip:${account.email}`;
        const userInfo = global.db.getUserInfo(userName);
        if (Object.keys(userInfo).length > 0) {
            if (userInfo.fsChannelUUID) {
                try { await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName); } catch (_) { }
            }
            global.db.deleteUserInfo(userName);
        }

        global.db.deleteAccount(id);
        global.db.logEvent('account_deleted', account.email, null, `Account deleted`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.json({ status: true, message: `Account ${account.email} deleted` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/refresh-account-id — fetch ymcs_account_id from YMCS API
router.post("/accounts/:id/refresh-account-id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const { listAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");
        const result = await listAccounts({ filter: { username: account.email }, limit: 1 });
        const items = result?.items || result?.data || [];
        if (!items.length) {
            return res.status(404).json({ status: false, error: "Account not found in YMCS" });
        }

        const ymcsAccountId = String(items[0].id);
        global.db.updateAccount(id, { ymcs_account_id: ymcsAccountId });

        logUser(account.email || `account:${id}`, 'API', `REFRESH-ACCOUNT-ID → ${ymcsAccountId}`);
        res.json({ status: true, ymcs_account_id: ymcsAccountId });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/refresh-device-id — find ymcs device ID by MAC from user info
router.post("/accounts/:id/refresh-device-id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });

        const userName = `sip:${account.email}`;
        const userInfo = global.db.getUserInfo(userName);
        const mac = userInfo?.mac?.replace(/[:-]/g, '');
        if (!mac) {
            return res.status(400).json({ status: false, error: "No MAC address — device must register first" });
        }

        const { listDevices } = await import("../../service/yealink/yealinkDevices.js");
        const result = await listDevices({ filter: { mac }, limit: 1 });
        const device = result?.data?.[0];
        if (!device) {
            return res.status(404).json({ status: false, error: `No device found for MAC ${mac}` });
        }

        global.db.updateAccount(id, { ymcs_device_id: device.id });
        logUser(account.email || `account:${id}`, 'API', `REFRESH-DEVICE-ID → ${device.id} (MAC: ${mac})`);
        res.json({ status: true, ymcs_device_id: device.id });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/reboot — reboot the device bound to this account
router.post("/accounts/:id/ymcs/reboot", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { rebootDevices } = await import("../../service/yealink/yealinkDevices.js");
        const result = await rebootDevices([account.ymcs_device_id], 1);

        logUser(account.email || `account:${id}`, 'API', `REBOOT device ${account.ymcs_device_id}`);
        res.json({ status: true, result });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// GET /accounts/:id/ymcs/device-config — fetch existing device config from YMCS
router.get("/accounts/:id/ymcs/device-config", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { ymcs } = await import("../../service/yealink/yealinkApi.js");
        let configId = account.ymcs_config_id;

        if (!configId) {
            const user = global.db.getUserInfo(`sip:${account.email}`);
            if (user?.mac) {
                const mac = user.mac.replace(/[:\-]/g, '');
                const result = await ymcs.post('/v2/dm/listDeviceConfigs', { filter: { mac }, limit: 1 });
                const configs = result?.data || [];
                if (configs.length > 0) {
                    configId = configs[0].id;
                    global.db.updateAccount(id, { ymcs_config_id: configId });
                }
            }
        }

        let content = "";
        if (configId) {
            const detail = await ymcs.get(`/v2/dm/deviceConfigs/${configId}`);
            content = detail?.content || "";
        }
        res.json({ status: true, content });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/push-config — push cfg content to this account's device
router.post("/accounts/:id/ymcs/push-config", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ status: false, error: "content is required" });

        const { ymcs } = await import("../../service/yealink/yealinkApi.js");

        if (account.ymcs_config_id) {
            await ymcs.post('/v2/dm/delDeviceConfigs', { configIds: [account.ymcs_config_id] });
        }

        const result = await ymcs.post('/v2/dm/deviceConfigs', {
            deviceId: account.ymcs_device_id,
            content: content.trim(),
            autoPush: true,
        });
        const newConfigId = result?.id || null;
        if (newConfigId) {
            await ymcs.post(`/v2/dm/deviceConfigs/${newConfigId}/push`);
            global.db.updateAccount(id, { ymcs_config_id: newConfigId });
        }

        logUser(account.email || `account:${id}`, 'API', `PUSH-CONFIG to device ${account.ymcs_device_id}`);
        res.json({ status: true, message: "Config pushed", ymcs_config_id: newConfigId });
    } catch (err) {
        console.error('[PUSH-CONFIG]', err.message, err.response ? JSON.stringify(err.response) : '');
        res.status(500).json({ status: false, error: err.message, detail: err.response || null });
    }
});

// POST /accounts/:id/ymcs/sync-config-id — look up device config via MAC and store config ID
router.post("/accounts/:id/ymcs/sync-config-id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const user = global.db.getUserInfo(`sip:${account.email}`);
        if (!user?.mac) return res.status(400).json({ status: false, error: "No MAC address" });

        const { ymcs } = await import("../../service/yealink/yealinkApi.js");
        const mac = user.mac.replace(/[:\-]/g, '');
        const result = await ymcs.post('/v2/dm/listDeviceConfigs', { filter: { mac }, limit: 1 });
        const configs = result?.data || [];

        if (configs.length === 0) return res.status(404).json({ status: false, error: "No config found" });

        global.db.updateAccount(id, { ymcs_config_id: configs[0].id });
        logUser(account.email || `account:${id}`, 'API', `SYNC-CONFIG-ID → ${configs[0].id}`);
        res.json({ status: true, ymcs_config_id: configs[0].id });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/update-sip-server — update SIP server on this account's YMCS SIP account
router.post("/accounts/:id/ymcs/update-sip-server", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_account_id) return res.status(400).json({ status: false, error: "No YMCS Account ID" });

        const { host, port } = req.body;
        if (!host || !port) return res.status(400).json({ status: false, error: "host and port required" });

        const { updateAccount: updateYmcsAccount } = await import("../../service/yealink/yealinkSipAccounts.js");
        const password = process.env.SIP_DEFAULT_PASSWORD || '12345678';

        await updateYmcsAccount(account.ymcs_account_id, {
            registerName: account.email,
            username: account.email,
            password,
            sipServer1: { host, port: parseInt(port) },
        });

        global.db.updateAccount(id, { sip_server_host: host, sip_server_port: parseInt(port) });
        logUser(account.email || `account:${id}`, 'API', `UPDATE-SIP-SERVER → ${host}:${port}`);
        res.json({ status: true, message: `Updated to ${host}:${port}` });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// POST /accounts/:id/ymcs/rebind — unbind+rebind account on device
router.post("/accounts/:id/ymcs/rebind", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const account = global.db.getAccountById(id);
        if (!account) return res.status(404).json({ status: false, error: "Account not found" });
        if (!account.ymcs_account_id) return res.status(400).json({ status: false, error: "No YMCS Account ID" });
        if (!account.ymcs_device_id) return res.status(400).json({ status: false, error: "No YMCS Device ID" });

        const { getBoundAccounts, unbindAccounts, bindAccounts } = await import("../../service/yealink/yealinkSipAccounts.js");

        const bound = await getBoundAccounts(account.ymcs_device_id);
        const boundList = Array.isArray(bound) ? bound : (bound?.data || []);

        if (boundList.length > 0) {
            await unbindAccounts(account.ymcs_device_id, boundList.map(a => a.accountId));
        }

        await bindAccounts(account.ymcs_device_id, [{ accountId: account.ymcs_account_id, lineId: 1, accountType: 0 }]);

        logUser(account.email || `account:${id}`, 'API', `REBIND ${account.display_name || account.email || account.ymcs_account_id} to device ${account.ymcs_device_id}`);
        res.json({ status: true, message: "Account rebound to device" });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

export default router;
