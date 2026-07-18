import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { logSystem } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    participants: 'Participant names',
    time: 'Timestamp',
    transcription: 'Audio transcription text',
    parts: 'Part details (use {{parts.year}}, {{parts.make}}, {{parts.model}}, {{parts.trim}}, {{parts.part}}, {{parts.specification}} for individual fields)',
};

function _resolvePath(data, pathStr) {
    try {
        const indexMatch = pathStr.match(/^(.+)\[(\d+)\]$/);
        const keys = (indexMatch ? indexMatch[1] : pathStr).split('.');
        let value = data;
        for (const key of keys) {
            if (value == null) return '';
            value = value[key];
        }
        if (indexMatch) {
            const idx = parseInt(indexMatch[2]);
            if (Array.isArray(value)) return value[idx] ?? '';
            if (typeof value === 'string') {
                const parts = value.split(',').map(s => s.trim());
                return parts[idx] ?? value;
            }
        }
        if (value == null) return '';
        if (typeof value === 'object' && !Array.isArray(value)) {
            return ['year', 'make', 'model', 'trim', 'part', 'specification']
                .map(k => value[k]).filter(v => v && v !== 'null' && v !== 'not available').join(' | ');
        }
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    } catch {
        return '';
    }
}

function _buildCaption(template, vars) {
    let result = template || DEFAULT_TEMPLATE;
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const resolved = _resolvePath(vars, path.trim());
        return resolved || '';
    });
    return result.replace(/\n{3,}/g, '\n\n').trim();
}

function _ensureOgg(recordingPath) {
    return new Promise((resolve) => {
        if (!recordingPath || !fs.existsSync(recordingPath)) return resolve(null);
        // Recordings may be .wav (fresh) or .mp3 (archived) — either converts to ogg
        const oggPath = recordingPath.replace(/\.(wav|mp3)$/, '.ogg');
        if (oggPath === recordingPath) return resolve(null);
        if (fs.existsSync(oggPath)) return resolve(oggPath);
        execFile('ffmpeg', ['-y', '-i', recordingPath, '-c:a', 'libopus', '-b:a', '64k', oggPath], { timeout: 60000 }, (err) => {
            if (err) {
                logSystem('NOTIFY', `ffmpeg WAV→OGG failed: ${err.message}`);
                return resolve(null);
            }
            resolve(oggPath);
        });
    });
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

    // Filter out channels with skip_no_parts when broadcast has no parts request
    const hasPartsRequest = broadcastData.hasPartsRequest;
    if (hasPartsRequest !== undefined) {
        channels = channels.filter(ch => {
            if (ch.skip_no_parts && !hasPartsRequest) {
                logSystem('NOTIFY', `Skipping ${ch.type}/${ch.label || ch.id}: no parts request detected`);
                return false;
            }
            return true;
        });
        if (!channels.length) return;
    }

    const speaker = broadcastData.userName ? broadcastData.userName.replace('sip:', '') : 'Unknown';
    const account = global.db.getAccountByEmail(speaker);

    // Look up transcription from DB if available
    let transcription = '';
    if (recordingPath) {
        const row = global.db.getBroadcastByRecordingPath(recordingPath);
        if (row) {
            const full = global.db.getBroadcastById(row.id);
            if (full?.transcription) transcription = full.transcription;
        }
    }

    // Load part details from DB if available
    let partDetail = null;
    if (recordingPath) {
        const row = global.db.getBroadcastByRecordingPath(recordingPath);
        if (row) {
            const full = global.db.getBroadcastById(row.id);
            if (full?.part_details) {
                try { partDetail = typeof full.part_details === 'string' ? JSON.parse(full.part_details) : full.part_details; } catch {}
            }
        }
    }

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
        participants: Array.isArray(participants) ? participants.map(p => p.displayName || p).join(', ') : String(participants || ''),
        time: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true }),
        transcription,
        parts: partDetail || {},
    };

    const oggPath = await _ensureOgg(recordingPath);

    for (const channel of channels) {
        try {
            const caption = _buildCaption(channel.message_template, vars);
            if (channel.type === 'telegram') {
                await _sendTelegram(channel, caption, oggPath);
            } else if (channel.type === 'whatsapp') {
                await _sendWhatsApp(channel, caption, oggPath);
            }
            global.db.incrementNotificationDelivered(channel.id);
        } catch (err) {
            logSystem('NOTIFY', `ERR ${channel.type}/${channel.label || channel.id}: ${err.message}`);
        }
    }

    if (oggPath) {
        try { fs.unlinkSync(oggPath); } catch {}
    }
}

