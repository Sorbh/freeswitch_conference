import { getConnection } from './freeswitch/connection.js';
import { logSystem } from './logger.js';

function _fsApi(command) {
    return new Promise((resolve, reject) => {
        const conn = getConnection();
        if (!conn) return reject(new Error('ESL not connected'));
        conn.api(command, (res) => {
            const body = res?.getBody?.() || res?.body || '';
            resolve(body);
        });
    });
}

function _parseXmlMembers(xmlStr) {
    const rooms = [];
    const confRegex = /<conference name="([^"]*)"[^>]*member-count="(\d+)"[^>]*run_time="(\d+)"[^>]*>/g;
    const memberRegex = /<member type="caller">([\s\S]*?)<\/member>/g;

    let confMatch;
    let lastIndex = 0;

    while ((confMatch = confRegex.exec(xmlStr)) !== null) {
        const roomName = confMatch[1];
        const memberCount = parseInt(confMatch[2]);
        const runTime = parseInt(confMatch[3]);

        const nextConfStart = xmlStr.indexOf('<conference ', confMatch.index + 1);
        const confBlock = nextConfStart > -1
            ? xmlStr.slice(confMatch.index, nextConfStart)
            : xmlStr.slice(confMatch.index);

        const members = [];
        let mMatch;
        const memberRe = /<member type="caller">([\s\S]*?)<\/member>/g;
        while ((mMatch = memberRe.exec(confBlock)) !== null) {
            const block = mMatch[1];
            const get = (tag) => {
                const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
                return m ? m[1] : null;
            };
            members.push({
                id: get('id'),
                uuid: get('uuid'),
                callerIdNumber: decodeURIComponent(get('caller_id_number') || ''),
                callerIdName: decodeURIComponent(get('caller_id_name') || ''),
                canSpeak: get('can_speak') === 'true',
                talking: get('talking') === 'true',
                lastTalking: get('last_talking'),
                energy: parseInt(get('energy') || '0'),
                joinTime: parseInt(get('join_time') || '0'),
            });
        }

        rooms.push({ roomName, memberCount, runTime, members });
    }
    return rooms;
}

export async function runAudioHealthCheck() {
    const results = {
        timestamp: Date.now(),
        totalInCall: 0,
        totalInConference: 0,
        zombieChannels: [],
        stuckUsers: [],
        rooms: [],
        healthy: 0,
        warnings: 0,
    };

    // 1. Get all FS channels
    let channelUuids = new Set();
    try {
        const channelsJson = await _fsApi('show channels as json');
        const parsed = JSON.parse(channelsJson);
        results.totalInCall = parsed.row_count || 0;
        for (const ch of (parsed.rows || [])) {
            channelUuids.add(ch.uuid);
        }
    } catch (err) {
        logSystem('HEALTH', `Failed to get channels: ${err.message}`);
    }

    // 2. Get conference members with audio data
    let confRooms = [];
    try {
        const xmlList = await _fsApi('conference xml_list');
        confRooms = _parseXmlMembers(xmlList);
        for (const room of confRooms) {
            results.totalInConference += room.members.length;
        }
    } catch (err) {
        logSystem('HEALTH', `Failed to get conference list: ${err.message}`);
    }

    // 3. Check DB users marked "connected" but not in any FS channel
    const dbUsers = global.db.getAllUserInfo();
    const dbConnected = dbUsers.filter(u => u.connectionState === 'connected');

    for (const user of dbConnected) {
        if (user.fsChannelUUID && !channelUuids.has(user.fsChannelUUID)) {
            results.stuckUsers.push({
                userName: user.userName,
                callerIdName: user.callerIdName,
                room: user.room,
                roomName: global.config.ROOM_NAME?.[user.room] || String(user.room),
                fsChannelUUID: user.fsChannelUUID,
                issue: 'db_connected_no_channel',
                description: 'Marked connected in DB but no matching FreeSWITCH channel',
            });
        }
    }

    // 4. Check for channels not in any conference
    const confUuids = new Set();
    for (const room of confRooms) {
        for (const m of room.members) {
            if (m.uuid) confUuids.add(m.uuid);
        }
    }
    for (const uuid of channelUuids) {
        if (!confUuids.has(uuid)) {
            results.zombieChannels.push({
                uuid,
                issue: 'channel_not_in_conference',
                description: 'Active FS channel not in any conference room',
            });
        }
    }

    // 5. Build per-room health with member details
    for (const room of confRooms) {
        const roomResult = {
            roomName: room.roomName,
            roomDisplayName: global.config.ROOM_NAME?.[parseInt(room.roomName)] || room.roomName,
            memberCount: room.memberCount,
            runTime: room.runTime,
            members: [],
        };

        for (const m of room.members) {
            const email = m.callerIdNumber;
            const account = email ? global.db.getAccountByEmail(email) : null;
            const displayName = account
                ? `${account.company_name || ''} / ${account.display_name || email}`.trim().replace(/^\/ /, '')
                : m.callerIdName || m.callerIdNumber;

            // Get remote media IP for the channel
            let remoteIp = null;
            let remotePort = null;
            try {
                remoteIp = await _fsApi(`uuid_getvar ${m.uuid} remote_media_ip`);
                remotePort = await _fsApi(`uuid_getvar ${m.uuid} remote_media_port`);
                if (remoteIp === '_undef_') remoteIp = null;
                if (remotePort === '_undef_') remotePort = null;
                remoteIp = remoteIp?.trim() || null;
                remotePort = remotePort?.trim() || null;
            } catch {}

            const memberResult = {
                memberId: m.id,
                uuid: m.uuid,
                callerIdNumber: m.callerIdNumber,
                displayName,
                canSpeak: m.canSpeak,
                talking: m.talking,
                lastTalking: m.lastTalking,
                energy: m.energy,
                joinTimeSec: m.joinTime,
                remoteIp,
                remotePort,
                status: 'healthy',
                issues: [],
            };

            // No remote media IP = no audio path
            if (!remoteIp) {
                memberResult.status = 'warning';
                memberResult.issues.push('No remote media IP');
            }

            // In conference but channel gone from FS
            if (!channelUuids.has(m.uuid)) {
                memberResult.status = 'error';
                memberResult.issues.push('Channel UUID not in active channels');
            }

            if (memberResult.status === 'healthy') results.healthy++;
            else results.warnings++;

            roomResult.members.push(memberResult);
        }

        results.rooms.push(roomResult);
    }

    // Also count stuck users
    results.warnings += results.stuckUsers.length + results.zombieChannels.length;

    return results;
}
