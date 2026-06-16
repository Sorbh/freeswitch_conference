// Auto-mute for conference members who forget to mute after broadcasting.
// When someone unmutes, a hard-ceiling timer starts (default 3 min, configurable).
// At timeout−30s: whisper warning tone + Yealink screen notification.
// At timeout: force-mute via FS conference API. Timer clears on mute/leave.
// Skips users in direct (1-to-1) calls. Settings: automute_enabled, automute_timeout_ms.
import { onCustomEvent } from './connection.js';
import { muteByMemberId } from './callAction.js';
import { showMessage, playTone } from './notifications.js';
import { logUser } from '../logger.js';
import { isInDirectCall } from './directCall.js';
import { findUserByMember, findUserByUuid } from './callEvents.js';

const WARNING_BEFORE_MS = 30_000;
const WARNING_TONE = 'tone_stream://%(300,200,880);%(300,200,1100);loops=2';

const autoMuteTimers = new Map();

function _getSettings() {
    const enabled = global.db.getSetting('automute_enabled') === '1';
    const timeoutMs = parseInt(global.db.getSetting('automute_timeout_ms') || '180000', 10);
    return { enabled, timeoutMs };
}

function _resolveUserName(memberId, conferenceName, event) {
    const user = findUserByMember(conferenceName, memberId) || findUserByUuid(event.getHeader('Unique-ID'));
    return user?.userName || null;
}

function _startAutoMute(userName, room, memberId) {
    const { enabled, timeoutMs } = _getSettings();
    if (!enabled || timeoutMs <= 0) return;

    _clearAutoMute(userName);

    const roomName = global.config.ROOM_NAME[room] || room;
    const warningMs = Math.max(0, timeoutMs - WARNING_BEFORE_MS);

    const warningTimer = warningMs > 0 && warningMs < timeoutMs
        ? setTimeout(() => {
            const userInfo = global.db.getUserInfo(userName);
            if (!userInfo || userInfo.mute || userInfo.connectionState !== 'connected') return;
            const currentRoom = userInfo.currentRoom || userInfo.room;
            const currentMemberId = userInfo.fsMemberId;
            if (!currentMemberId) return;

            playTone([userName], WARNING_TONE);
            showMessage([userName], 'Auto-mute in 30s', 8);
            logUser(userName, 'AUTOMUTE', `WARNING in ${roomName} (${Math.round(timeoutMs / 1000)}s timeout)`);
        }, warningMs)
        : null;

    const muteTimer = setTimeout(() => {
        const userInfo = global.db.getUserInfo(userName);
        if (!userInfo || userInfo.mute || userInfo.connectionState !== 'connected') {
            _clearAutoMute(userName);
            return;
        }
        const currentRoom = userInfo.currentRoom || userInfo.room;
        const currentMemberId = userInfo.fsMemberId;
        if (!currentMemberId) {
            _clearAutoMute(userName);
            return;
        }

        userInfo.mute = true;
        global.db.setUserInfo(userName, userInfo);
        muteByMemberId(currentRoom, currentMemberId, userName);
        logUser(userName, 'AUTOMUTE', `MUTED in ${roomName} after ${Math.round(timeoutMs / 1000)}s`);
        autoMuteTimers.delete(userName);
    }, timeoutMs);

    autoMuteTimers.set(userName, { warningTimer, muteTimer });
}

function _clearAutoMute(userName) {
    const timers = autoMuteTimers.get(userName);
    if (!timers) return;
    if (timers.warningTimer) clearTimeout(timers.warningTimer);
    if (timers.muteTimer) clearTimeout(timers.muteTimer);
    autoMuteTimers.delete(userName);
}

onCustomEvent((event) => {
    const subclass = event.getHeader('Event-Subclass');
    if (subclass !== 'conference::maintenance') return;

    const action = event.getHeader('Action');
    const conferenceName = event.getHeader('Conference-Name');
    const memberId = event.getHeader('Member-ID');
    const room = parseInt(conferenceName) || null;

    const uuid = event.getHeader('Unique-ID');
    if (uuid && isInDirectCall(uuid)) return;

    if (action === 'unmute-member') {
        const userName = _resolveUserName(memberId, conferenceName, event);
        if (userName) _startAutoMute(userName, room, memberId);
    } else if (action === 'mute-member' || action === 'del-member') {
        const userName = _resolveUserName(memberId, conferenceName, event);
        if (userName) _clearAutoMute(userName);
    }
});
