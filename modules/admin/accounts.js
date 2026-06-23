import express from "express";
import { getConnectionHandlers } from "../../service/freeswitch/connection.js";
import { logUser, invalidateDebugCache } from "../../service/logger.js";
import { emitStateChange } from "./routesApi.js";

const router = express.Router();

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
router.post("/accounts", (req, res) => {
    try {
        logUser(req.body.email, 'API', 'CREATE-ACCOUNT');
        const { email, password, display_name, company_name, company_phone, company_address, city, state, zip, room, extension } = req.body;
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
            room: room ? parseInt(room) : null,
            extension: extension ? parseInt(extension) : null,
        });

        const sipUser = `sip:${email}`;
        const existingUser = global.db.getUserInfo(sipUser);
        if (!existingUser || Object.keys(existingUser).length === 0) {
            global.db.setUserInfo(sipUser, {
                callerIdName: display_name || email,
                room: room ? parseInt(room) : null,
                connectionState: 'ideal',
                authState: 'logout',
                mute: true,
                online: false,
                payment: false,
                retryCount: 0,
            });
        }

        const { password: _, ...safe } = account;
        global.db.logEvent('account_created', email, null, `Account created for ${company_name || email}`);
        emitStateChange('users');
        emitStateChange('dashboard');
        res.status(201).json({ status: true, data: safe });
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

        const { password, ...safe } = updated;
        global.db.logEvent('account_updated', account.email, null, `Account ${fields.active === 0 || fields.active === false ? 'deactivated' : 'updated'}`);
        emitStateChange('users', { userName: account.email });
        emitStateChange('dashboard');
        res.json({ status: true, data: safe });
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
                try { await global.freeswitch.hangupCall(userInfo.fsChannelUUID, userName); } catch (_) {}
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
