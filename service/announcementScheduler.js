import { playAd, isPlaying } from './announcements.js';
import { logSystem } from './logger.js';

const CHECK_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;

// Track which ad+time combos we've already played/attempted today
// key: "adId:HH:MM:YYYY-MM-DD"
const playedToday = new Map();

// Track last play time for interval-based ads: adId -> epoch ms
const lastIntervalPlay = new Map();

// Pending retries: key -> { adId, retryUntil, timer }
const pendingRetries = new Map();

function getLocalTime(tz) {
    try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit', minute: '2-digit', hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(now);
        const get = (type) => parts.find(p => p.type === type)?.value || '';
        return {
            time: `${get('hour')}:${get('minute')}`,
            date: `${get('year')}-${get('month')}-${get('day')}`,
        };
    } catch {
        return { time: '', date: '' };
    }
}

function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function makeKey(adId, time, date) {
    return `${adId}:${time}:${date}`;
}

function cleanupOldEntries() {
    const now = new Date().toISOString().slice(0, 10);
    for (const [key] of playedToday) {
        if (!key.endsWith(now)) playedToday.delete(key);
    }
}

async function tryPlayAd(adId, reason) {
    try {
        const results = await playAd(adId);
        const played = results.some(r => r.status === 'playing');
        const busy = results.some(r => r.status === 'room_busy');
        if (played) {
            logSystem('SCHED', `Scheduled play of ad #${adId} (${reason}) — success`);
            return 'played';
        }
        if (busy) return 'busy';
        return 'skipped';
    } catch (err) {
        logSystem('SCHED', `Scheduled play of ad #${adId} failed: ${err.message}`);
        return 'error';
    }
}

function startRetry(adId, reason, key) {
    if (pendingRetries.has(key)) return;

    const retryUntil = Date.now() + MAX_RETRY_MS;
    logSystem('SCHED', `Room busy for ad #${adId} (${reason}) — retrying for up to 5 min`);

    const attempt = async () => {
        if (Date.now() > retryUntil) {
            logSystem('SCHED', `Giving up on ad #${adId} (${reason}) — room still busy after 5 min`);
            pendingRetries.delete(key);
            return;
        }

        const result = await tryPlayAd(adId, reason);
        if (result === 'played') {
            lastIntervalPlay.set(adId, Date.now());
            pendingRetries.delete(key);
            return;
        }
        if (result === 'skipped' || result === 'error') {
            pendingRetries.delete(key);
            return;
        }
        const timer = setTimeout(attempt, RETRY_INTERVAL_MS);
        pendingRetries.set(key, { adId, retryUntil, timer });
    };

    const timer = setTimeout(attempt, RETRY_INTERVAL_MS);
    pendingRetries.set(key, { adId, retryUntil, timer });
}

function isInWindow(currentTime, windowStart, windowEnd) {
    if (!windowStart || !windowEnd) return true;
    const now = timeToMinutes(currentTime);
    const start = timeToMinutes(windowStart);
    const end = timeToMinutes(windowEnd);
    if (start <= end) return now >= start && now <= end;
    return now >= start || now <= end;
}

async function checkSchedule() {
    const ads = global.db.getScheduledAds();
    if (!ads.length) return;

    for (const ad of ads) {
        const tz = ad.timezone || 'America/Phoenix';
        const { time: currentTime, date: currentDate } = getLocalTime(tz);
        if (!currentTime) continue;

        const scheduleType = ad.schedule_type || 'times';

        if (scheduleType === 'interval') {
            const intervalMs = (ad.interval_minutes || 0) * 60_000;
            if (intervalMs <= 0) continue;

            if (!isInWindow(currentTime, ad.window_start, ad.window_end)) continue;

            const lastPlayed = lastIntervalPlay.get(ad.id) || 0;
            if (Date.now() - lastPlayed < intervalMs) continue;

            const key = `interval:${ad.id}`;
            if (pendingRetries.has(key)) continue;

            lastIntervalPlay.set(ad.id, Date.now());
            const result = await tryPlayAd(ad.id, `every ${ad.interval_minutes}min`);
            if (result === 'busy') {
                startRetry(ad.id, `every ${ad.interval_minutes}min`, key);
            }
        } else {
            let times;
            try { times = JSON.parse(ad.schedule_times || '[]'); } catch { continue; }
            if (!times.length) continue;

            for (const scheduleTime of times) {
                if (currentTime !== scheduleTime) continue;

                const key = makeKey(ad.id, scheduleTime, currentDate);
                if (playedToday.has(key)) continue;

                playedToday.set(key, true);

                const result = await tryPlayAd(ad.id, `at ${scheduleTime}`);
                if (result === 'busy') {
                    startRetry(ad.id, `at ${scheduleTime}`, key);
                }
            }
        }
    }
}

let intervalHandle = null;

export function startScheduler() {
    if (intervalHandle) return;
    logSystem('SCHED', 'Announcement scheduler started (60s interval)');
    intervalHandle = setInterval(() => {
        cleanupOldEntries();
        checkSchedule().catch(err => logSystem('SCHED', `Check failed: ${err.message}`));
    }, CHECK_INTERVAL_MS);
    setTimeout(() => checkSchedule().catch(() => {}), 5000);
}

export function stopScheduler() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
    for (const [, entry] of pendingRetries) {
        clearTimeout(entry.timer);
    }
    pendingRetries.clear();
}
