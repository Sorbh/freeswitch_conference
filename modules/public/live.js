import express from 'express';
import fs from 'fs';
import { validateLiveLink } from '../../service/liveStream/hmac.js';
import { rateLimit } from '../../service/liveStream/rateLimiter.js';
import { getActiveBroadcast, getListenerCount } from '../../service/liveStream/streamService.js';

export const listenRouter = express.Router();

const validateLink = (req, res, next) => {
    const room = req.params.room;
    const { exp, sig } = req.query;
    const result = validateLiveLink(room, exp, sig);
    if (!result.valid) {
        return res.status(result.error === 'Link expired' ? 410 : 403)
            .json({ status: false, error: result.error });
    }
    req.liveRoom = result.room;
    req.liveExp = result.exp;
    next();
};

// GET /live/:room/status — live broadcast status + room info
listenRouter.get('/:room/status', rateLimit(60, 60000), validateLink, (req, res) => {
    const room = req.liveRoom;
    const roomConfig = global.db.getRoom(room);
    if (!roomConfig) return res.status(404).json({ status: false, error: 'Room not found' });

    const active = getActiveBroadcast(room);
    const listeners = getListenerCount(room);

    res.json({
        status: true,
        data: {
            room,
            roomName: roomConfig.name,
            broadcasting: !!active,
            speaker: active?.speaker || null,
            startTime: active?.startTime || null,
            participants: active?.participants || [],
            listeners,
        },
    });
});

// GET /live/:room/broadcasts — paginated broadcast list within the link's time window
listenRouter.get('/:room/broadcasts', rateLimit(30, 60000), validateLink, (req, res) => {
    const room = req.liveRoom;
    const exp = req.liveExp;
    const now = Math.floor(Date.now() / 1000);
    const windowSeconds = exp - now;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const sinceUnix = now - windowSeconds;
    const broadcasts = global.db.getBroadcastsForPublicListen(room, sinceUnix, limit, offset);
    const total = global.db.getBroadcastCountForPublicListen(room, sinceUnix);

    const truncateTranscription = (text) => {
        if (!text) return null;
        return text.length > 80 ? text.slice(0, 80) + '...' : text;
    };

    res.json({
        status: true,
        data: {
            broadcasts: broadcasts.map(b => ({
                id: b.id,
                display_name: b.display_name,
                room_name: b.room_name,
                duration_ms: b.duration_ms,
                answered: !!b.answered,
                responded_by: b.responded_by,
                participant_count: b.participant_count,
                listener_count: b.listener_count,
                response_time_ms: b.response_time_ms,
                transcription_preview: truncateTranscription(b.transcription || b.local_transcription),
                has_recording: !!b.recording_path,
                created_at: b.created_at,
            })),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
});

// GET /live/:room/stats — aggregate stats for the time window
listenRouter.get('/:room/stats', rateLimit(30, 60000), validateLink, (req, res) => {
    const room = req.liveRoom;
    const exp = req.liveExp;
    const now = Math.floor(Date.now() / 1000);
    const windowSeconds = exp - now;
    const sinceUnix = now - windowSeconds;

    const stats = global.db.getBroadcastStatsForPublicListen(room, sinceUnix);

    res.json({
        status: true,
        data: stats,
    });
});

// GET /live/:room/audio/:broadcastId — stream recording audio (within time window)
listenRouter.get('/:room/audio/:broadcastId', rateLimit(30, 60000), validateLink, (req, res) => {
    const room = req.liveRoom;
    const exp = req.liveExp;
    const now = Math.floor(Date.now() / 1000);
    const windowSeconds = exp - now;
    const sinceUnix = now - windowSeconds;

    const broadcastId = parseInt(req.params.broadcastId);
    if (!isFinite(broadcastId)) return res.status(400).json({ status: false, error: 'Invalid broadcast ID' });

    const broadcast = global.db.getBroadcastForPublicListen(room, broadcastId, sinceUnix);
    if (!broadcast) return res.status(404).json({ status: false, error: 'Broadcast not found' });
    if (!broadcast.recording_path) return res.status(404).json({ status: false, error: 'No recording available' });

    const filePath = broadcast.recording_path;
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: false, error: 'Recording file not found' });

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
});

// GET /live/:room/hourly — hourly broadcast distribution for charts
listenRouter.get('/:room/hourly', rateLimit(30, 60000), validateLink, (req, res) => {
    const room = req.liveRoom;
    const exp = req.liveExp;
    const now = Math.floor(Date.now() / 1000);
    const windowSeconds = exp - now;
    const sinceUnix = now - windowSeconds;

    const hourly = global.db.getBroadcastHourlyForPublicListen(room, sinceUnix);
    res.json({ status: true, data: hourly });
});
