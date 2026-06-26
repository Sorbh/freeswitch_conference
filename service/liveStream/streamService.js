import { spawn } from 'child_process';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { onCustomEvent } from '../freeswitch/connection.js';
import { logSystem } from '../logger.js';
import { validateLiveLink } from './hmac.js';
import { wsRateCheck } from './rateLimiter.js';

// room (int) → { clients: Set<ws>, ffmpeg: ChildProcess, readInterval, recordingPath, broadcasting }
const roomStreams = new Map();

// room (int) → { roomName, speaker, startTime, participants }
const activeBroadcasts = new Map();

let wss = null;

export function initLiveStream(server) {
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, `https://${req.headers.host}`);
        if (!url.pathname.startsWith('/ws/live/')) {
            return;
        }

        const parts = url.pathname.split('/');
        const room = parseInt(parts[3]);
        const exp = url.searchParams.get('exp');
        const sig = url.searchParams.get('sig');

        const validation = validateLiveLink(room, exp, sig);
        if (!validation.valid) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        if (!wsRateCheck(ip, 5)) {
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req, room, parseInt(exp));
        });
    });

    wss.on('connection', (ws, req, room, exp) => {
        _addListener(room, ws, exp);

        ws.on('close', () => _removeListener(room, ws));
        ws.on('error', () => _removeListener(room, ws));

        // Send current broadcast status
        const active = activeBroadcasts.get(room);
        ws.send(JSON.stringify({
            type: 'status',
            broadcasting: !!active,
            speaker: active?.speaker || null,
            roomName: active?.roomName || global.config.ROOM_NAME[room] || `Room ${room}`,
            startTime: active?.startTime || null,
            participants: active?.participants || [],
        }));
    });

    // Listen for broadcast events from FreeSWITCH conference
    onCustomEvent((event) => {
        const subclass = event.getHeader('Event-Subclass');
        if (subclass !== 'conference::maintenance') return;

        const action = event.getHeader('Action');
        const conferenceName = event.getHeader('Conference-Name');
        const room = parseInt(conferenceName) || null;
        if (!room) return;

        if (action === 'unmute-member') _onUnmute(room, conferenceName, event);
        else if (action === 'mute-member' || action === 'del-member') _onMuteOrLeave(room, conferenceName, event);
    });

    logSystem('LIVESTREAM', 'WebSocket live stream service initialized');
}

function _addListener(room, ws, exp) {
    if (!roomStreams.has(room)) {
        roomStreams.set(room, { clients: new Set(), ffmpeg: null, readInterval: null, recordingPath: null, broadcasting: false });
    }
    const stream = roomStreams.get(room);
    stream.clients.add(ws);

    // Auto-disconnect when link expires
    const ttl = (exp - Math.floor(Date.now() / 1000)) * 1000;
    if (ttl > 0) {
        const timer = setTimeout(() => {
            ws.send(JSON.stringify({ type: 'expired' }));
            ws.close(4001, 'Link expired');
        }, ttl);
        ws._expiryTimer = timer;
    }

    logSystem('LIVESTREAM', `Listener joined room ${room} (${stream.clients.size} total)`);
}

function _removeListener(room, ws) {
    const stream = roomStreams.get(room);
    if (!stream) return;
    if (ws._expiryTimer) clearTimeout(ws._expiryTimer);
    stream.clients.delete(ws);
    logSystem('LIVESTREAM', `Listener left room ${room} (${stream.clients.size} remaining)`);

    if (stream.clients.size === 0) {
        _stopAudioPipe(room);
        roomStreams.delete(room);
    }
}

function _broadcastToRoom(room, message) {
    const stream = roomStreams.get(room);
    if (!stream) return;
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    for (const ws of stream.clients) {
        if (ws.readyState === 1) {
            try { ws.send(data); } catch {}
        }
    }
}

function _onUnmute(room, conferenceName, event) {
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || 'Unknown';
    const uuid = event.getHeader('Unique-ID');

    let displayName = callerIdName;
    if (uuid) {
        const users = global.db.filter(u => u.fsChannelUUID === uuid);
        if (users.length > 0) {
            displayName = users[0].callerIdName || callerIdName;
            const email = users[0].userName?.replace(/^sip:/, '');
            if (email) {
                const account = global.db.getAccountByEmail(email);
                if (account) displayName = `${account.company_name || ''} / ${account.display_name || email}`;
            }
        }
    }

    const existing = activeBroadcasts.get(room);
    if (existing) {
        if (!existing.participants.includes(displayName)) {
            existing.participants.push(displayName);
        }
        _broadcastToRoom(room, {
            type: 'broadcast_update',
            speaker: existing.speaker,
            participants: existing.participants,
        });
        return;
    }

    const roomName = global.config.ROOM_NAME[room] || conferenceName;
    activeBroadcasts.set(room, {
        roomName,
        speaker: displayName,
        startTime: Date.now(),
        participants: [displayName],
    });

    _broadcastToRoom(room, {
        type: 'broadcast_start',
        speaker: displayName,
        roomName,
        startTime: Date.now(),
        participants: [displayName],
    });

    // Start audio pipe if we have listeners
    const stream = roomStreams.get(room);
    if (stream && stream.clients.size > 0) {
        _startAudioPipe(room, conferenceName);
    }

    logSystem('LIVESTREAM', `Broadcast started in room ${room} by ${displayName}`);
}

function _onMuteOrLeave(room, conferenceName, event) {
    const active = activeBroadcasts.get(room);
    if (!active) return;

    // Check if any members are still unmuted in this conference
    // We rely on broadcast.js session tracking — when all participants mute,
    // broadcast.js will finalize the session. We listen for that via a small delay
    // to let broadcast.js process first.
    setTimeout(() => {
        // If broadcast.js already cleaned up (no active session), broadcast ended
        // We check by importing roomSessions from broadcast.js
        _checkBroadcastEnded(room, conferenceName);
    }, 200);
}

