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
//   <script type="module" src="https://hotline.redlineusedautoparts.com/redline_sip_client.js"></script>
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
//     wsServer: '',              // WebSocket URL for SIP (default: wss://hotline.redlineusedautoparts.com/fs_wss/)
//     apiBase: '',               // API base URL (default: https://hotline.redlineusedautoparts.com/fs/)
//     baseUrl: '',               // origin serving the shared helper scripts (redline_push.js,
//                                // redline_extensions.js); default: https://hotline.redlineusedautoparts.com
//     defaultPassword: '12345678', // SIP password (also used for /client/login)
//     directCallAnswerButton: false // set true to show Answer button for incoming direct calls
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
//   window.onHotlineBroadcastConnected = function(data) { ... }        // { type:'connected', data:[...], total, page, pageSize, totalPages }
//   window.onHotlineBroadcast = function(data) { ... }                 // { type:'broadcast', data:{...broadcast row...}, ts }
//   window.updateOnlineCounts = function(onlineMap) { ... }            // { roomId: count, ... }
//   window.onCallerIdUpdate = function(callerIdHtml) { ... }           // raw caller ID HTML array
//
// MANUAL CONTROL (if needed):
//   window.hotlineClient.login('email@example.com')               // login with specific email
//   window.hotlineClient.logout()                                 // disconnect everything
//   window.hotlineClient.reconnect()                              // force reconnect SSE
//   window.hotlineClient.disconnect()                             // stop SSE and clear grid
//   window.hotlineClient.toggleMute()                             // Ctrl+L equivalent
//   window.hotlineClient.joinConference()                         // request server to call this user
//   window.hotlineClient.hangup()                                 // end current call
//   window.hotlineClient.getRoom()                                // get current room
//   window.hotlineClient.getRoomDetails()                         // get all rooms with online counts
//   window.hotlineClient.changeRoom(roomId)                       // switch to a different room (reloads page)
//   window.hotlineClient.requestRoom({ city, state, message })    // request a new room
//   window.hotlineClient.getAccount()                             // get loaded account data
//   window.hotlineClient.getToken()                               // get current JWT token
//   window.hotlineClient.startBroadcastFeed(room, {answered})     // start broadcast SSE (room optional)
//   window.hotlineClient.stopBroadcastFeed()                      // stop broadcast SSE
//   window.hotlineClient.getBroadcasts(room, {page,pageSize,answered,dateFrom,dateTo})  // REST fetch
//   window.hotlineClient.isConnected()                            // true if in active call
//   window.hotlineClient.isMuted()                                // true if muted
//   window.RedlineExtensionDirectory.open()                       // open extension search
//
// SSE EVENTS HANDLED:
//   callerid      — caller ID HTML + online counts
//   online_update — online/offline count changes
//   room_change   — user changed room (auto-reloads if current user)
//   direct_call_* — incoming/outgoing direct call notifications
//
// ═══════════════════════════════════════════════════════════════════════════

import "./jssip.bundle.js";

