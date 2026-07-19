/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// Redline SIP Client — Drop-in replacement for audiobridge_sip.js
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT IT DOES:
//   1. Reads user email from localStorage("user_data") — same as audiobridge.js
//   2. Registers with FreeSWITCH via JsSIP WebSocket
//   3. Receives incoming calls (INVITE from FreeSWITCH) and attaches audio
//   4. Connects to SSE for real-time CallerID and renders into #caller_grid
//   5. Handles mute/unmute via Ctrl+L (sends hook events to server)
//   6. Auto-reconnects on sleep/wake and WebSocket drops
//
// REQUIRED HTML ELEMENTS:
//   <audio id="remoteAudio" autoplay hidden></audio>
//   <div id="caller_grid"></div>
//
// HOW TO USE (single script tag, no function calls needed):
//   <script type="module" src="https://hotlinehq.online/redline_sip_client.js"></script>
//
//   That's it. JsSIP is auto-loaded from /jssip.bundle.js.
//   If localStorage has "user_data" with is_sip=0, it auto-connects.
//
//   To load JsSIP from a custom path:
//   window.HOTLINE_CONFIG = { jssipUrl: '/path/to/jssip.bundle.js' };
//
// LOCALSTORAGE FORMAT (set by Vue app on login):
//   localStorage.setItem("user_data", JSON.stringify({
//     id: 201,
//     email: "phoenix.blueyellowline@gmail.com",
//     is_sip: 1,
//     user_type: 2,
//     name: "Phoenix SB",                    // used if parent_id set
//     parent_id: null,
//     parent_city: "",
//     user_detail: {
//       company_name: "Phoenix SB",
//       representative_name: "LOUIE",
//       company_phone: "(909) 889 1400",
//       city: "San Bernardino",
//       email: "phoenix.blueyellowline@gmail.com"
//     }
//   }));
//   localStorage.setItem("room", "123456701");
//
// OPTIONAL CONFIG (set before loading this script):
//   window.HOTLINE_CONFIG = {
//     wsServer: '',              // WebSocket URL for SIP (default: wss://hotlinehq.online/fs_wss/)
//     apiBase: '',               // API base URL (default: https://hotlinehq.online/fs/)
//     baseUrl: '',               // origin serving the shared helper scripts (hotlinehq_push_notification.js,
//                                // hotlinehq_extensions.js); default: https://hotlinehq.online
//     password: '12345678',        // SIP password (also used for /client/login); legacy alias: defaultPassword
//     token: '',                  // pre-existing JWT token — skips POST /login, fetches account via GET /account
//     extensions: true,           // set false to disable loading extension/direct-call module (default: true)
//     extensionWidget: true,     // set false to hide the floating extension directory UI (default: true)
//     pushNotifications: false,   // set true to enable loading push notification module (default: false)
//     broadcastFeed: false,        // set true to enable loading broadcast feed module (default: false)
//     directCallAnswerButton: false, // set true to show Answer button for incoming direct calls
//     listenOnly: false,          // set true to force listen-only mode (SIP registers with silent audio, no mic)
//     monitorMode: false,         // set true to skip SIP entirely — SSE caller ID only, no audio, no mute (view-only)
//                                 // also auto-activated when login detects Yealink already connected
//   };
//
// API ENDPOINTS USED:
//   POST /api/v1/client/login          — authenticate, get JWT + account info
//   GET  /api/v1/client/extensions     — searchable extension directory
//   POST /api/v1/client/direct-call/start — start direct call by extension
//   POST /api/v1/client/mute           — mute in conference (Bearer token)
//   POST /api/v1/client/unmute         — unmute in conference (Bearer token)
//   GET  /api/v1/client/rooms/details   — all rooms with online counts
//   PUT  /api/v1/client/room/change    — change user's current room
//   GET  /api/v1/client/events/room/:room?token=<jwt>  — CallerID SSE
//   GET  /api/v1/client/events/broadcasts/:room??token=<jwt>&answered=0|1  — Broadcast SSE
//   GET  /api/v1/client/broadcasts/list/:room?  — paginated broadcast list
//
// OPTIONAL CALLBACKS (same contract in redline_sip_client.js and redline_callerid.js):
//   window.onHotlineReady = function(accountData) { ... }              // account loaded and client initialized
//   window.onHotlineCallState = function(state) { ... }                // conference media state: 'connected' or 'disconnected'
//   window.onHotlineMuteState = function(muted) { ... }                // true when muted, false when unmuted
//   window.onHotlineDirectCallState = function(state, data) { ... }    // 'incoming', 'outgoing', 'connected', 'ending', 'ended', 'declined', 'missed', 'cancelled', 'busy', 'unavailable'
//   window.onHotlineRoomChange = function(data) { ... }                // { source, room, roomName } — called on room change (API or SSE)
//   window.onHotlineUserRefresh = function(data) { ... }               // { email, reason } — admin requested refresh; default (no callback): full page reload
//   window.onHotlineUserLogout = function(data) { ... }                // { type, reason } — logged out by server (e.g. signed in from another location)
//   window.onHotlineKickout = function(data) { ... }                   // { type, kickout: 1|0, reason } — admin toggled kickout; 1 = removed from hotline, 0 = access restored
//   window.onHotlineMonitorMode = function(active) { ... }             // true when monitor mode active (Yealink has the call, view-only dashboard); false when exited (e.g. web takeover)
//   window.onHotlineTakeoverState = function(active) { ... }           // web_takeover flag changed via takeOver()/releaseTakeover(); true = browser has device priority
//   window.onHotlineBroadcastConnected = function(data) { ... }        // { type:'connected', data:[...], total, page, pageSize, totalPages }
//   window.onHotlineBroadcast = function(data) { ... }                 // { type:'broadcast', data:{...broadcast row...}, ts }
//   window.onCallerIdUpdate = function(data) { ... }                   // { callerIds, callerIdHtml, userCount, unmutedCount, online, ts }
//   window.onHotlineError = function(err) { ... }                      // { type: 'login'|'account_fetch', status, code, message } — API failure;
//                                                                      // host page decides (e.g. status 401 → session dead, redirect to login)
//
// MANUAL CONTROL (if needed):
//   window.hotlineClient.login('email@example.com')               // login with specific email
//   window.hotlineClient.logout()                                 // disconnect everything
//   window.hotlineClient.reconnect()                              // force reconnect SSE
//   window.hotlineClient.disconnect()                             // stop SSE and clear grid
//   window.hotlineClient.toggleMute()                             // Ctrl+L equivalent
//   window.hotlineClient.pttStart() / .pttEnd()                   // press/release: tap(<300ms)=toggle, hold=push-to-talk
//   window.hotlineClient.hangup()                                 // end current call
//   window.hotlineClient.getRoom()                                // get current room
//   window.hotlineClient.getRoomDetails()                         // get all rooms with online counts
//   window.hotlineClient.changeRoom(roomId)                       // switch to a different room (SIP session survives; reloads page only if no onHotlineRoomChange callback)
//   window.hotlineClient.requestRoom({ city, state, message })    // request a new room
//   window.hotlineClient.getAccount()                             // get loaded account data
//   window.hotlineClient.getToken()                               // get current JWT token
//   window.hotlineClient.startBroadcastFeed(room, {answered})     // start broadcast SSE (room optional)
//   window.hotlineClient.stopBroadcastFeed()                      // stop broadcast SSE
//   window.hotlineClient.getBroadcasts(room, {page,pageSize,answered,hasParts,dateFrom,dateTo})  // REST fetch
//   window.hotlineClient.isConnected()                            // true if in active call or monitor mode
//   window.hotlineClient.isMuted()                                // true if muted
//   window.hotlineClient.isListenOnly()                           // true if listen-only mode
//   window.hotlineClient.isMonitorMode()                          // true if monitor mode (Yealink or config)
//   window.hotlineClient.takeOver()                               // enable web_takeover: browser gets device priority
//   window.hotlineClient.releaseTakeover()                        // disable web_takeover: Yealink regains priority
//   window.hotlineClient.isWebTakeover()                          // true if web_takeover flag is on
//   window.RedlineExtensionDirectory.open()                       // open extension search
//
// SSE EVENTS HANDLED:
//   callerid      — caller ID HTML + online counts
//   online_update — online/offline count changes
//   room_change   — user changed room (SSE rebound to new room; reloads only without onHotlineRoomChange)
//   user_refresh  — admin requested browser refresh (reloads page unless onHotlineUserRefresh is set)
//   user_logout   — server-initiated logout (e.g. signed in from another location); calls logout()
//   kickout       — admin toggled the kickout flag; kickout=1 hangs up (server blocks re-entry), kickout=0 means access restored (server reconnects on next register)
//   monitor_mode  — Yealink reclaimed the call: hang up, unregister, view-only dashboard
//   exit_monitor  — reverse of monitor_mode: no device left (Yealink gone), wake up and SIP register
//   direct_call_* — incoming/outgoing direct call notifications
//
// ═══════════════════════════════════════════════════════════════════════════

