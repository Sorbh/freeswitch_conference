import { getConnection, onCustomEvent } from './freeswitch/connection.js';
import { logSystem } from './logger.js';

// room (int) → { adId, startTime, durationMs }
const activePlaybacks = new Map();

export function getActivePlaybacks() {
    const result = {};
    for (const [room, info] of activePlaybacks) {
        result[room] = { adId: info.adId, startTime: info.startTime, durationMs: info.durationMs };
    }
    return result;
}

export function isPlaying(room) {
    return activePlaybacks.has(Number(room));
}

export async function playAd(adId) {
    const ad = global.db.getAudioAd(adId);
    if (!ad) throw new Error('Ad not found');
    if (!ad.enabled) throw new Error('Ad is disabled');

    const rooms = JSON.parse(ad.rooms || '[]');
    if (rooms.length === 0) throw new Error('No rooms assigned');

    const results = [];

    for (const room of rooms) {
        if (activePlaybacks.has(room)) {
            results.push({ room, status: 'already_playing' });
            continue;
        }

        const connectedUsers = global.db.filter(u =>
            u.connectionState === 'connected' && (u.currentRoom || u.room) === room
        );
        const listenerCount = connectedUsers.length;

        if (listenerCount === 0) {
            results.push({ room, status: 'no_listeners' });
            continue;
        }

        const unmutedUsers = connectedUsers.filter(u => !u.mute);
        if (unmutedUsers.length > 0) {
            results.push({ room, status: 'room_busy' });
            continue;
        }

        activePlaybacks.set(room, {
            adId: ad.id,
            startTime: Math.floor(Date.now() / 1000),
            durationMs: ad.duration_ms,
            listenerCount,
        });

        getConnection().api(`conference ${room} play ${ad.audio_path}`, (response) => {
            logSystem('ADS', `Playing "${ad.label}" in room ${room} (${listenerCount} listeners)`);
        });

        results.push({ room, status: 'playing', listenerCount });
    }

    return results;
}

export function stopAd(room, interruptedBy) {
    room = Number(room);
    const info = activePlaybacks.get(room);
    if (!info) return;

    getConnection().api(`conference ${room} stop`, () => {});

    const durationPlayed = (Math.floor(Date.now() / 1000) - info.startTime) * 1000;

    global.db.logAdPlay({
        ad_id: info.adId,
        room,
        started_at: info.startTime,
        duration_played_ms: durationPlayed,
        completed: false,
        interrupted_by: interruptedBy || null,
        listener_count: info.listenerCount || 0,
    });

    activePlaybacks.delete(room);
    logSystem('ADS', `Stopped in room ${room}${interruptedBy ? ` (interrupted by ${interruptedBy})` : ''}`);
}

export function stopAllRooms() {
    for (const room of [...activePlaybacks.keys()]) {
        stopAd(room, null);
    }
}

// Listen for play-file-done to mark natural completions
onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;

    const action = event.getHeader('Action');
    if (action !== 'play-file-done' && action !== 'play-file-member-done') return;

    const conferenceName = event.getHeader('Conference-Name');
    const room = parseInt(conferenceName);
    if (!room) return;

    const info = activePlaybacks.get(room);
    if (!info) return;

    global.db.logAdPlay({
        ad_id: info.adId,
        room,
        started_at: info.startTime,
        duration_played_ms: info.durationMs,
        completed: true,
        interrupted_by: null,
        listener_count: info.listenerCount || 0,
    });

    activePlaybacks.delete(room);
    logSystem('ADS', `Completed in room ${room}`);
});