async function _checkBroadcastEnded(room, conferenceName) {
    try {
        const { isRoomBroadcasting } = await import('../freeswitch/broadcast.js');
        if (!isRoomBroadcasting(conferenceName)) {
            activeBroadcasts.delete(room);
            _stopAudioPipe(room);
            _broadcastToRoom(room, { type: 'broadcast_end' });
            logSystem('LIVESTREAM', `Broadcast ended in room ${room}`);
        }
    } catch {
        // If the function doesn't exist yet, just check activeBroadcasts
    }
}

function _startAudioPipe(room, conferenceName) {
    const stream = roomStreams.get(room);
    if (!stream || stream.ffmpeg) return;

    // Find the active recording file from the recordings directory
    // broadcast.js writes to: recordings/{RoomName}_{timestamp}.wav
    const roomName = global.config.ROOM_NAME[room] || String(room);
    const recordingDir = global.config.RECORDING_DIR;

    // Watch for new WAV files in the recording dir for this room
    const checkRecording = () => {
        try {
            const files = fs.readdirSync(recordingDir)
                .filter(f => f.startsWith(roomName + '_') && f.endsWith('.wav'))
                .sort()
                .reverse();

            if (files.length === 0) return null;

            const latestFile = files[0];
            const filePath = `${recordingDir}/${latestFile}`;
            const stat = fs.statSync(filePath);

            // Only use files created in the last 30 seconds (active recording)
            if (Date.now() - stat.mtimeMs < 30000) {
                return filePath;
            }
        } catch {}
        return null;
    };

    // Poll for the recording file (broadcast.js creates it slightly after unmute)
    let attempts = 0;
    const findFile = setInterval(() => {
        attempts++;
        const filePath = checkRecording();
        if (filePath) {
            clearInterval(findFile);
            _pipeAudio(room, filePath);
        } else if (attempts > 50) {
            clearInterval(findFile);
            logSystem('LIVESTREAM', `Could not find recording file for room ${room}`);
        }
    }, 200);

    stream._findFileInterval = findFile;
}

function _pipeAudio(room, filePath) {
    const stream = roomStreams.get(room);
    if (!stream || stream.ffmpeg) return;

    stream.recordingPath = filePath;

    // Read the WAV file as it grows and pipe through ffmpeg for Opus encoding
    // Skip 44-byte WAV header, read raw PCM (48kHz 16-bit mono from conference config)
    let readPos = 44; // skip WAV header
    let fd = null;

    try {
        fd = fs.openSync(filePath, 'r');
    } catch (e) {
        logSystem('LIVESTREAM', `Failed to open recording: ${e.message}`);
        return;
    }

    // Spawn ffmpeg: raw PCM input → Opus/WebM output
    const ffmpeg = spawn('ffmpeg', [
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '1',
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-application', 'voip',
        '-frame_duration', '60',
        '-vn',
        '-f', 'webm',
        'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    stream.ffmpeg = ffmpeg;

    ffmpeg.stdout.on('data', (chunk) => {
        const stream = roomStreams.get(room);
        if (!stream) return;
        for (const ws of stream.clients) {
            if (ws.readyState === 1) {
                try { ws.send(chunk); } catch {}
            }
        }
    });

    ffmpeg.on('close', () => {
        const s = roomStreams.get(room);
        if (s) s.ffmpeg = null;
    });

    ffmpeg.on('error', (err) => {
        logSystem('LIVESTREAM', `ffmpeg error for room ${room}: ${err.message}`);
    });

    // Read loop: poll the growing file every 100ms
    const readBuf = Buffer.alloc(16384);
    stream.readInterval = setInterval(() => {
        try {
            const bytesRead = fs.readSync(fd, readBuf, 0, readBuf.length, readPos);
            if (bytesRead > 0) {
                readPos += bytesRead;
                const chunk = Buffer.from(readBuf.buffer, readBuf.byteOffset, bytesRead);
                if (ffmpeg.stdin.writable) {
                    ffmpeg.stdin.write(chunk);
                }
            }
        } catch (e) {
            // File might be gone if broadcast ended
            if (e.code === 'EBADF' || e.code === 'ENOENT') {
                _stopAudioPipe(room);
            }
        }
    }, 100);

    stream._fd = fd;
    logSystem('LIVESTREAM', `Audio pipe started for room ${room}: ${filePath}`);
}

function _stopAudioPipe(room) {
    const stream = roomStreams.get(room);
    if (!stream) return;

    if (stream._findFileInterval) {
        clearInterval(stream._findFileInterval);
        stream._findFileInterval = null;
    }

    if (stream.readInterval) {
        clearInterval(stream.readInterval);
        stream.readInterval = null;
    }

    if (stream.ffmpeg) {
        try { stream.ffmpeg.stdin.end(); } catch {}
        try { stream.ffmpeg.kill('SIGTERM'); } catch {}
        stream.ffmpeg = null;
    }

    if (stream._fd) {
        try { fs.closeSync(stream._fd); } catch {}
        stream._fd = null;
    }

    stream.recordingPath = null;
}

export function getListenerCount(room) {
    const stream = roomStreams.get(room);
    return stream ? stream.clients.size : 0;
}

export function getActiveBroadcast(room) {
    return activeBroadcasts.get(room) || null;
}

export function isRoomLive(room) {
    return activeBroadcasts.has(room);
}

export function getAllActiveRooms() {
    const result = [];
    for (const [room, data] of activeBroadcasts) {
        result.push({ room, ...data, listeners: getListenerCount(room) });
    }
    return result;
}
