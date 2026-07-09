import https from 'https';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'public', 'email');

function _sendgrid({ apiKey, to, from, fromName, subject, text, html }) {
    return new Promise((resolve, reject) => {
        const content = [];
        if (text) content.push({ type: 'text/plain', value: text });
        if (html) content.push({ type: 'text/html', value: html });
        if (!content.length) content.push({ type: 'text/plain', value: '' });

        const payload = JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from, name: fromName },
            subject,
            content,
        });

        const req = https.request({
            hostname: 'api.sendgrid.com',
            path: '/v3/mail/send',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body });
                } else {
                    reject(new Error(`SendGrid ${res.statusCode}: ${body || res.statusMessage}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(new Error('SendGrid request timeout')); });
        req.write(payload);
        req.end();
    });
}

export async function sendMail({ to, subject, text, html }) {
    const config = global.config || {};
    const apiKey = config.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured');

    const from = config.SENDGRID_FROM_EMAIL || 'hotlinehq@redlineusedautoparts.com';
    const fromName = config.SENDGRID_FROM_NAME || 'Hotline HQ';
    const recipient = String(to || '').trim();
    if (!recipient) throw new Error('Email recipient is required');

    await _sendgrid({ apiKey, to: recipient, from, fromName, subject, text, html });
}

export async function sendVerificationEmail({ email, token, displayName, roomName }) {
    const config = global.config || {};
    const baseUrl = config.CLIENT_APP_URL || 'https://hotlinehq.online';
    const verifyUrl = `${baseUrl}/api/v1/client/verify?token=${encodeURIComponent(token)}`;
    const name = displayName || 'there';
    const room = roomName || 'your regional room';

    const vars = { '{{NAME}}': name, '{{ROOM}}': room, '{{VERIFY_URL}}': verifyUrl };

    let html;
    try {
        let tpl = readFileSync(join(__dirname, '..', 'public', 'email_template', 'verify.html'), 'utf8');
        for (const [key, val] of Object.entries(vars)) {
            tpl = tpl.replaceAll(key, val);
        }
        html = tpl;
    } catch (err) {
        console.error('[EMAIL] Failed to load verify template:', err.message);
    }

    const text = [
        `Hi ${name},`,
        '',
        'Welcome to Hotline HQ! Please verify your email address by clicking the link below:',
        '',
        verifyUrl,
        '',
        'What happens next:',
        '1. Verify your email (click above)',
        '2. Log in to your dashboard',
        `3. Start hearing live parts calls in ${room}`,
        '',
        'This link expires in 24 hours.',
        '',
        'If you did not create this account, please ignore this email.',
        '',
        '— Hotline HQ',
    ].join('\n');

    await sendMail({
        to: email,
        subject: `Verify your email — ${room} is waiting`,
        text,
        html,
    });
}

export async function sendWelcomeEmail({ email, displayName, companyName, roomName }) {
    const config = global.config || {};
    const baseUrl = config.CLIENT_APP_URL || 'https://hotlinehq.online';
    const dashboardUrl = `${baseUrl}/client/dashboard`;
    const name = displayName || companyName || 'there';
    const room = roomName || 'your room';

    const vars = {
        '{{NAME}}': name,
        '{{COMPANY}}': companyName || '-',
        '{{ROOM}}': room,
        '{{EMAIL}}': email,
        '{{DASHBOARD_URL}}': dashboardUrl,
        '{{UNSUBSCRIBE_URL}}': `${baseUrl}/client/dashboard/settings`,
    };

    let html;
    try {
        let tpl = readFileSync(join(__dirname, '..', 'public', 'email_template', 'welcome.html'), 'utf8');
        for (const [key, val] of Object.entries(vars)) {
            tpl = tpl.replaceAll(key, val);
        }
        html = tpl;
    } catch (err) {
        console.error('[EMAIL] Failed to load welcome template:', err.message);
    }

    const text = [
        `Welcome, ${name}!`,
        '',
        'Your email is verified and your Hotline HQ account is active.',
        '',
        `Company: ${companyName || '-'}`,
        `Room: ${room}`,
        '',
        'Open your dashboard: ' + dashboardUrl,
        '',
        'Getting started:',
        '1. Log in — your browser connects to the room automatically',
        '2. Need a part? Click the mic and say year, make, model, part',
        '3. Got a part someone needs? Click the mic and answer back',
        '4. Request a 3-digit extension for private yard-to-yard calls',
        '',
        '— Hotline HQ',
    ].join('\n');

    await sendMail({
        to: email,
        subject: `Welcome to Hotline HQ — you're in the ${room} room`,
        text,
        html,
    });
}

export async function sendPasswordResetEmail({ email, token, displayName }) {
    const config = global.config || {};
    const baseUrl = config.CLIENT_APP_URL || 'https://hotlinehq.online';
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
