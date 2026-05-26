import { onLogEvent, onEslReconnect, getConnection } from './connection.js';

const SIP_PACKET_RE = /^(send|recv)\s+(\d+)\s+bytes\s+(from|to)\s+(\S+)\s+at\s+(\S+):/;
const DIVIDER_RE = /^-{20,}$/m;

function enableSipTrace() {
    const conn = getConnection();
    if (!conn) return;
    conn.api('sofia profile internal siptrace on', (res) => {
        console.log('[FS-SIP] siptrace:', (res.getBody() || '').trim());
    });
}

setTimeout(enableSipTrace, 3000);
onEslReconnect(() => setTimeout(enableSipTrace, 2000));

onLogEvent((event) => {
    const rawBody = (event.getBody() || '');
    if (!rawBody) return;

    const headerMatch = rawBody.match(SIP_PACKET_RE);
    if (!headerMatch) return;

    const direction = headerMatch[1];
    const bytes = parseInt(headerMatch[2]);
    const transport = headerMatch[4];
    const fsTime = headerMatch[5];

    // SIP message is everything after the divider line
    const parts = rawBody.split(DIVIDER_RE);
    const sipText = (parts[1] || '').trim();
    if (!sipText) return;

    const lines = sipText.split('\n');
    const firstLine = lines[0] || '';

    let method = '';
    const reqMatch = firstLine.match(/^(INVITE|ACK|BYE|CANCEL|REGISTER|OPTIONS|NOTIFY|SUBSCRIBE|MESSAGE|INFO|UPDATE|REFER|PRACK|PUBLISH)\s/);
    const resMatch = firstLine.match(/^SIP\/2\.0\s+(\d+\s+.+)/);
    if (reqMatch) method = reqMatch[1];
    else if (resMatch) method = resMatch[1].trim();

    let from = '', to = '', callId = '';
    for (const line of lines) {
        if (!from && /^From:/i.test(line)) from = line.replace(/^From:\s*/i, '').trim();
        if (!to && /^To:/i.test(line)) to = line.replace(/^To:\s*/i, '').trim();
        if (!callId && /^Call-ID:/i.test(line)) callId = line.replace(/^Call-ID:\s*/i, '').trim();
        if (from && to && callId) break;
    }

    const entry = {
        type: 'fs_log',
        subtype: 'sip_packet',
        timestamp: new Date().toISOString(),
        direction,
        bytes,
        transport,
        fsTime,
        method,
        from,
        to,
        callId,
        message: sipText,
    };

    if (global.db?.eventEmitter) {
        global.db.eventEmitter.emit('FS_LOG', entry);
    }
});
