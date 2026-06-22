import net from 'net';
import tls from 'tls';

function _bool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function _cleanHeader(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function _address(value) {
    return String(value || '').trim();
}

function _dotStuff(body) {
    return String(body || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function _makeClient(socket) {
    socket.setEncoding('utf8');
    let buffer = '';

    socket.on('data', chunk => {
        buffer += chunk;
    });

    function readResponse(timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                const match = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n)/);
                if (match) {
                    const end = match.index + match[0].length;
                    const text = buffer.slice(0, end);
                    buffer = buffer.slice(end);
                    clearInterval(timer);
                    resolve({ code: parseInt(match[1], 10), text });
                    return;
                }
                if (Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    reject(new Error('SMTP timeout'));
                }
            }, 20);
        });
    }

    async function command(line, expectedCodes) {
        socket.write(`${line}\r\n`);
        const response = await readResponse();
        if (expectedCodes && !expectedCodes.includes(response.code)) {
            throw new Error(`SMTP ${response.code}: ${response.text.trim()}`);
        }
        return response;
    }

    return {
        socket,
        readResponse,
        command,
        closeDataListeners: () => socket.removeAllListeners('data'),
    };
}

function _connect({ host, port, secure }) {
    return new Promise((resolve, reject) => {
        const socket = secure
            ? tls.connect({ host, port, servername: host })
            : net.connect({ host, port });
        socket.setTimeout(15000);
        socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket));
        socket.once('error', reject);
        socket.once('timeout', () => reject(new Error('SMTP connection timeout')));
    });
}

function _upgradeToTls(socket, host) {
    return new Promise((resolve, reject) => {
        const secureSocket = tls.connect({ socket, servername: host });
        secureSocket.setTimeout(15000);
        secureSocket.once('secureConnect', () => resolve(secureSocket));
        secureSocket.once('error', reject);
        secureSocket.once('timeout', () => reject(new Error('SMTP TLS timeout')));
    });
}