import "./jssip.bundle.js";

(function () {

    function init() {
        console.log('[SIP] init() called');

        // ── 1. Config & State ──

        var config = window.HOTLINE_CONFIG || {};
        var baseUrl = (config.baseUrl || 'https://hotlinehq.online').replace(/\/$/, '');
        var apiBase = config.apiBase || 'https://hotlinehq.online/fs';
        var wsServer = config.wsServer || 'wss://hotlinehq.online/fs_wss/';
        var sipDomain = '50.28.84.57';
        var password = config.password || config.defaultPassword || '12345678';

        var ua = null;
        var currentSession = null;
        var isMuted = true;
        var listenOnly = !!config.listenOnly;
        var monitorMode = !!config.monitorMode;
        var listenOnlySilentStream = null;
        var accountData = null;
        var clientToken = null;
        var lastLoginEmail = '';
        var lastLoginPassword = '';
        var loggingOut = false;
        var regRetryTimer = null;
        var callerIdSource = null;
        var callerIdReconnectAttempts = 0;
        var lastHeartbeat = Date.now();

        // ── 2. Utilities ──

        function generateMac(email) {
            try {
                var hash = 0;
                for (var i = 0; i < email.length; i++) {
                    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
                }
                var bytes = [];
                var h = Math.abs(hash);
                for (var i = 0; i < 6; i++) {
                    bytes.push(((h >> (i * 4)) & 0xFF).toString(16).padStart(2, '0'));
                }
                bytes[0] = (parseInt(bytes[0], 16) & 0xFE | 0x02).toString(16).padStart(2, '0');
                return bytes.join(':');
            } catch (e) {
                console.error('[SIP] generateMac error:', e.message);
                return '02:00:00:00:00:00';
            }
        }

        function getLocalStorageUserData() {
            try {
                var raw = localStorage.getItem("user_data");
                if (!raw) return null;
                var userData = JSON.parse(raw);
                var detail = userData.user_detail || {};
                var companyName = userData.parent_id ? userData.name : (detail.company_name || '');
                var repName = detail.representative_name || '';
                var phone = detail.company_phone || '';
                var formattedPhone = '';
                try {
                    var digits = phone.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
                    formattedPhone = !digits[2] ? digits[1] : '(' + digits[1] + ') ' + digits[2] + (digits[3] ? '-' + digits[3] : '');
                } catch (e) { formattedPhone = phone; }
                return {
                    email: userData.email || detail.email || '',
                    userId: userData.id,
                    username: companyName + ' / ' + repName,
                    companyName: companyName,
                    repName: repName,
                    phone: formattedPhone,
                    city: userData.parent_id ? userData.parent_city : (detail.city || ''),
                    room: localStorage.getItem("room") || '',
                    isSip: userData.is_sip,
                    userType: userData.user_type,
                };
            } catch (e) {
                console.warn('[SIP] Cannot read localStorage user_data:', e.message);
                return null;
            }
        }

        // ── 3. Callback Notifiers ──

        function notifyCallState(state) {
            try { if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState(state); } catch (e) { }
        }

        function notifyMuteState() {
            try { if (typeof window.onHotlineMuteState === 'function') window.onHotlineMuteState(isMuted); } catch (e) { }
        }

        function notifyListenOnly() {
            try { if (typeof window.onHotlineListenOnly === 'function') window.onHotlineListenOnly(true); } catch (e) { }
        }

        function notifyMonitorMode() {
            // Reports the CURRENT state — callers set monitorMode first, then notify.
            // Must be able to report false, or the UI can never exit monitor mode.
            try { if (typeof window.onHotlineMonitorMode === 'function') window.onHotlineMonitorMode(monitorMode); } catch (e) { }
        }

        function notifyError(type, err) {
            // Generic error channel: { type, status, code, message }. The host page
            // decides what to do (e.g. 401 on 'account_fetch' → redirect to login).
            try {
                if (typeof window.onHotlineError === 'function') {
                    window.onHotlineError({
                        type: type,
                        status: err.status || 0,
                        code: err.code || '',
                        message: err.message || '',
                    });
                }
            } catch (e) { }
        }

        function _httpError(r) {
            // Build an Error carrying HTTP status + server error body for notifyError
            return r.json().catch(function () { return {}; }).then(function (json) {
                var err = new Error(json.error || 'HTTP ' + r.status);
                err.status = r.status;
                err.code = json.code || '';
                throw err;
            });
        }

        function _notifyRoomChange(data) {
            // Keep the live session in sync — the server has already moved the
            // conference leg (kill + re-INVITE to the new room), so the SIP
            // session must NOT be torn down: just follow with our own room
            // bookkeeping and reconnect the caller-ID SSE to the new room.
            if (accountData && data.room) {
                accountData.current_room = data.room;
                startCallerIdSSE(data.room);
            }
            if (typeof window.onHotlineRoomChange === 'function') {
                window.onHotlineRoomChange(data);
            } else {
                window.location.reload();
            }
        }

        // ── 4. External Module Loaders ──

        function initExtensionModule(getToken) {
            function start() {
                window.RedlineDirectCall.configure({
                    apiBase: apiBase,
                    getToken: getToken,
                });
                if (config.extensionWidget === false) {
                    console.log('[SIP] Extension directory widget disabled via config');
                    window.RedlineExtensionDirectory.configure({ disabled: true });
                } else {
                    window.RedlineExtensionDirectory.configure({
                        apiBase: apiBase,
                        getToken: getToken,
                        getOwnExtension: function () { return accountData && accountData.extension; },
                        getUserEmail: function () { return accountData && accountData.email; },
                        visible: false,
                    });
                }
            }
            if (window.RedlineDirectCall) return start();
            if (document.getElementById('hotline_extensions_module')) return;
            var script = document.createElement('script');
            script.id = 'hotline_extensions_module';
            script.src = baseUrl + '/hotlinehq_extensions.js?v=' + Date.now();
            script.onload = start;
            document.head.appendChild(script);
        }

        function initPushNotifications(getToken) {
            function start() {
                window.RedlinePush.init({
                    apiBase: apiBase,
                    getToken: getToken,
                    prompt: config.pushPrompt !== false,
                });
            }
            if (window.RedlinePush) return start();
            if (document.getElementById('hotline_push_module')) return;
            var script = document.createElement('script');
            script.id = 'hotline_push_module';
            script.src = baseUrl + '/hotlinehq_push_notification.js?v=' + Date.now();
            script.onload = start;
            document.head.appendChild(script);
        }

        function initBroadcastFeed(getToken) {
            function start() {
                window.HotlineBroadcastFeed.configure({
                    apiBase: apiBase,
                    getToken: getToken,
                });
            }
            if (window.HotlineBroadcastFeed) return start();
            if (document.getElementById('hotline_broadcast_module')) return;
            var script = document.createElement('script');
            script.id = 'hotline_broadcast_module';
            script.src = baseUrl + '/hotlinehq_broadcast_feed.js?v=' + Date.now();
            script.onload = start;
            document.head.appendChild(script);
        }

        function startBroadcastFeed(room, options) {
            if (window.HotlineBroadcastFeed) window.HotlineBroadcastFeed.start(room, options);
        }

        function stopBroadcastFeed() {
            if (window.HotlineBroadcastFeed) window.HotlineBroadcastFeed.stop();
        }

        // ── 5. Audio Management ──

        var audioElement = null;
        var micStream = null;

        function ensureAudioElement() {
            if (audioElement) return audioElement;
            var container = document.getElementById("mixedaudio");
            if (!container) {
                container = document.createElement('div');
                container.id = 'mixedaudio';
                container.style.display = 'none';
                document.body.appendChild(container);
            }
            container.innerHTML = '<audio id="roomaudio" autoplay></audio>';
            audioElement = document.getElementById("roomaudio");
            return audioElement;
        }

        function attachRemoteAudio(session) {
            try {
                if (!session || !session.connection) return;
                var tracks = session.connection.getReceivers()
                    .filter(function (r) { return r.track && r.track.kind === 'audio'; })
                    .map(function (r) { return r.track; });
                console.log('[SIP] attachRemoteAudio: remote audio tracks:', tracks.length, 'listenOnly:', listenOnly);
                if (tracks.length > 0) {
                    var el = ensureAudioElement();
                    if (!el) return;
                    el.srcObject = new MediaStream(tracks);
                    el.play().catch(function (e) { console.error('[SIP] Audio play failed:', e.message); });
                }
            } catch (e) { console.error('[SIP] attachRemoteAudio error:', e.message); }
        }

        function muteAudio(mute) {
            try {
                if (!currentSession || !currentSession.connection) return;
                currentSession.connection.getSenders().forEach(function (sender) {
                    if (sender.track && sender.track.kind === 'audio') {
                        sender.track.enabled = !mute;
                    }
                });
            } catch (e) { }
        }

        function stopMicStream() {
            try {
                if (micStream) {
                    micStream.getTracks().forEach(function (t) { t.stop(); });
                    micStream = null;
                }
            } catch (e) { }
        }

        function releaseSessionMedia(session) {
            stopMicStream();
            if (!listenOnly) {
                try {
                    if (session && session.connection) {
                        session.connection.getSenders().forEach(function (s) {
                            if (s.track) s.track.stop();
                        });
                    }
                } catch (e) { }
            }
            try {
                if (audioElement) { audioElement.pause(); audioElement.srcObject = null; }
            } catch (e) { }
        }

        function _activateListenOnly() {
            try {
                var ctx = new (window.AudioContext || window.webkitAudioContext)();
                ctx.resume();
                var oscillator = ctx.createOscillator();
                var gain = ctx.createGain();
                gain.gain.value = 0;
                oscillator.connect(gain);
                var dest = ctx.createMediaStreamDestination();
                gain.connect(dest);
                oscillator.start();
                listenOnlySilentStream = dest.stream;
                console.log('[SIP] Listen-only activated, silent stream tracks:', listenOnlySilentStream.getAudioTracks().length);
            } catch (e) { console.error('[SIP] Silent stream creation failed:', e.message); }
            var el = ensureAudioElement();
            if (el) { el.play().catch(function () { }); }
        }

        // ── 6. Mic Permission ──

        var micPermissionModal = null;

        function showMicPermissionModal(mode) {
            if (micPermissionModal) return;
            var isBlocked = mode === 'denied';
            micPermissionModal = document.createElement('div');
            micPermissionModal.id = 'redline_mic_permission_modal';
            micPermissionModal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);';

            var iconHtml = '<div style="width:56px;height:56px;margin:0 auto 16px;border-radius:16px;background:#fef2f2;display:flex;align-items:center;justify-content:center;">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="1" y1="1" x2="23" y2="23"/>' +
                '<path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>' +
                '<path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.48-.35 2.15"/>' +
                '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' +
                '</svg></div>';

            var blockedStepsHtml =
                '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:16px;text-align:left;">' +
                '<div style="font-size:13px;font-weight:700;color:#b91c1c;margin-bottom:8px;">Microphone is blocked. To fix:</div>' +
                '<div style="font-size:12px;color:#64748b;line-height:1.8;">' +
                '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:2px;"><span style="font-weight:700;color:#334155;">1.</span> Click the lock icon in your browser address bar (top left)</div>' +
                '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:2px;"><span style="font-weight:700;color:#334155;">2.</span> Find <strong>Microphone</strong> and change to <strong style="color:#16a34a;">Allow</strong></div>' +
                '<div style="display:flex;align-items:flex-start;gap:8px;"><span style="font-weight:700;color:#334155;">3.</span> Refresh the page</div>' +
                '</div></div>';

            var buttonsHtml =
                '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
                '<button id="redline_mic_refresh" style="border:0;border-radius:12px;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;font-size:13px;font-weight:700;padding:10px 24px;cursor:pointer;box-shadow:0 8px 20px rgba(225,29,46,.3);">Refresh Page</button>' +
                '<button id="redline_mic_listen_only" style="border:0;border-radius:12px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:13px;font-weight:700;padding:10px 24px;cursor:pointer;box-shadow:0 6px 16px rgba(37,99,235,.25);">Listen Only</button>' +
                '</div>' +
                '<div style="font-size:11px;color:#9ca3af;margin-top:10px;">Listen Only: hear the broadcast without a microphone</div>';

            micPermissionModal.innerHTML =
                '<div style="width:min(400px,calc(100vw - 40px));background:#fff;border-radius:20px;padding:32px 28px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3);">' +
                iconHtml +
                '<div style="font-size:18px;font-weight:800;color:#111827;margin-bottom:8px;">' + (isBlocked ? 'Microphone Blocked' : 'Microphone Access Required') + '</div>' +
                '<div style="font-size:14px;color:#6b7280;line-height:1.5;margin-bottom:20px;">' +
                (isBlocked ? 'Your browser has blocked microphone access. Follow the steps below to enable it, or listen without a mic.' : 'Hotline HQ needs microphone access to connect you to the conference.') +
                '</div>' +
                (isBlocked ? blockedStepsHtml : '') +
                buttonsHtml +
                '</div>';

            document.body.appendChild(micPermissionModal);
            document.getElementById('redline_mic_refresh').onclick = function () { window.location.reload(); };
            document.getElementById('redline_mic_listen_only').onclick = function () {
                listenOnly = true;
                _activateListenOnly();
                hideMicPermissionModal();
                var email = accountData && accountData.email;
                if (email) _startSipRegistration(email, accountData.sip_password || password);
            };
        }

        function hideMicPermissionModal() {
            if (micPermissionModal) {
                micPermissionModal.remove();
                micPermissionModal = null;
            }
        }

        async function checkMicPermission() {
            var permState = 'unknown';
            try {
                var perm = await navigator.permissions.query({ name: 'microphone' });
                permState = perm.state;
            } catch (e) { permState = 'unknown'; }

            if (permState === 'denied') {
                console.warn('[SIP] Microphone permanently blocked by browser');
                showMicPermissionModal('denied');
                return false;
            }

            try {
                var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(function (t) { t.stop(); });
                hideMicPermissionModal();
                return true;
            } catch (err) {
                console.warn('[SIP] getUserMedia failed:', err.name, err.message);
                if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
                    console.warn('[SIP] No microphone hardware — entering listen-only');
                    listenOnly = true;
                    _activateListenOnly();
                    return 'listen-only';
                }
                try {
                    var devicesAfter = await navigator.mediaDevices.enumerateDevices();
                    var realMics = devicesAfter.filter(function (d) {
                        return d.kind === 'audioinput' && d.deviceId && d.deviceId !== '';
                    });
                    var allPhantom = realMics.every(function (d) { return d.label === ''; }) && permState !== 'granted';
                    if (realMics.length === 0 || allPhantom) {
                        console.warn('[SIP] No real microphone found after secondary check — entering listen-only');
                        listenOnly = true;
                        _activateListenOnly();
                        return 'listen-only';
                    }
                } catch (e2) { }
                console.error('[SIP] Microphone permission denied:', err.message);
                showMicPermissionModal('denied');
                return false;
            }
        }

        // ── 7. CallerID SSE ──

        function startCallerIdSSE(room) {
            stopCallerIdSSE();
            callerIdReconnectAttempts = 0;
            connectCallerIdSSE(room);
        }

        function connectCallerIdSSE(room) {
            try {
                callerIdSource = new EventSource(apiBase + '/api/v1/client/events/room/' + room + (clientToken ? '?token=' + clientToken : ''));

                callerIdSource.onopen = function () {
                    callerIdReconnectAttempts = 0;
                };

                callerIdSource.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                        if (data.type && data.type.indexOf('direct_call_') === 0) {
                            if (window.RedlineDirectCall) window.RedlineDirectCall.handleEvent(data);
                            return;
                        }
                        if (data.type === 'monitor_mode') {
                            console.log('[SIP] Monitor mode — Yealink reclaimed, switching to monitor');
                            monitorMode = true;
                            hangup();
                            if (ua) { try { ua.unregister(); ua.stop(); } catch (e) { } ua = null; }
                            stopMicStream();
                            notifyMonitorMode();
                            notifyCallState('connected');
                            return;
                        }
                        if (data.type === 'device_status') {
                            // Live Yealink registration status for the panel indicator
                            if (accountData) accountData.yealink_online = data.yealink_online ? 1 : 0;
                            if (typeof window.onHotlineDeviceStatus === 'function') {
                                try { window.onHotlineDeviceStatus(data); } catch (e) { }
                            }
                            return;
                        }
                        if (data.type === 'yealink_lost') {
                            // Yealink went away — server is waiting for the user to
                            // choose web takeover (modal in the dashboard) instead of
                            // auto-falling back.
                            console.log('[SIP] Yealink lost — server waiting for takeover choice:', data.reason || '');
                            if (accountData) accountData.yealink_online = 0;
                            if (typeof window.onHotlineYealinkLost === 'function') {
                                try { window.onHotlineYealinkLost(data); } catch (e) { }
                            }
                            return;
                        }
                        if (data.type === 'yealink_available') {
                            // Yealink came back while this browser holds the call with
                            // takeover ON — dashboard offers "release to phone".
                            console.log('[SIP] Yealink available again — release offer');
                            if (accountData) accountData.yealink_online = 1;
                            if (typeof window.onHotlineYealinkAvailable === 'function') {
                                try { window.onHotlineYealinkAvailable(data); } catch (e) { }
                            }
                            return;
                        }
                        if (data.type === 'exit_monitor') {
                            // Reverse of monitor_mode: the Yealink went away and no
                            // registration survives (monitor mode unregistered us).
                            // Wake up and register; the server then moves the call here.
                            if (!monitorMode || ua) return;
                            console.log('[SIP] Exit monitor — server requested web fallback:', data.reason || '');
                            monitorMode = false;
                            notifyMonitorMode();
                            if (lastLoginEmail) {
                                checkMicPermission().then(function (result) {
                                    if (result === true || result === 'listen-only') {
                                        _startSipRegistration(lastLoginEmail, lastLoginPassword);
                                    } else {
                                        console.warn('[SIP] exit_monitor: mic permission denied — SIP registration skipped');
                                    }
                                });
                            }
                            return;
                        }
                        if (data.type === 'user_logout') {
                            console.warn('[SIP] Logged out:', data.reason);
                            if (typeof window.onHotlineUserLogout === 'function') {
                                window.onHotlineUserLogout(data);
                            }
                            logout();
                            return;
                        }
                        if (data.type === 'kickout') {
                            if (accountData) accountData.kickout = data.kickout ? 1 : 0;
                            if (data.kickout) {
                                console.warn('[SIP] Kicked out:', data.reason || '');
                                hangup();
                            } else {
                                console.log('[SIP] Kickout lifted:', data.reason || '');
                            }
                            if (typeof window.onHotlineKickout === 'function') {
                                window.onHotlineKickout(data);
                            }
                            return;
                        }
                        if (data.type === 'user_refresh') {
                            var refreshEmail = accountData && accountData.email;
                            if (!data.email || !refreshEmail || data.email === refreshEmail) {
                                console.log('[Hotline] User refresh requested:', data.reason || '');
                                if (typeof window.onHotlineUserRefresh === 'function') {
                                    window.onHotlineUserRefresh(data);
                                } else {
                                    window.location.reload();
                                }
                            }
                            return;
                        }
                        if (data.type === 'room_change') {
                            var myEmail = accountData && accountData.email;
                            if (myEmail && data.email === myEmail) {
                                console.log("[SIP] Own room changed to", data.toRoom);
                                _notifyRoomChange({ source: 'sse', room: data.toRoom, roomName: data.toRoomName, direction: data.direction });
                                return;
                            }
                        }
                        if (data.ts && window._muteToggleAt) {
                            console.log('[TIMING] Ctrl+L -> callerID rendered: +' + (Date.now() - window._muteToggleAt) + 'ms (server emit -> browser: +' + (Date.now() - data.ts) + 'ms)');
                            window._muteToggleAt = null;
                        }
                        if (typeof window.onCallerIdUpdate === 'function') {
                            window.onCallerIdUpdate(data);
                        }
                        var grid = document.getElementById('caller_grid');
                        if (grid && data.callerIdHtml) {
                            grid.innerHTML = (data.callerIdHtml || []).join('');
                        }
                    } catch (e) { }
                };

                callerIdSource.onerror = function () {
                    try { if (callerIdSource) { callerIdSource.close(); callerIdSource = null; } } catch (e) { }
                    if (loggingOut || !accountData) return;
                    callerIdReconnectAttempts++;
                    var delay = Math.min(1000 * Math.pow(2, callerIdReconnectAttempts), 30000);
                    setTimeout(function () { if (!loggingOut && accountData) connectCallerIdSSE(room); }, delay);
                };
            } catch (e) {
                console.error('[CallerID] Connect error:', e.message);
                callerIdReconnectAttempts++;
                var delay = Math.min(1000 * Math.pow(2, callerIdReconnectAttempts), 30000);
                setTimeout(function () { if (!loggingOut && accountData) connectCallerIdSSE(room); }, delay);
            }
        }

        function stopCallerIdSSE() {
            try {
                if (callerIdSource) { callerIdSource.close(); callerIdSource = null; }
                var grid = document.getElementById('caller_grid');
                if (grid) grid.innerHTML = '';
            } catch (e) {
                console.error('[CallerID] Stop error:', e.message);
            }
        }

        // ── 8. SIP Registration ──

        function _startSipRegistration(email, password) {
            try {
                if (typeof JsSIP === 'undefined') return;

                var sipUser = email.replace('@', '.at.');
                var mac = generateMac(email);

                try { JsSIP.debug.enable('JsSIP:*'); } catch (e) { }

                var socket;
                try {
                    socket = new JsSIP.WebSocketInterface(wsServer);
                } catch (e) { return; }

                ua = new JsSIP.UA({
                    sockets: [socket],
                    uri: 'sip:' + sipUser + '@' + sipDomain,
                    password: password,
                    display_name: email,
                    register: true,
                    register_expires: 120,
                    session_timers: false,
                    connection_recovery_min_interval: 2,
                    connection_recovery_max_interval: 30,
                    user_agent: 'Redline-WebClient/1.0 ' + mac,
                    contact_uri: 'sip:' + email.split('@')[0] + '@' + sipDomain + ';transport=ws',
                });

                ua.on('registered', function () {
                    console.log('[SIP] Registered:', email);
                    if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }
                });

                ua.on('registrationFailed', function (e) {
                    try {
                        var cause = e.cause || 'unknown';
                        console.error('[SIP] Registration failed:', cause);
                        if (cause === 'Rejected' || cause === 'Forbidden') {
                            if (ua) { ua.stop(); ua = null; }
                            return;
                        }
                        if (!regRetryTimer && ua) {
                            regRetryTimer = setInterval(function () {
                                try {
                                    if (!ua) { clearInterval(regRetryTimer); regRetryTimer = null; return; }
                                    if (ua.isRegistered()) { clearInterval(regRetryTimer); regRetryTimer = null; return; }
                                    console.log('[SIP] Retry REGISTER');
                                    ua.register();
                                } catch (err) {
                                    console.error('[SIP] Registration retry error:', err.message);
                                }
                            }, 30000);
                        }
                    } catch (err) {
                        console.error('[SIP] registrationFailed handler error:', err);
                    }
                });

                ua.on('unregistered', function () { if (!loggingOut) console.warn('[SIP] Unregistered'); });
                ua.on('disconnected', function () { if (!loggingOut) console.warn('[SIP] WebSocket disconnected'); });
                ua.on('connected', function () { console.log('[SIP] WebSocket connected'); });
                ua.on('newMessage', function (data) { try { if (data.originator === 'remote') data.message.accept(); } catch (e) { } });

                ua.on('newRTCSession', function (data) {
                    try {
                        if (data.originator === 'remote') {
                            var session = data.session;
                            session.on('peerconnection', function (pcData) {
                                try { pcData.peerconnection.ontrack = function () { attachRemoteAudio(session); }; } catch (e) { }
                            });
                            session.on('accepted', function () {
                                try {
                                    currentSession = session;
                                    isMuted = true;
                                    if (!listenOnly) muteAudio(true);
                                    attachRemoteAudio(session);
                                    if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(true);
                                    notifyMuteState();
                                    notifyCallState('connected');
                                    if (listenOnly) notifyListenOnly();
                                } catch (e) { }
                            });
                            session.on('failed', function () {
                                releaseSessionMedia(session);
                                currentSession = null;
                                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                                notifyCallState('disconnected');
                            });
                            session.on('ended', function () {
                                releaseSessionMedia(session);
                                currentSession = null;
                                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                                notifyCallState('disconnected');
                            });
                            if (listenOnly && listenOnlySilentStream) {
                                console.log('[SIP] Listen-only: answering with pre-created silent stream');
                                session.answer({
                                    mediaStream: listenOnlySilentStream,
                                    pcConfig: { iceServers: [{ urls: "stun:74.125.250.129:19302" }] },
                                });
                            } else {
                                navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
                                    if (session.isEnded()) {
                                        stream.getTracks().forEach(function (t) { t.stop(); });
                                        return;
                                    }
                                    stopMicStream();
                                    micStream = stream;
                                    session.answer({
                                        mediaStream: stream,
                                        pcConfig: { iceServers: [{ urls: "stun:74.125.250.129:19302" }] },
                                    });
                                }).catch(function (err) {
                                    console.error('[SIP] getUserMedia failed:', err.message);
                                    try { session.terminate({ status_code: 480 }); } catch (e2) { }
                                });
                            }
                        }
                    } catch (e) { }
                });

                console.log('[SIP] Starting UA, server:', wsServer, 'user:', sipUser);
                ua.start();
            } catch (e) {
                console.error('[SIP] SIP registration error:', e);
            }
        }

        // ── 9. Login Flow ──

        function _onLoginSuccess(email, password) {
            lastLoginEmail = email;
            lastLoginPassword = password;
            var lsData = getLocalStorageUserData();

            if (!accountData.room && lsData && lsData.room) {
                accountData.room = lsData.room;
            }
            if (lsData) {
                if (!accountData.display_name && lsData.repName) accountData.display_name = lsData.repName;
                if (!accountData.company_name && lsData.companyName) accountData.company_name = lsData.companyName;
                accountData._lsData = lsData;
            }

            if (!accountData.room) {
                console.error('[SIP] Account has no room:', accountData);
                return;
            }

            var activeRoom = accountData.current_room || accountData.room;
            console.log('[SIP] Login OK:', accountData.display_name, 'Room:', activeRoom);

            // Start SSE + modules
            var getToken = function () { return clientToken; };
            startCallerIdSSE(activeRoom);
            if (config.extensions !== false) initExtensionModule(getToken);
            if (config.pushNotifications === true) initPushNotifications(getToken);
            if (config.broadcastFeed === true) initBroadcastFeed(getToken);

            // Monitor mode: set via config or auto-detected when Yealink already connected
            // Skip monitor mode if web_takeover is active — web should SIP register
            if (accountData.web_takeover) {
                monitorMode = false;
                console.log('[SIP] web_takeover active — skipping monitor mode, will SIP register');
            } else if (!monitorMode && accountData.connection_state === 'connected' && accountData.client_type === 'yealink') {
                monitorMode = true;
                notifyMonitorMode();
                console.log('[SIP] Monitor mode — Yealink already connected, SSE only');
            } else if (monitorMode) {
                notifyMonitorMode();
                console.log('[SIP] Monitor mode — set via config, SSE only');
            }

            if (typeof window.onHotlineReady === 'function') {
                window.onHotlineReady(accountData);
            }

            // Decide SIP path
            if (monitorMode) {
                notifyCallState('connected');
            } else if (listenOnly) {
                console.log('[SIP] Listen-only mode — skipping mic check');
                _startSipRegistration(email, password);
            } else {
                checkMicPermission().then(function (result) {
                    if (result === true || result === 'listen-only') {
                        _startSipRegistration(email, password);
                    } else {
                        console.warn('[SIP] Mic permission denied — SIP registration skipped, listen-only available via modal');
                    }
                });
            }
        }

        function doLogin(emailArg) {
            // Token mode: skip POST /login, fetch account via GET /account
            if (config.token) {
                console.log('[SIP] Token mode — skipping login API, fetching account');
                clientToken = config.token;
                fetch(apiBase + '/api/v1/client/account', {
                    headers: { 'Authorization': 'Bearer ' + clientToken },
                })
                    .then(function (r) {
                        if (!r.ok) return _httpError(r);
                        return r.json();
                    })
                    .then(function (json) {
                        accountData = json.data || json;
                        var sipPassword = accountData.sip_password || password;
                        _onLoginSuccess(accountData.email || '', sipPassword);
                    })
                    .catch(function (e) {
                        console.error('[SIP] Account fetch failed:', e.message);
                        notifyError('account_fetch', e);
                        if (typeof window.onHotlineLoginFailed === 'function') {
                            window.onHotlineLoginFailed(e.message);
                        }
                    });
                return;
            }

            // Normal mode: authenticate with email + password
            var lsData = getLocalStorageUserData();
            var email = emailArg || (lsData && lsData.email) || '';

            if (!email) {
                console.error('[SIP] No email provided and none found in localStorage');
                return;
            }

            console.log('[SIP] Logging in:', email);
            fetch(apiBase + '/api/v1/client/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password }),
            })
                .then(function (r) {
                    if (!r.ok) return _httpError(r);
                    return r.json();
                })
                .then(function (json) {
                    clientToken = json.token;
                    accountData = json.data || json;
                    var sipPassword = accountData.sip_password || password;
                    _onLoginSuccess(email, sipPassword);
                })
                .catch(function (e) {
                    console.error('[SIP] Login failed:', e.message);
                    notifyError('login', e);
                    if (typeof window.onHotlineLoginFailed === 'function') {
                        window.onHotlineLoginFailed(e.message);
                    }
                });
        }

        // ── 10. Room API ──

        function getRoomDetails() {
            if (!clientToken) { console.error('[SIP] getRoomDetails: not logged in'); return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/rooms/details', {
                headers: { 'Authorization': 'Bearer ' + clientToken },
            })
                .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json.data; }); });
        }

        function changeRoom(newRoomId) {
            if (!clientToken) { console.error('[SIP] changeRoom: not logged in'); return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/room/change', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                body: JSON.stringify({ room: newRoomId }),
            })
                .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); })
                .then(function (json) {
                    console.log('[SIP] Room changed to', json.room, json.roomName);
                    _notifyRoomChange({ source: 'api', room: json.room, roomName: json.roomName });
                    return json;
                });
        }

        function requestRoom(data) {
            if (!clientToken) { console.error('[SIP] requestRoom: not logged in'); return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/room-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                body: JSON.stringify(data),
            })
                .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); });
        }

        // ── 11. Actions ──

        function toggleMute() {
            try {
                if (listenOnly || monitorMode) return;
                isMuted = !isMuted;
                muteAudio(isMuted);
                notifyMuteState();
                if (!accountData || !clientToken) return;
                var muteUrl = apiBase + '/api/v1/client/' + (isMuted ? 'mute' : 'unmute');
                fetch(muteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                }).catch(function (e) { console.error('[MUTE] Failed:', e.message); });
            } catch (e) {
                console.error('[SIP] toggleMute error:', e.message);
            }
        }

        function hangup() {
            try {
                if (currentSession) { currentSession.terminate(); currentSession = null; }
                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                notifyCallState('disconnected');
            } catch (e) {
                console.error('[SIP] hangup error:', e.message);
            }
        }

        function logout() {
            try {
                loggingOut = true;
                stopCallerIdSSE();
                stopBroadcastFeed();
                if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }
                hangup();
                if (ua) { try { ua.unregister(); ua.stop(); } catch (e) { } ua = null; }
                stopMicStream();
                accountData = null;
                loggingOut = false;
                console.log('[SIP] Logged out');
            } catch (e) {
                console.error('[SIP] logout error:', e.message);
                loggingOut = false;
            }
        }

        // ── 11b. Web Takeover ──
        // takeOver(): enable web_takeover — this browser gets device priority.
        // The server hard-switches immediately if we're already SIP-registered;
        // otherwise our registration right after triggers the switch server-side.
        // releaseTakeover(): Yealink regains priority. If the server moves the
        // call back to the phone it sends a monitor_mode SSE, which unregisters
        // the UA and flips the UI to monitor mode (existing handler).

        function notifyTakeoverState() {
            if (typeof window.onHotlineTakeoverState === 'function') {
                try { window.onHotlineTakeoverState(!!(accountData && accountData.web_takeover)); } catch (e) { }
            }
        }

        function takeOver() {
            if (!clientToken) { return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/web_takeover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
            })
                .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); })
                .then(function (json) {
                    console.log('[SIP] Web takeover enabled');
                    if (accountData) accountData.web_takeover = 1;
                    monitorMode = false;
                    notifyMonitorMode();
                    notifyTakeoverState();
                    if (!ua && lastLoginEmail) {
                        checkMicPermission().then(function (result) {
                            if (result === true || result === 'listen-only') {
                                _startSipRegistration(lastLoginEmail, lastLoginPassword);
                            } else {
                                console.warn('[SIP] takeover: mic permission denied — SIP registration skipped');
                            }
                        });
                    }
                    return json;
                });
        }

        function releaseTakeover() {
            if (!clientToken) { return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/web_takeover', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
            })
                .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); })
                .then(function (json) {
                    console.log('[SIP] Web takeover released', json.switched_to_yealink ? '(call moved to Yealink)' : '(web keeps call — Yealink offline)');
                    if (accountData) accountData.web_takeover = 0;
                    notifyTakeoverState();
                    return json;
                });
        }

        // ── 12. Push-to-Talk + Keyboard Shortcuts ──
        // Shared tap-vs-hold logic, used by the Space bar here and by the mobile
        // PTT bar in the dashboard (via hotlineClient.pttStart/pttEnd):
        //   quick press (<300ms) = toggle mute (like Ctrl+L)
        //   longer press         = push-to-talk (live only while held)

        var PTT_TAP_TOGGLE_MS = 300;
        var _pttActive = false;
        var _pttStartAt = 0;
        var _pttWasMuted = false;

        function pttStart() {
            if (listenOnly || monitorMode || !accountData) return;
            if (_pttActive) return;
            _pttActive = true;
            _pttStartAt = Date.now();
            _pttWasMuted = isMuted;
            if (isMuted) toggleMute();
        }

        function pttEnd() {
            if (!_pttActive) return;
            _pttActive = false;
            var heldMs = Date.now() - _pttStartAt;
            if (heldMs < PTT_TAP_TOGGLE_MS) {
                // Tap = toggle. Was muted: keep the unmute from pttStart.
                // Was already live: a tap means mute now.
                if (!_pttWasMuted) toggleMute();
            } else {
                // Hold = push-to-talk: restore mute on release.
                if (_pttWasMuted && !isMuted) toggleMute();
            }
        }

        var _spaceHeld = false;
        try {
            document.addEventListener('keydown', function (e) {
                try {
                    if (e.ctrlKey && e.key === 'l') {
                        e.preventDefault();
                        if (listenOnly || monitorMode) return;
                        window._muteToggleAt = Date.now();
                        console.log('[TIMING] Ctrl+L pressed — ' + (isMuted ? 'unmuting' : 'muting'));
                        if (accountData) toggleMute();
                        return;
                    }
                    if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        var tag = e.target.tagName;
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
                        e.preventDefault();
                        if (listenOnly || monitorMode || !accountData) return;
                        _spaceHeld = true;
                        pttStart();
                    }
                } catch (err) { }
            });
            document.addEventListener('keyup', function (e) {
                try {
                    if (e.code === 'Space' && _spaceHeld) {
                        e.preventDefault();
                        _spaceHeld = false;
                        pttEnd();
                    }
                } catch (err) { }
            });
        } catch (e) { }

        // ── 13. Sleep/Wake Detection ──

        setInterval(function () {
            try {
                var now = Date.now();
                if (now - lastHeartbeat > 15000 && ua && !loggingOut) {
                    try {
                        ua.stop();
                        setTimeout(function () { if (!loggingOut && ua) ua.start(); }, 1000);
                    } catch (e) { }
                }
                lastHeartbeat = now;
            } catch (e) { }
        }, 5000);

        // ── 14. Public API ──

        window.hotlineClient = {
            login: doLogin,
            logout: logout,
            reconnect: function () { callerIdReconnectAttempts = 0; var r = accountData && (accountData.current_room || accountData.room); if (r) startCallerIdSSE(r); },
            disconnect: stopCallerIdSSE,
            toggleMute: toggleMute,
            pttStart: pttStart,                                           // press: tap(<300ms)=toggle, hold=push-to-talk
            pttEnd: pttEnd,                                               // release: completes the tap/hold decision
            hangup: hangup,
            getRoom: function () { return accountData && (accountData.current_room || accountData.room) || ''; },
            getRoomDetails: getRoomDetails,
            changeRoom: changeRoom,
            requestRoom: requestRoom,
            getAccount: function () { return accountData; },
            getToken: function () { return clientToken; },
            getLocalData: getLocalStorageUserData,
            isConnected: function () { return monitorMode || !!currentSession; },
            isMuted: function () { return isMuted; },
            isListenOnly: function () { return listenOnly; },
            isMonitorMode: function () { return monitorMode; },
            takeOver: takeOver,                                           // enable web_takeover: browser gets device priority
            releaseTakeover: releaseTakeover,                             // disable: Yealink regains priority
            isWebTakeover: function () { return !!(accountData && accountData.web_takeover); },
            startBroadcastFeed: startBroadcastFeed,
            stopBroadcastFeed: stopBroadcastFeed,
            getBroadcasts: function (room, options) { return window.HotlineBroadcastFeed ? window.HotlineBroadcastFeed.getBroadcasts(room, options) : Promise.reject(new Error('Broadcast feed not loaded. Set broadcastFeed: true in config.')); },
            enablePush: function () { return window.RedlinePush ? window.RedlinePush.enable() : Promise.reject(new Error('Push module not loaded')); },
            disablePush: function () { return window.RedlinePush ? window.RedlinePush.disable() : Promise.resolve(false); },
        };

        // ── 15. Auto-Login ──

        try {
            var lsAutoData = getLocalStorageUserData();
            var autoEmail = (lsAutoData && lsAutoData.email) || config.email || '';
            console.log('[SIP] auto-login email:', autoEmail, lsAutoData ? '(localStorage)' : '(config)');
            if (autoEmail) {
                doLogin(autoEmail);
            } else {
                console.warn('[SIP] No email found in localStorage or config, skipping auto-login');
            }
        } catch (e) {
            console.warn('[SIP] auto-login failed:', e.message);
        }

    } // end init()

    init();
})();
