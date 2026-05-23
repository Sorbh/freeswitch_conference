import { onCustomEvent } from './connection.js';

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass === 'sofia::register') _handleRegistration(event);
    else if (subclass === 'sofia::expire') _handleExpire(event);
});

async function _handleRegistration(event) {
    const fromUser = event.getHeader('from-user');
    const fromHost = event.getHeader('from-host');
    const contact = event.getHeader('contact');
    const networkIp = event.getHeader('network-ip');
    const networkPort = event.getHeader('network-port');
    const userAgent = event.getHeader('user-agent') || '';

    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    let email = fromUser.includes('.at.') ? fromUser.replace('.at.', '@') : (isIp ? fromUser : `${fromUser}@${fromHost}`);

    const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
    const macMatch = userAgent.match(macRegex);
    const mac = macMatch ? macMatch[0].toLowerCase() : null;

    const userName = `sip:${email}`;
    console.log('');
    console.log(`[REG] ${email} | MAC: ${mac || 'none'} | IP: ${networkIp}:${networkPort} | UA: ${userAgent.split(' ')[0] || 'unknown'}`);

    const existingUser = global.db.getUserInfo(userName);

    if (Object.keys(existingUser).length > 0) {
        existingUser.contact = contact;
        existingUser.ip = networkIp;
        existingUser.port = parseInt(networkPort);
        existingUser.online = true;
        existingUser.userAgent = userAgent;
        if (mac) existingUser.mac = mac;
        global.db.setUserInfo(userName, existingUser);
        global.db.logEvent('registration', userName, null, 'User registered');
        global.db.logOnlineStatus(userName, 'online');

        ensureInConference(userName);
        return;
    }

    const account = global.db.getAccountByEmail(email);
    if (!account || !account.active) {
        console.log(`[REG] REJECTED ${email} — no active account`);
        return;
    }

    const room = account.room || 123456701;
    const userInfo = {
        userId: account.id,
        contact: contact,
        mac: mac,
        ip: networkIp,
        port: parseInt(networkPort),
        room: room,
        connectionState: 'ideal',
        authState: 'logout',
        mute: true,
        online: true,
        payment: false,
        userAgent: userAgent,
        callerIdName: `${account.company_name || ''} / ${account.display_name || email}`,
    };

    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('registration', userName, null, 'User registered');
    global.db.logOnlineStatus(userName, 'online');
    console.log(`[REG] NEW ${email} -> ${global.config.ROOM_NAME[room] || room}`);

    ensureInConference(userName);
}

async function _handleExpire(event) {
    const fromUser = event.getHeader('from-user');
    const fromHost = event.getHeader('from-host');
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fromHost);
    const email = isIp ? fromUser : `${fromUser}@${fromHost}`;
    const userName = `sip:${email}`;

    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;

    console.log(`[REG] EXPIRED ${email}`);
    userInfo.online = false;
    global.db.setUserInfo(userName, userInfo);
    global.db.logEvent('offline', userName, null, 'Registration expired');
    global.db.logOnlineStatus(userName, 'offline');
}

export function ensureInConference(userName) {
    const userInfo = global.db.getUserInfo(userName);
    if (Object.keys(userInfo).length === 0) return;
    if (!userInfo.online) return;
    if (userInfo.connectionState === 'connected' || userInfo.connectionState === 'connecting') return;

    console.log(`[CALL] AUTO-JOIN ${userName} (was ${userInfo.connectionState})`);
    const service = global.callService;
    if (service) service.thirdPartyCallControl(userName);
}