export async function sendMail({ to, subject, text }) {
    const config = global.config || {};
    const host = config.SMTP_HOST;
    if (!host) throw new Error('SMTP is not configured');

    const secure = _bool(config.SMTP_SECURE, false);
    const starttls = _bool(config.SMTP_STARTTLS, !secure);
    const port = parseInt(config.SMTP_PORT, 10) || (secure ? 465 : 587);
    const user = config.SMTP_USER;
    const pass = config.SMTP_PASS;
    const fromEmail = _address(config.SMTP_FROM_EMAIL || user);
    const fromName = _cleanHeader(config.SMTP_FROM_NAME || 'Redline Hotline');
    const recipient = _address(to);

    if (!fromEmail) throw new Error('SMTP sender email is not configured');
    if (!recipient) throw new Error('Email recipient is not configured');
    if (user && !pass) throw new Error('SMTP password is not configured');

    let client;
    try {
        let socket = await _connect({ host, port, secure });
        client = _makeClient(socket);
        await client.readResponse();

        let ehlo = await client.command(`EHLO ${config.SMTP_HELO_NAME || 'hotline.redlineusedautoparts.com'}`, [250]);
        if (!secure && starttls && /STARTTLS/i.test(ehlo.text)) {
            await client.command('STARTTLS', [220]);
            client.closeDataListeners();
            socket = await _upgradeToTls(client.socket, host);
            client = _makeClient(socket);
            await client.command(`EHLO ${config.SMTP_HELO_NAME || 'hotline.redlineusedautoparts.com'}`, [250]);
        }

        if (user && pass) {
            await client.command('AUTH LOGIN', [334]);
            await client.command(Buffer.from(user).toString('base64'), [334]);
            await client.command(Buffer.from(pass).toString('base64'), [235]);
        }

        await client.command(`MAIL FROM:<${fromEmail}>`, [250]);
        await client.command(`RCPT TO:<${recipient}>`, [250, 251]);
        await client.command('DATA', [354]);

        const safeSubject = _cleanHeader(subject);
        const headers = [
            `From: ${fromName} <${fromEmail}>`,
            `To: ${recipient}`,
            `Subject: ${safeSubject}`,
            `Date: ${new Date().toUTCString()}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ].join('\r\n');

        client.socket.write(`${headers}\r\n\r\n${_dotStuff(text)}\r\n.\r\n`);
        const dataResponse = await client.readResponse();
        if (![250].includes(dataResponse.code)) {
            throw new Error(`SMTP ${dataResponse.code}: ${dataResponse.text.trim()}`);
        }

        await client.command('QUIT', [221]).catch(() => {});
    } finally {
        if (client?.socket && !client.socket.destroyed) client.socket.end();
    }
}

export async function sendVerificationEmail({ email, token, displayName }) {
    const config = global.config || {};
    const baseUrl = config.CLIENT_APP_URL || 'https://hotline.redlineusedautoparts.com';
    const verifyUrl = `${baseUrl}/api/v1/client/verify?token=${encodeURIComponent(token)}`;

    const lines = [
        `Hi ${displayName || 'there'},`,
        '',
        'Welcome to Hotline HQ! Please verify your email address by clicking the link below:',
        '',
        verifyUrl,
        '',
        'This link expires in 24 hours.',
        '',
        'If you did not create this account, please ignore this email.',
        '',
        '— Hotline HQ',
    ];

    await sendMail({
        to: email,
        subject: 'Verify your Hotline HQ account',
        text: lines.join('\n'),
    });
}

export async function sendPasswordResetEmail({ email, token, displayName }) {
    const config = global.config || {};
    const baseUrl = config.CLIENT_APP_URL || 'https://hotline.redlineusedautoparts.com';
    const resetUrl = `${baseUrl}/client/reset-password?token=${encodeURIComponent(token)}`;

    const lines = [
        `Hi ${displayName || 'there'},`,
        '',
        'We received a request to reset your Hotline HQ password. Click the link below:',
        '',
        resetUrl,
        '',
        'This link expires in 1 hour.',
        '',
        'If you did not request a password reset, please ignore this email.',
        '',
        '— Hotline HQ',
    ];

    await sendMail({
        to: email,
        subject: 'Reset your Hotline HQ password',
        text: lines.join('\n'),
    });
}

export async function sendNewSignupNotification({ email, companyName, displayName, room, roomName, zip }) {
    const config = global.config || {};
    const to = config.EXTENSION_REQUEST_TO_EMAIL;
    if (!to) return;

    const lines = [
        'New client signup on Hotline HQ',
        '',
        `Email: ${email}`,
        `Company: ${companyName || '-'}`,
        `Owner: ${displayName || '-'}`,
        `Zip: ${zip || '-'}`,
        `Room: ${roomName || room || '-'}`,
        `Time: ${new Date().toISOString()}`,
    ];

    await sendMail({
        to,
        subject: `New signup: ${companyName || email}`,
        text: lines.join('\n'),
    }).catch(err => {
        console.error('[EMAIL] Signup notification failed:', err.message);
    });
}

export async function sendExtensionRequestEmail(payload) {
    const config = global.config || {};
    const to = config.EXTENSION_REQUEST_TO_EMAIL;
    if (!to) throw new Error('Extension request recipient email is not configured');

    const lines = [
        'New extension request',
        '',
        `Requested extension: *${payload.requestedExtension}`,
        `Requester email: ${payload.email}`,
        `Current extension: ${payload.currentExtension ? `*${payload.currentExtension}` : 'none'}`,
        `Company: ${payload.companyName || '-'}`,
        `Name: ${payload.displayName || '-'}`,
        `Room: ${payload.roomName || payload.room || '-'}`,
        `IP: ${payload.ip || '-'}`,
        `Time: ${new Date().toISOString()}`,
    ];

    await sendMail({
        to,
        subject: `Extension request: ${payload.email} wants *${payload.requestedExtension}`,
        text: lines.join('\n'),
    });
}

export async function sendRoomRequestEmail(payload) {
    const config = global.config || {};
    const to = config.ROOM_REQUEST_TO_EMAIL || config.EXTENSION_REQUEST_TO_EMAIL;
    if (!to) throw new Error('Room request recipient email is not configured');

    const requestedLocation = [
        payload.requestedRoom,
        payload.requestedState,
    ].filter(Boolean).join(', ');

    const lines = [
        'New room request',
        '',
        `Requested room: ${requestedLocation || '-'}`,
        `Message: ${payload.message || '-'}`,
        '',
        `Requester email: ${payload.email}`,
        `Company: ${payload.companyName || '-'}`,
        `Name: ${payload.displayName || '-'}`,
        `Current room: ${payload.currentRoomName || payload.currentRoom || '-'}`,
        `IP: ${payload.ip || '-'}`,
        `Time: ${new Date().toISOString()}`,
    ];

    await sendMail({
        to,
        subject: `Room request: ${payload.email} wants ${requestedLocation || 'a new room'}`,
        text: lines.join('\n'),
    });
}
