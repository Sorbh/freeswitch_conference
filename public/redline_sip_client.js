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
//   <script src="/redline_sip_client.js"></script>
//
//   That's it. JsSIP is auto-loaded from /jssip.bundle.js.
//   If localStorage has "user_data" with is_sip=1, it auto-connects.
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
//     wsPort: 5072,              // WebSocket port for SIP
//     apiBase: '',               // API base URL (empty = same origin)
//     defaultPassword: '12345678' // SIP password
//   };
//
// OPTIONAL CALLBACKS (set before or after loading):
//   window.onHotlineReady = function(accountData) { ... }     // fired when registered + account loaded
//   window.onHotlineCallState = function(state) { ... }       // 'connected' or 'disconnected'
//   window.updateOnlineCounts = function(onlineMap) { ... }   // { roomId: count, ... }
//
// MANUAL CONTROL (if needed):
//   window.hotlineClient.login('email@example.com')  // login with specific email
//   window.hotlineClient.toggleMute()                // Ctrl+L equivalent
//   window.hotlineClient.joinConference()            // request server to call this user
//   window.hotlineClient.hangup()                    // end current call
//   window.hotlineClient.logout()                    // disconnect everything
//   window.hotlineClient.getAccount()                // get loaded account data
//   window.hotlineClient.isConnected()               // true if in active call
//   window.hotlineClient.isMuted()                   // true if muted
//
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    // ── Load JsSIP if not already loaded ──
    function loadJsSIPAndInit() {
        if (typeof JsSIP !== 'undefined') { init(); return; }
        var script = document.createElement('script');
        script.src = (window.HOTLINE_CONFIG && window.HOTLINE_CONFIG.jssipUrl) || '/jssip.bundle.js';
        script.onload = function () { init(); };
        script.onerror = function () { console.error('[SIP] Failed to load jssip.bundle.js'); };
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadJsSIPAndInit);
    } else {
        loadJsSIPAndInit();
    }

    function init() {
        var config = window.HOTLINE_CONFIG || {};
        var host = '50.28.84.57';
        var sipDomain = '50.28.84.57';
        var wsServer = 'wss://' + host + ':' + (config.wsPort || 5072);
        var apiBase = config.apiBase || '';
        var defaultPassword = config.defaultPassword || '12345678';

        var ua = null;
        var currentSession = null;
        var isMuted = true;
        var accountData = null;
        var loggingOut = false;
        var regRetryTimer = null;
        var callerIdSource = null;
        var lastHeartbeat = Date.now();
        var callerIdReconnectAttempts = 0;

        // ── Sleep/wake detection ──
        setInterval(function () {
            try {
                var now = Date.now();
                if (now - lastHeartbeat > 15000 && ua && !loggingOut) {
                    console.warn('[SIP] Sleep/wake detected, forcing reconnect');
                    try {
                        ua.stop();
                        setTimeout(function () { if (!loggingOut && ua) ua.start(); }, 1000);
                    } catch (e) {
                        console.error('[SIP] Reconnect after wake failed:', e.message);
                    }
                }
                lastHeartbeat = now;
            } catch (e) {
                console.error('[SIP] Heartbeat error:', e.message);
            }
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

        // ── CallerID SSE ──
        function startCallerIdSSE(room) {
            stopCallerIdSSE();
            callerIdReconnectAttempts = 0;
            connectCallerIdSSE(room);
        }

        function connectCallerIdSSE(room) {
            try {
                callerIdSource = new EventSource(apiBase + '/api/v1/admin/events/room/' + room);

                callerIdSource.onopen = function () {
                    callerIdReconnectAttempts = 0;
                };

                callerIdSource.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                        var grid = document.getElementById('caller_grid');
                        if (grid && data.callerIdHtml) {
                            grid.innerHTML = (data.callerIdHtml || []).join('');
                        }
                        if (data.online && typeof window.updateOnlineCounts === 'function') {
                            window.updateOnlineCounts(data.online);
                        }
                    } catch (e) {
                        console.error('[CallerID] Message parse error:', e.message);
                    }
                };

                callerIdSource.onerror = function () {
                    try { if (callerIdSource) { callerIdSource.close(); callerIdSource = null; } } catch (e) { }
                    if (loggingOut || !accountData) return;
                    callerIdReconnectAttempts++;
                    var delay = Math.min(1000 * Math.pow(2, callerIdReconnectAttempts), 30000);
                    console.warn('[CallerID] Connection lost, reconnecting in ' + (delay / 1000) + 's');
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
        function attachRemoteAudio(session) {
            try {
                if (!session || !session.connection) return;
                var tracks = session.connection.getReceivers()
                    .filter(function (r) { return r.track && r.track.kind === 'audio'; })
                    .map(function (r) { return r.track; });
                if (tracks.length > 0) {
                    var audio = document.getElementById('remoteAudio');
                    if (audio) {
                        audio.srcObject = new MediaStream(tracks);
                        audio.play().catch(function (e) {
                            console.warn('[SIP] Audio autoplay blocked:', e.message);
                        });
                    }
                }
            } catch (e) {
                console.error('[SIP] attachRemoteAudio error:', e.message);
            }
        }

        function muteAudio(mute) {
            try {
                if (!currentSession || !currentSession.connection) return;
                currentSession.connection.getSenders().forEach(function (sender) {
                    if (sender.track && sender.track.kind === 'audio') {
                        sender.track.enabled = !mute;
                    }
                });
            } catch (e) {
                console.error('[SIP] muteAudio error:', e.message);
            }
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

            try {
                if (typeof JsSIP === 'undefined') {
                    console.error('[SIP] JsSIP is undefined — jssip.bundle.js not loaded');
                    return;
                }

                var sipUser = email.replace('@', '.at.');
                var mac = generateMac(email);

                try { JsSIP.debug.enable('JsSIP:*'); } catch (e) { }

                var socket;
                try {
                    socket = new JsSIP.WebSocketInterface(wsServer);
                } catch (e) {
                    console.error('[SIP] WebSocket creation error:', e.message);
                    return;
                }

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
                });

                ua.on('registered', function () {
                    try {
                        console.log('[SIP] Registered:', email);
                        if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }

                        if (accountData) { console.log('[SIP] Re-registered'); return; }

                        fetch(apiBase + '/api/v1/admin/account-lookup?email=' + encodeURIComponent(email))
                            .then(function (r) {
                                if (!r.ok) throw new Error('HTTP ' + r.status);
                                return r.json();
                            })
                            .then(function (json) {
                                try {
                                    accountData = json.data || json;

                                    if (!accountData.room && lsData && lsData.room) {
                                        accountData.room = lsData.room;
                                    }

                                    if (lsData) {
                                        if (!accountData.display_name && lsData.repName) accountData.display_name = lsData.repName;
                                        if (!accountData.company_name && lsData.companyName) accountData.company_name = lsData.companyName;
                                        accountData._lsData = lsData;
                                    }

                                    if (!accountData || !accountData.room) {
                                        console.error('[SIP] Account has no room:', accountData);
                                        if (ua) { ua.unregister(); ua.stop(); ua = null; }
                                        return;
                                    }

                                    console.log('[SIP] Account loaded:', accountData.display_name, 'Room:', accountData.room);
                                    startCallerIdSSE(accountData.room);

                                    if (typeof window.onHotlineReady === 'function') {
                                        window.onHotlineReady(accountData);
                                    }
                                } catch (e) {
                                    console.error('[SIP] Account processing error:', e);
                                }
                            })
                            .catch(function (e) {
                                console.error('[SIP] Account lookup failed:', e);
                            });
                    } catch (e) {
                        console.error('[SIP] Registration handler error:', e);
                    }
                });

                ua.on('registrationFailed', function (e) {
                    try {
                        var cause = e.cause || 'unknown';
                        console.error('[SIP] Registration failed:', cause);

                        if (!accountData && (cause === 'Rejected' || cause === 'Forbidden')) {
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
                                    muteAudio(true);
                                    attachRemoteAudio(session);
                                    console.log('[SIP] Call connected');
                                    if (typeof window.onHotlineCallState === 'function') {
                                        window.onHotlineCallState('connected');
                                    }
                                } catch (e) {
                                    console.error('[SIP] Session accepted error:', e.message);
                                }
                            });
                            session.on('failed', function (e) {
                                console.warn('[SIP] Session failed:', e && e.cause || 'unknown');
                                currentSession = null;
                                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState('disconnected');
                            });
                            session.on('ended', function (e) {
                                console.log('[SIP] Session ended:', e && e.cause || 'normal');
                                currentSession = null;
                                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState('disconnected');
                            });
                            session.answer({
                                mediaConstraints: { audio: true, video: false },
                                pcConfig: { iceServers: [] },
                            });
                        }
                    } catch (e) {
                        console.error('[SIP] newRTCSession handler error:', e);
                    }
                });

                console.log('[SIP] Starting UA, server:', wsServer, 'user:', sipUser);
                ua.start();
            } catch (e) {
                console.error('[SIP] doLogin error:', e);
            }
        }

        // ── Actions ──
        function toggleMute() {
            try {
                isMuted = !isMuted;
                muteAudio(isMuted);

                if (!accountData) return;
                var userName = 'sip:' + accountData.email;
                var hookEvent = isMuted ? 'on_hook' : 'off_hook';
                fetch(apiBase + '/api/v1/admin/users/' + encodeURIComponent(userName) + '/hook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: hookEvent }),
                }).catch(function (e) { console.error('[HOOK] Failed:', e.message); });
            } catch (e) {
                console.error('[SIP] toggleMute error:', e.message);
            }
        }

        function joinConference() {
            try {
                if (!accountData) return;
                var userName = 'sip:' + accountData.email;
                fetch(apiBase + '/api/v1/admin/users/' + encodeURIComponent(userName) + '/reconnect', { method: 'POST' })
                    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(function (json) { if (!json.status) console.error('[SIP] Join failed:', json.error); })
                    .catch(function (e) { console.error('[SIP] Join request failed:', e.message); });
            } catch (e) {
                console.error('[SIP] joinConference error:', e.message);
            }
        }

        function hangup() {
            try {
                if (currentSession) { currentSession.terminate(); currentSession = null; }
                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState('disconnected');
            } catch (e) {
                console.error('[SIP] hangup error:', e.message);
            }
        }

        function logout() {
            try {
                loggingOut = true;
                stopCallerIdSSE();
                if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }
                if (currentSession) { try { currentSession.terminate(); } catch (e) { } currentSession = null; }
                if (ua) { try { ua.unregister(); ua.stop(); } catch (e) { } ua = null; }
                accountData = null;
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
                        if (currentSession) toggleMute();
                    }
                } catch (err) { }
            });
        } catch (e) { }

        // ── Public API ──
        window.hotlineClient = {
            login: doLogin,
            logout: logout,
            toggleMute: toggleMute,
            joinConference: joinConference,
            hangup: hangup,
            getAccount: function () { return accountData; },
            getLocalData: getLocalStorageUserData,
            isConnected: function () { return !!currentSession; },
            isMuted: function () { return isMuted; },
        };

        // ── Auto-login from localStorage (production Vue app) ──
        try {
            var lsAutoData = getLocalStorageUserData();
            if (lsAutoData && lsAutoData.email && lsAutoData.isSip) {
                console.log('[SIP] Auto-login from localStorage:', lsAutoData.email);
                doLogin(lsAutoData.email);
            }
        } catch (e) {
            console.warn('[SIP] localStorage auto-login failed:', e.message);
        }

    } // end init()
})();