(function () {

    function init() {
        console.log('[SIP] init() called');
        var config = window.HOTLINE_CONFIG || {};
        // Origin hosting the shared helper scripts (redline_push.js, redline_extensions.js)
        var baseUrl = (config.baseUrl || 'https://hotline.redlineusedautoparts.com').replace(/\/$/, '');
        var apiBase = config.apiBase || 'https://hotline.redlineusedautoparts.com/fs';
        var wsServer = config.wsServer || 'wss://hotline.redlineusedautoparts.com/fs_wss/';
        var sipDomain = '50.28.84.57';
        var defaultPassword = config.defaultPassword || '12345678';
        if (config.listenOnly) listenOnly = true;

        var ua = null;
        var currentSession = null;
        var isMuted = true;
        var listenOnly = false;
        var listenOnlySilentStream = null;
        var accountData = null;
        var clientToken = null;
        var loggingOut = false;
        var regRetryTimer = null;
        var callerIdSource = null;
        var lastHeartbeat = Date.now();
        var callerIdReconnectAttempts = 0;

        function notifyCallState(state) {
            try {
                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState(state);
            } catch (e) { }
        }

        function notifyMuteState() {
            try {
                if (typeof window.onHotlineMuteState === 'function') window.onHotlineMuteState(isMuted);
            } catch (e) { }
        }

        function notifyListenOnly() {
            try {
                if (typeof window.onHotlineListenOnly === 'function') window.onHotlineListenOnly(true);
            } catch (e) { }
        }

        // ── Sleep/wake detection ──
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

        // ── Read user data from localStorage (production Vue app) ──
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

        // Extension directory + direct-call UI live in the shared module redline_extensions.js
        function initExtensionModule(cb) {
            if (window.RedlineDirectCall) return cb();
            var script = document.getElementById('redline_extensions_module');
            if (!script) {
                script = document.createElement('script');
                script.id = 'redline_extensions_module';
                script.src = baseUrl + '/redline_extensions.js';
                document.head.appendChild(script);
            }
            script.addEventListener('load', function () { if (window.RedlineDirectCall) cb(); });
        }

        initExtensionModule(function () {
            window.RedlineDirectCall.configure({
                apiBase: apiBase,
                getToken: function () { return clientToken; },
            });
            if (config.extensionWidget === false) {
                console.log('[SIP] Extension directory widget disabled via config');
            } else window.RedlineExtensionDirectory.configure({
                apiBase: apiBase,
                getToken: function () { return clientToken; },
                getOwnExtension: function () { return accountData && accountData.extension; },
                getUserEmail: function () { return accountData && accountData.email; },
                visible: false,
            });
        });

        // ── Mic permission check ──
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
                if (email) _startSipRegistration(email, defaultPassword);
            };
        }

        function hideMicPermissionModal() {
            if (micPermissionModal) {
                micPermissionModal.remove();
                micPermissionModal = null;
            }
        }

        async function checkMicPermission() {
            try {
                var devices = await navigator.mediaDevices.enumerateDevices();
                var hasMic = devices.some(function (d) { return d.kind === 'audioinput'; });
                if (!hasMic) {
                    console.warn('[SIP] No microphone detected on this device');
                    listenOnly = true;
                    _activateListenOnly();
                    return 'listen-only';
                }
            } catch (e) { }

            // Check permission state without triggering prompt
            var permState = 'unknown';
            try {
                var perm = await navigator.permissions.query({ name: 'microphone' });
                permState = perm.state; // 'granted', 'denied', or 'prompt'
            } catch (e) { permState = 'unknown'; }

            if (permState === 'denied') {
                console.warn('[SIP] Microphone permanently blocked by browser');
                showMicPermissionModal('denied');
                return false;
            }

            // 'granted' or 'prompt' or 'unknown' — try getUserMedia
            try {
                var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(function (t) { t.stop(); });
                hideMicPermissionModal();
                return true;
            } catch (err) {
                console.error('[SIP] Microphone permission denied:', err.message);
                showMicPermissionModal('denied');
                return false;
            }
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
            if (el) { el.play().catch(function () {}); }
        }

        // Direct-call banner + handlers live in redline_extensions.js (RedlineDirectCall)
        function handleDirectCallEvent(data) {
            if (!data || !data.type || data.type.indexOf('direct_call_') !== 0) return false;
            if (window.RedlineDirectCall) window.RedlineDirectCall.handleEvent(data);
            return true;
        }

        // ── CallerID SSE ──
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
                        if (handleDirectCallEvent(data)) return;
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
                        if (typeof window._onCallerIdData === 'function') {
                            window._onCallerIdData(data);
                        }
                        var grid = document.getElementById('caller_grid');
                        if (grid && data.callerIdHtml) {
                            grid.innerHTML = (data.callerIdHtml || []).join('');
                        }
                        if (data.online && typeof window.updateOnlineCounts === 'function') {
                            window.updateOnlineCounts(data.online);
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

        // ── Audio ──
        var audioElement = null;

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

        // ── Push notifications (shared module: redline_push.js) ──
        function initPushNotifications(getToken) {
            if ((window.HOTLINE_CONFIG || {}).push === false) return;
            function start() {
                window.RedlinePush.init({
                    apiBase: apiBase,
                    getToken: getToken,
                    prompt: (window.HOTLINE_CONFIG || {}).pushPrompt !== false,
                });
            }
            if (window.RedlinePush) return start();
            if (document.getElementById('redline_push_module')) return;
            var script = document.createElement('script');
            script.id = 'redline_push_module';
            script.src = baseUrl + '/redline_push.js';
            script.onload = start;
            document.head.appendChild(script);
        }

        // ── SIP ──
        function doLogin(emailArg) {
            var lsData = getLocalStorageUserData();
            var email = emailArg || (lsData && lsData.email) || '';
            var password = defaultPassword;

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
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (json) {
                clientToken = json.token;
                accountData = json.data || json;

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
                startCallerIdSSE(activeRoom);
                initPushNotifications(function () { return clientToken; });

                if (typeof window.onHotlineReady === 'function') {
                    window.onHotlineReady(accountData);
                }

                if (listenOnly) {
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
            })
            .catch(function (e) {
                console.error('[SIP] Login failed:', e.message);
                if (typeof window.onHotlineLoginFailed === 'function') {
                    window.onHotlineLoginFailed(e.message);
                }
            });
        }

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

                ua.on('unregistered', function () {
                    if (loggingOut) return;
                    console.warn('[SIP] Unregistered');
                });

                ua.on('disconnected', function () {
                    if (loggingOut) return;
                    console.warn('[SIP] WebSocket disconnected');
                });

                ua.on('connected', function () {
                    console.log('[SIP] WebSocket connected');
                });

                ua.on('newMessage', function (data) {
                    try { if (data.originator === 'remote') data.message.accept(); } catch (e) { }
                });

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
                            session.on('failed', function (e) {
                                currentSession = null;
                                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                                notifyCallState('disconnected');
                            });
                            session.on('ended', function (e) {
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
                                session.answer({
                                    mediaConstraints: { audio: true, video: false },
                                    pcConfig: { iceServers: [{ urls: "stun:74.125.250.129:19302" }] },
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

        // ── Room API ──
        function getRoomDetails() {
            if (!clientToken) { console.error('[SIP] getRoomDetails: not logged in'); return Promise.reject(new Error('Not logged in')); }
            return fetch(apiBase + '/api/v1/client/rooms/details', {
                headers: { 'Authorization': 'Bearer ' + clientToken },
            })
            .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json.data; }); });
        }

        function _notifyRoomChange(data) {
            if (typeof window.onHotlineRoomChange === 'function') {
                window.onHotlineRoomChange(data);
            } else {
                window.location.reload();
            }
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

        // ── Actions ──
        function toggleMute() {
            try {
                if (listenOnly) return;
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

        function joinConference() {
            console.log('[SIP] joinConference — auto-join on SIP register, no explicit API call needed');
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
                if (currentSession) { try { currentSession.terminate(); } catch (e) { } currentSession = null; }
                if (ua) { try { ua.unregister(); ua.stop(); } catch (e) { } ua = null; }
                accountData = null;
                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                loggingOut = false;
                console.log('[SIP] Logged out');
            } catch (e) {
                console.error('[SIP] logout error:', e.message);
                loggingOut = false;
            }
        }

        // ── Keyboard shortcut: Ctrl+L to toggle mute ──
        try {
            document.addEventListener('keydown', function (e) {
                try {
                    if (e.ctrlKey && e.key === 'l') {
                        e.preventDefault();
                        if (listenOnly) return;
                        window._muteToggleAt = Date.now();
                        console.log('[TIMING] Ctrl+L pressed — ' + (isMuted ? 'unmuting' : 'muting'));
                        if (accountData) toggleMute();
                    }
                } catch (err) { }
            });
        } catch (e) { }

        // ── Broadcast Feed (SSE + REST) ──
        var broadcastSource = null;
        var broadcastReconnectAttempts = 0;
        var broadcastFeedRoom = null;
        var broadcastFeedAnswered = undefined;

        function startBroadcastFeed(room, options) {
            stopBroadcastFeed();
            broadcastReconnectAttempts = 0;
            options = options || {};
            broadcastFeedRoom = room || undefined;
            broadcastFeedAnswered = options.answered;
            connectBroadcastSSE();
        }

        function connectBroadcastSSE() {
            if (!clientToken) return;
            var url = apiBase + '/api/v1/client/events/broadcasts';
            if (broadcastFeedRoom) url += '/' + broadcastFeedRoom;
            url += '?token=' + clientToken;
            if (broadcastFeedAnswered !== undefined) url += '&answered=' + broadcastFeedAnswered;

            try {
                broadcastSource = new EventSource(url);

                broadcastSource.onopen = function () {
                    broadcastReconnectAttempts = 0;
                };

                broadcastSource.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                        if (data.type === 'connected') {
                            if (typeof window.onHotlineBroadcastConnected === 'function') {
                                window.onHotlineBroadcastConnected(data);
                            }
                        } else if (data.type === 'broadcast') {
                            if (typeof window.onHotlineBroadcast === 'function') {
                                window.onHotlineBroadcast(data);
                            }
                        }
                    } catch (e) { }
                };

                broadcastSource.onerror = function () {
                    try { if (broadcastSource) { broadcastSource.close(); broadcastSource = null; } } catch (e) { }
                    if (loggingOut || !accountData) return;
                    broadcastReconnectAttempts++;
                    var delay = Math.min(1000 * Math.pow(2, broadcastReconnectAttempts), 30000);
                    setTimeout(function () { if (!loggingOut && accountData) connectBroadcastSSE(); }, delay);
                };
            } catch (e) {
                broadcastReconnectAttempts++;
                var delay = Math.min(1000 * Math.pow(2, broadcastReconnectAttempts), 30000);
                setTimeout(function () { if (!loggingOut && accountData) connectBroadcastSSE(); }, delay);
            }
        }

        function stopBroadcastFeed() {
            try {
                if (broadcastSource) { broadcastSource.close(); broadcastSource = null; }
            } catch (e) { }
        }

        function getBroadcasts(room, options) {
            if (!clientToken) return Promise.reject(new Error('Not logged in'));
            options = options || {};
            var url = apiBase + '/api/v1/client/broadcasts/list';
            if (room) url += '/' + room;
            var params = [];
            if (options.page) params.push('page=' + options.page);
            if (options.pageSize) params.push('pageSize=' + options.pageSize);
            if (options.answered !== undefined) params.push('answered=' + options.answered);
            if (options.dateFrom) params.push('dateFrom=' + options.dateFrom);
            if (options.dateTo) params.push('dateTo=' + options.dateTo);
            if (params.length) url += '?' + params.join('&');

            return fetch(url, {
                headers: { 'Authorization': 'Bearer ' + clientToken },
            })
            .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); });
        }

        // ── Public API ──
        window.hotlineClient = {
            login: doLogin,
            logout: logout,
            reconnect: function () { callerIdReconnectAttempts = 0; var r = accountData && (accountData.current_room || accountData.room); if (r) startCallerIdSSE(r); },
            disconnect: stopCallerIdSSE,
            toggleMute: toggleMute,
            joinConference: joinConference,
            hangup: hangup,
            getRoom: function () { return accountData && (accountData.current_room || accountData.room) || ''; },
            getRoomDetails: getRoomDetails,
            changeRoom: changeRoom,
            requestRoom: requestRoom,
            getAccount: function () { return accountData; },
            getToken: function () { return clientToken; },
            getLocalData: getLocalStorageUserData,
            isConnected: function () { return !!currentSession; },
            isMuted: function () { return isMuted; },
            isListenOnly: function () { return listenOnly; },
            startBroadcastFeed: startBroadcastFeed,
            stopBroadcastFeed: stopBroadcastFeed,
            getBroadcasts: getBroadcasts,
            enablePush: function () { return window.RedlinePush ? window.RedlinePush.enable() : Promise.reject(new Error('Push module not loaded')); },
            disablePush: function () { return window.RedlinePush ? window.RedlinePush.disable() : Promise.resolve(false); },
        };

        // ── Auto-login from localStorage or HOTLINE_CONFIG ──
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