async function _sendTelegram(channel, caption, oggPath) {
    const { bot_token, chat_id } = channel;
    if (!bot_token || !chat_id) return;

    if (oggPath && fs.existsSync(oggPath)) {
        const { FormData, File } = await import('node-fetch');
        const fileBuffer = await fs.promises.readFile(oggPath);
        const fileName = oggPath.split('/').pop();

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

async function _sendWhatsApp(channel, caption, oggPath) {
    const { sendChannelMessage, getChannelStatus } = await import('./whatsapp.js');

    const status = getChannelStatus(channel.id);
    if (status.state !== 'ready') {
        throw new Error(`WhatsApp ch:${channel.id} not ready (state: ${status.state})`);
    }

    const groupId = channel.chat_id;
    if (!groupId) return;

    await sendChannelMessage(channel.id, groupId, caption, oggPath);
    logSystem('NOTIFY', `WhatsApp sent to ${channel.label || groupId}`);
}

export async function sendCustomMessage(channel, text, imagePath) {
    if (channel.type === 'telegram') {
        const { bot_token, chat_id } = channel;
        if (!bot_token || !chat_id) throw new Error('Missing bot_token or chat_id');

        if (imagePath && fs.existsSync(imagePath)) {
            const { FormData, File } = await import('node-fetch');
            const fileBuffer = await fs.promises.readFile(imagePath);
            const fileName = imagePath.split('/').pop();
            const form = new FormData();
            form.append('chat_id', chat_id);
            if (text) form.append('caption', text);
            form.append('photo', new File([fileBuffer], fileName, { type: 'image/jpeg' }));
            const res = await fetch(`${TELEGRAM_API}${bot_token}/sendPhoto`, { method: 'POST', body: form });
            if (!res.ok) { const body = await res.text(); throw new Error(`Telegram sendPhoto ${res.status}: ${body}`); }
        } else if (text) {
            const res = await fetch(`${TELEGRAM_API}${bot_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id, text }),
            });
            if (!res.ok) { const body = await res.text(); throw new Error(`Telegram sendMessage ${res.status}: ${body}`); }
        }
        logSystem('NOTIFY', `Telegram custom msg sent to ${channel.label || chat_id}`);
    } else if (channel.type === 'whatsapp') {
        const { sendChannelImage, sendChannelMessage, getChannelStatus } = await import('./whatsapp.js');
        const status = getChannelStatus(channel.id);
        if (status.state !== 'ready') throw new Error('WhatsApp not connected');
        const groupId = channel.chat_id;
        if (!groupId) throw new Error('No group selected');

        if (imagePath && fs.existsSync(imagePath)) {
            await sendChannelImage(channel.id, groupId, text, imagePath);
        } else if (text) {
            await sendChannelMessage(channel.id, groupId, text, null);
        }
        logSystem('NOTIFY', `WhatsApp custom msg sent to ${channel.label || groupId}`);
    }
    global.db.incrementNotificationDelivered(channel.id);
}

function _findLatestRecording() {
    try {
        const rows = global.db.getRecentBroadcasts(10);
        const row = rows.find(r => r.recording_path && fs.existsSync(r.recording_path));
        if (row) return row.recording_path;
    } catch {}
    return null;
}

export async function testNotificationChannel(channel) {
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
        participants: 'Allen, Bob, Charlie',
        time: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true }),
        parts: { year: '2019', make: 'Toyota', model: 'Camry', trim: 'SE', part: 'Transmission', specification: 'Automatic' },
    };

    const caption = `✅ TEST — HotlineHQ\n\n${_buildCaption(channel.message_template, testVars)}`;
    const recordingPath = _findLatestRecording();
    const oggPath = await _ensureOgg(recordingPath);

    try {
        if (channel.type === 'telegram') {
            await _sendTelegram(channel, caption, oggPath);
            return { success: true };
        }

        if (channel.type === 'whatsapp') {
            const { sendChannelMessage, getChannelStatus } = await import('./whatsapp.js');
            const status = getChannelStatus(channel.id);
            if (status.state !== 'ready') {
                throw new Error('WhatsApp not connected. Connect this channel first.');
            }
            await sendChannelMessage(channel.id, channel.chat_id, caption, oggPath);
            return { success: true };
        }

        throw new Error(`Unknown channel type: ${channel.type}`);
    } finally {
        if (oggPath && recordingPath) {
            try { fs.unlinkSync(oggPath); } catch {}
        }
    }
}
