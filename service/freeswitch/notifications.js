// Yealink XML notifications via SIP NOTIFY. Sends screen messages,
// execute commands, and action URIs to Yealink phones through FreeSWITCH.
import { getConnection } from './connection.js';

function _extractUserFromContact(contact) {
    const match = contact.match(/sip:([^@>]+@[^>;]+)/);
    return match ? match[1] : contact;
}

export function showMessage(contacts, message, timeout = 5) {
    if (!Array.isArray(contacts)) contacts = [contacts];

    const xmlBody = `<YealinkIPPhoneTextScreen Timeout="${timeout}" LockIn="yes" Beep="yes"><Title>Redline</Title><Text>${message}</Text></YealinkIPPhoneTextScreen>`;
    const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';

    for (const contact of contacts) {
        if (!contact) continue;
        const user = _extractUserFromContact(contact);
        if (!user) continue;
        getConnection().api(`sofia profile ${profile} notify ${user} event=Yealink-xml content-type=application/xml body='${xmlBody}'`, () => {
            console.log(`[NOTIFY] showMessage -> ${user}`);
        });
    }

    global.db?.eventEmitter?.emit('USER_UPDATE', { type: 'message', message, contacts });
}

export function sendCommands(contacts, commands) {
    if (!Array.isArray(contacts)) contacts = [contacts];

    const items = (Array.isArray(commands) ? commands : [commands])
        .map(cmd => `<ExecuteItem URI="${cmd}"/>`)
        .join('');
    const xmlBody = `<YealinkIPPhoneExecute Beep="yes">${items}</YealinkIPPhoneExecute>`;
    const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';

    for (const contact of contacts) {
        if (!contact) continue;
        const user = _extractUserFromContact(contact);
        if (!user) continue;
        getConnection().api(`sofia profile ${profile} notify ${user} event=Yealink-xml content-type=application/xml body='${xmlBody}'`, () => {
            console.log(`[NOTIFY] sendCommands -> ${user}`);
        });
    }

    global.db?.eventEmitter?.emit('USER_UPDATE', { type: 'commands', commands, contacts });
}

export function sendActionUri(contacts, actionUri) {
    if (!Array.isArray(contacts)) contacts = [contacts];
    const profile = global.config.FREESWITCH_SOFIA_PROFILE || 'internal';

    for (const contact of contacts) {
        if (!contact) continue;
        const user = _extractUserFromContact(contact);
        if (!user) continue;
        getConnection().api(`sofia profile ${profile} notify ${user} event=ACTION-URI content-type=message/sipfrag body='${actionUri}'`, () => {
            console.log(`[NOTIFY] sendActionUri -> ${user}`);
        });
    }
}
