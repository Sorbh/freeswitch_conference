import fs from 'fs';
import fetch from 'node-fetch';
import { logSystem } from './logger.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

const DEFAULT_TEMPLATE = `LISTEN TO CONFIRM ACCURACY 👆🏻

{{company}} / {{name}}
is looking for a part

Call: {{phone}}

{{room}} | {{duration}}s | {{status}}`;

const TEMPLATE_VARS = {
    name: 'Display name',
    email: 'Email address',
    company: 'Company name',
    phone: 'Company phone',
    address: 'Company address',
    city: 'City',
    state: 'State',
    zip: 'Zip code',
    room: 'Room name',
    duration: 'Duration in seconds',
    status: 'Answered / UNANSWERED',
    respondedBy: 'Who responded',
    participants: 'Participant count',
    time: 'Timestamp',
};

function _buildCaption(template, vars) {
    let result = template || DEFAULT_TEMPLATE;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return result.replace(/\n{3,}/g, '\n\n').trim();
}

export { DEFAULT_TEMPLATE, TEMPLATE_VARS };

export async function notifyBroadcast(broadcastData) {
    const { room, roomName, displayName, durationMs, answered, respondedBy, recordingPath, participants } = broadcastData;

    let channels;
    try {
        channels = global.db.getEnabledNotificationChannels(room, answered);
    } catch (err) {
        logSystem('NOTIFY', `Failed to get channels: ${err.message}`);
        return;
    }

    if (!channels.length) return;

    const speaker = broadcastData.userName ? broadcastData.userName.replace('sip:', '') : 'Unknown';
    const account = global.db.getAccountByEmail(speaker);

    const vars = {
        name: account?.display_name || displayName || speaker,
        email: account?.email || speaker,
        company: account?.company_name || '',
        phone: account?.company_phone || '',
        address: account?.company_address || '',
        city: account?.city || '',
        state: account?.state || '',
        zip: account?.zip || '',
        room: roomName || String(room),
        duration: String(Math.round((durationMs || 0) / 1000)),
        status: answered ? 'Answered' : 'UNANSWERED',
        respondedBy: respondedBy || '',
        participants: String(participants?.length || 1),
        time: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true }),
    };

    for (const channel of channels) {
        try {
            const caption = _buildCaption(channel.message_template, vars);
            if (channel.type === 'telegram') {
                await _sendTelegram(channel, caption, recordingPath);
            }
        } catch (err) {
            logSystem('NOTIFY', `ERR ${channel.type}/${channel.label || channel.id}: ${err.message}`);
        }
    }
}

async function _sendTelegram(channel, caption, recordingPath) {
    const { bot_token, chat_id } = channel;
    if (!bot_token || !chat_id) return;

    if (recordingPath && fs.existsSync(recordingPath)) {
        const { FormData, File } = await import('node-fetch');
        const fileBuffer = fs.readFileSync(recordingPath);
        const fileName = recordingPath.split('/').pop();

        const form = new FormData();
        form.append('chat_id', chat_id);
        form.append('caption', caption);
        form.append('voice', new File([fileBuffer], fileName, { type: 'audio/ogg' }));

        const res = await fetch(`${TELEGRAM_API}${bot_token}/sendVoice`, {
            method: 'POST',
            body: form,
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram sendVoice ${res.status}: ${body}`);
        }
    } else {
        const res = await fetch(`${TELEGRAM_API}${bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: caption }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram sendMessage ${res.status}: ${body}`);
        }
    }

    logSystem('NOTIFY', `Telegram sent to ${channel.label || chat_id}`);
}

export async function testNotificationChannel(channel) {
    if (channel.type === 'telegram') {
        const testVars = {
            name: 'ALLEN',
            email: 'allen@example.com',
            company: 'All Japanese Auto Wrecking',
            phone: '323-581-0500',
            address: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001',
            room: 'California',
            duration: '12',
            status: 'UNANSWERED',
            respondedBy: '',
            participants: '1',
            time: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true }),
        };

        const caption = `✅ TEST — HotlineHQ\n\n${_buildCaption(channel.message_template, testVars)}`;

        const res = await fetch(`${TELEGRAM_API}${channel.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: channel.chat_id, text: caption }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram ${res.status}: ${body}`);
        }

        return { success: true };
    }

    throw new Error(`Unknown channel type: ${channel.type}`);
}
