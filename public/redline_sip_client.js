/* eslint-disable */
// HotlineHQ Client — SIP + CallerID SSE
// Requires: jssip.bundle.js loaded before this script
// Requires DOM elements: #loginScreen, #confScreen, #caller_grid, #remoteAudio, etc.
// Config: window.HOTLINE_CONFIG = { wsPort: 5072, apiBase: '' }

(function () {
    var config = window.HOTLINE_CONFIG || {};
    var host = window.location.hostname || 'localhost';
    var wsServer = 'wss://' + host + ':' + (config.wsPort || 5072);
    var sipDomain = host;
    var apiBase = config.apiBase || '';

    var ua = null;
    var currentSession = null;
    var isMuted = true;
    var callTimer = null;
    var callSeconds = 0;
    var accountData = null;
    var loggingOut = false;
    var regRetryTimer = null;
    var callerIdSource = null;
    var lastHeartbeat = Date.now();

    // ── Sleep/wake detection ──
    setInterval(function () {
        var now = Date.now();
        if (now - lastHeartbeat > 15000 && ua && !loggingOut) {
            console.warn('[SIP] Sleep/wake detected, forcing reconnect');
            try {
                ua.stop();
                setTimeout(function () { if (!loggingOut) ua.start(); }, 1000);
            } catch (e) {
                console.error('[SIP] Reconnect after wake failed:', e);
            }
        }
        lastHeartbeat = now;
    }, 5000);

    // ── UI helpers ──
    function $(id) { return document.getElementById(id); }

    function showStatus(msg) {
        var s = $('loginStatus'); if (s) s.textContent = msg;
        var e = $('loginError'); if (e) e.textContent = '';
    }

    function showError(msg) {
        var e = $('loginError'); if (e) e.textContent = msg;
        var s = $('loginStatus'); if (s) s.textContent = '';
    }

    function setRegStatus(state, text) {
        var el = $('confReg');
        if (!el) return;
        var colors = { registered: 'green', registering: 'yellow', unregistered: 'red' };
        el.innerHTML = '<span class="dot ' + (colors[state] || 'red') + '"></span> <span>' + text + '</span>';
    }

    function generateMac(email) {
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
    }

    // ── CallerID SSE ──
    function startCallerIdSSE(room) {
        stopCallerIdSSE();
        callerIdSource = new EventSource(apiBase + '/api/v1/admin/events/room/' + room);

        callerIdSource.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);

                // Render caller ID HTML into grid
                var grid = $('caller_grid');
                if (grid && data.callerIdHtml) {
                    grid.innerHTML = (data.callerIdHtml || []).join('');
                }

                // Update online counts
                if (data.online) {
                    var total = Object.values(data.online).reduce(function (s, n) { return s + n; }, 0);
                    var onlineEl = $('confOnline');
                    if (onlineEl) {
                        onlineEl.textContent = '👥 ' + total + ' online';
                        onlineEl.style.display = 'block';
                    }
                }

                // Update caller names text (fallback display)
                var callerEl = $('confCallerId');
                if (callerEl) {
                    if (data.callerIds && data.callerIds.length > 0) {
                        callerEl.textContent = '🎙 ' + data.callerIds.join(', ');
                        callerEl.style.display = 'block';
                    } else {
                        callerEl.textContent = '';
                        callerEl.style.display = 'none';
                    }
                }
            } catch (e) {
                console.error('[CallerID] Parse error:', e);
            }
        };

        callerIdSource.onerror = function () {
            callerIdSource.close();
            callerIdSource = null;
            setTimeout(function () { if (!loggingOut && accountData) startCallerIdSSE(room); }, 5000);
        };
    }

    function stopCallerIdSSE() {
        if (callerIdSource) { callerIdSource.close(); callerIdSource = null; }
        var grid = $('caller_grid'); if (grid) grid.innerHTML = '';
        var el = $('confCallerId'); if (el) { el.textContent = ''; el.style.display = 'none'; }
        var onlineEl = $('confOnline'); if (onlineEl) { onlineEl.textContent = ''; onlineEl.style.display = 'none'; }
    }

    // ── SIP ──
    function doLogin() {
        var email = $('email').value.trim();
        var password = $('password').value;

        if (!email || !password) { showError('Please enter email and password.'); return; }

        var btnLogin = $('btnLogin');
        if (btnLogin) btnLogin.disabled = true;
        showStatus('Connecting...');

        try {
            if (typeof JsSIP === 'undefined') {
                showError('SIP library not loaded.');
                if (btnLogin) btnLogin.disabled = false;
                return;
            }

            var sipUser = email.replace('@', '.at.');
            var mac = generateMac(email);

            JsSIP.debug.enable('JsSIP:*');

            var socket = new JsSIP.WebSocketInterface(wsServer);
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
                console.log('[SIP] Registered:', email);
                setRegStatus('registered', 'Registered');
                if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }
                sessionStorage.setItem('sip_credentials', JSON.stringify({ email: email, password: password }));

                if (accountData) { console.log('[SIP] Re-registered'); return; }

                showStatus('Authenticated. Loading account...');
                fetch(apiBase + '/api/v1/admin/account-lookup?email=' + encodeURIComponent(email))
                    .then(function (r) { return r.json(); })
                    .then(function (json) {
                        accountData = json.data || json;

                        if (!accountData || !accountData.room) {
                            showError('No conference room assigned to your account.');
                            sessionStorage.removeItem('sip_credentials');
                            ua.unregister(); ua.stop(); ua = null;
                            if (btnLogin) btnLogin.disabled = false;
                            return;
                        }

                        showConfScreen();
                        startCallerIdSSE(accountData.room);

                        if (!accountData.active) {
                            showDeactivatedState();
                        } else {
                            showIdleState();
                        }
                    })
                    .catch(function (e) {
                        showError('Failed to load account: ' + e.message);
                        if (btnLogin) btnLogin.disabled = false;
                    });
            });

            ua.on('registrationFailed', function (e) {
                var cause = e.cause || '';

                if (!accountData && (cause === 'Rejected' || cause === 'Forbidden')) {
                    sessionStorage.removeItem('sip_credentials');
                    setRegStatus('unregistered', 'Auth Failed');
                    showError('Invalid email or password. (' + cause + ')');
                    if (btnLogin) btnLogin.disabled = false;
                    ua.stop(); ua = null;
                    return;
                }

                setRegStatus('registering', 'Re-registering... (' + (cause || 'timeout') + ')');
                if (accountData) {
                    $('confStatus').textContent = 'Re-registering...';
                    $('confStatus').className = 'conf-status connecting';
                } else {
                    showStatus('Server unavailable, retrying...');
                }

                if (!regRetryTimer && ua) {
                    regRetryTimer = setInterval(function () {
                        if (!ua) { clearInterval(regRetryTimer); regRetryTimer = null; return; }
                        if (ua.isRegistered()) { clearInterval(regRetryTimer); regRetryTimer = null; return; }
                        ua.register();
                    }, 30000);
                }
            });

            ua.on('unregistered', function () {
                if (loggingOut) return;
                setRegStatus('unregistered', 'Not Registered');
                if (accountData) {
                    $('confStatus').textContent = 'Unregistered';
                    $('confStatus').className = 'conf-status disconnected';
                }
            });

            ua.on('disconnected', function () {
                if (loggingOut) return;
                setRegStatus('unregistered', 'Disconnected');
                if (accountData) {
                    $('confStatus').textContent = 'Reconnecting...';
                    $('confStatus').className = 'conf-status connecting';
                } else {
                    showStatus('Connection lost, reconnecting...');
                }
            });

            ua.on('connected', function () {
                setRegStatus('registering', 'Registering...');
            });

            ua.on('newMessage', function (data) {
                if (data.originator === 'remote') data.message.accept();
            });

            ua.on('newRTCSession', function (data) {
                if (data.originator === 'remote') {
                    var session = data.session;
                    session.on('peerconnection', function (pcData) {
                        pcData.peerconnection.ontrack = function () { attachRemoteAudio(session); };
                    });
                    session.on('accepted', function () {
                        currentSession = session;
                        onCallConnected();
                        attachRemoteAudio(session);
                    });
                    session.on('failed', function () { resetCallState(); });
                    session.on('ended', function () { resetCallState(); });
                    session.answer({
                        mediaConstraints: { audio: true, video: false },
                        pcConfig: { iceServers: [] },
                    });
                }
            });

            ua.start();
        } catch (e) {
            showError('Connection error: ' + e.message);
            if (btnLogin) btnLogin.disabled = false;
        }
    }

    // ── Conference UI ──
    function showConfScreen() {
        $('loginScreen').style.display = 'none';
        $('confScreen').style.display = 'block';
        $('confUser').textContent = accountData.display_name || accountData.email;
        $('confCompany').textContent = accountData.company_name || '';
        $('confRoom').textContent = accountData.room_name || ('Room ' + accountData.room);
        $('confStatus').textContent = 'Connecting...';
        $('confStatus').className = 'conf-status connecting';
        $('confActions').style.display = 'none';
        $('confIdleActions').style.display = 'none';
        var msg = $('confStandbyMsg'); if (msg) msg.style.display = 'none';
    }

    function showIdleState() {
        $('confStatus').textContent = 'Idle';
        $('confStatus').className = 'conf-status idle';
        $('confTimer').textContent = '--:--';
        $('confActions').style.display = 'none';
        $('confIdleActions').style.display = 'flex';
        var msg = $('confStandbyMsg'); if (msg) msg.style.display = 'none';
    }

    function showDeactivatedState() {
        $('confStatus').textContent = 'Deactivated';
        $('confStatus').className = 'conf-status deactivated';
        $('confTimer').textContent = '--:--';
        $('confActions').style.display = 'none';
        $('confIdleActions').style.display = 'none';
        var msg = $('confStandbyMsg');
        if (msg) { msg.style.display = 'block'; msg.textContent = 'Your account is currently deactivated. Contact your administrator to reactivate.'; }
    }

    function onCallConnected() {
        $('confStatus').textContent = 'Connected';
        $('confStatus').className = 'conf-status connected';
        $('confActions').style.display = 'flex';
        $('confIdleActions').style.display = 'none';
        var msg = $('confStandbyMsg'); if (msg) msg.style.display = 'none';
        $('btnMute').disabled = false;

        isMuted = true;
        muteAudio(true);
        updateMuteUI();

        if (callTimer) clearInterval(callTimer);
        callSeconds = 0;
        callTimer = setInterval(function () {
            callSeconds++;
            var min = String(Math.floor(callSeconds / 60)).padStart(2, '0');
            var sec = String(callSeconds % 60).padStart(2, '0');
            $('confTimer').textContent = min + ':' + sec;
        }, 1000);

        attachRemoteAudio(currentSession);
    }

    function resetCallState() {
        currentSession = null;
        if (callTimer) clearInterval(callTimer);
        callTimer = null;
        $('confTimer').textContent = '00:00';
        $('btnMute').disabled = true;
        $('confActions').style.display = 'none';

        if (accountData && accountData.active) {
            showIdleState();
        } else {
            $('confStatus').textContent = 'Disconnected';
            $('confStatus').className = 'conf-status disconnected';
        }
    }

    // ── Audio ──
    function attachRemoteAudio(session) {
        if (!session || !session.connection) return;
        var tracks = session.connection.getReceivers()
            .filter(function (r) { return r.track && r.track.kind === 'audio'; })
            .map(function (r) { return r.track; });
        if (tracks.length > 0) {
            var audio = $('remoteAudio');
            audio.srcObject = new MediaStream(tracks);
            audio.play().catch(function () {});
        }
    }

    function muteAudio(mute) {
        if (!currentSession || !currentSession.connection) return;
        currentSession.connection.getSenders().forEach(function (sender) {
            if (sender.track && sender.track.kind === 'audio') {
                sender.track.enabled = !mute;
            }
        });
    }

    function updateMuteUI() {
        $('muteIcon').textContent = isMuted ? '🔇' : '🔊';
        $('muteLabel').textContent = isMuted ? 'Unmute' : 'Mute';
        $('btnMute').className = isMuted ? 'conf-btn btn-mute' : 'conf-btn btn-mute live';
    }

    // ── Actions ──
    function toggleMute() {
        isMuted = !isMuted;
        muteAudio(isMuted);
        updateMuteUI();

        if (!accountData) return;
        var userName = 'sip:' + accountData.email;
        var hookEvent = isMuted ? 'on_hook' : 'off_hook';
        fetch(apiBase + '/api/v1/admin/users/' + encodeURIComponent(userName) + '/hook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: hookEvent }),
        }).catch(function (e) { console.error('[HOOK] Failed:', e); });
    }

    function joinConference() {
        if (!accountData) return;
        var userName = 'sip:' + accountData.email;
        $('confStatus').textContent = 'Connecting...';
        $('confStatus').className = 'conf-status connecting';
        $('confIdleActions').style.display = 'none';
        fetch(apiBase + '/api/v1/admin/users/' + encodeURIComponent(userName) + '/reconnect', { method: 'POST' })
            .then(function (r) { return r.json(); })
            .then(function (json) { if (!json.status) showIdleState(); })
            .catch(function () { showIdleState(); });
    }

    function hangup() {
        if (currentSession) { currentSession.terminate(); currentSession = null; }
        resetCallState();
        $('confStatus').textContent = 'Disconnected';
        $('confStatus').className = 'conf-status disconnected';
    }

    function logout() {
        loggingOut = true;
        stopCallerIdSSE();
        if (regRetryTimer) { clearInterval(regRetryTimer); regRetryTimer = null; }
        if (currentSession) { currentSession.terminate(); currentSession = null; }
        if (ua) { ua.unregister(); ua.stop(); ua = null; }
        accountData = null;
        sessionStorage.removeItem('sip_credentials');
        $('confScreen').style.display = 'none';
        $('loginScreen').style.display = 'block';
        var btnLogin = $('btnLogin'); if (btnLogin) btnLogin.disabled = false;
        $('email').value = '';
        $('password').value = '';
        showStatus('');
        showError('');
        loggingOut = false;
    }

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && $('loginScreen').style.display !== 'none') {
            doLogin();
        }
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            if (currentSession && !$('btnMute').disabled) toggleMute();
        }
    });

    // ── Auto-reconnect on page load ──
    (function autoReconnect() {
        var saved = sessionStorage.getItem('sip_credentials');
        if (!saved) return;
        try {
            var creds = JSON.parse(saved);
            if (!creds.email || !creds.password) return;
            $('email').value = creds.email;
            $('password').value = creds.password;
            doLogin();
        } catch (e) {
            sessionStorage.removeItem('sip_credentials');
        }
    })();

    // ── Public API ──
    window.hotlineClient = {
        login: doLogin,
        logout: logout,
        toggleMute: toggleMute,
        joinConference: joinConference,
        hangup: hangup,
        getAccount: function () { return accountData; },
        isConnected: function () { return !!currentSession; },
        isMuted: function () { return isMuted; },
    };
})();
