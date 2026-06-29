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
        var directCallHideTimer = null;
        var directCallTimer = null;
        var directCallState = null;

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

        function notifyDirectCallState(state, data) {
            try {
                if (typeof window.onHotlineDirectCallState === 'function') window.onHotlineDirectCallState(state, data || null);
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

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, function (char) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
            });
        }

        function ensureExtensionDirectoryWidget() {
            if (window.RedlineExtensionDirectory) return window.RedlineExtensionDirectory;

            var state = {
                apiBase: '',
                getToken: function () { return ''; },
                getOwnExtension: function () { return ''; },
                getUserEmail: function () { return ''; },
                callExtension: null,
                items: [],
                loaded: false,
                loading: false,
                query: '',
                message: '',
                open: false,
                visible: false,
                requestOpen: false,
                requestExtension: '',
                requestLoading: false,
                requestSubmitted: false,
                bottom: parseInt(localStorage.getItem('redline_extension_widget_bottom') || '92', 10),
            };

            function root() {
                var el = document.getElementById('redline_extension_directory');
                if (el) return el;
                el = document.createElement('div');
                el.id = 'redline_extension_directory';
                document.body.appendChild(el);
                return el;
            }

            function label(item) {
                return (item.companyName || 'Unknown') + ' / ' + (item.displayName || item.email || 'User');
            }

            function publicAsset(path) {
                try { return new URL(path, state.apiBase || window.location.origin).href; }
                catch (e) { return path; }
            }

            function directoryTitle() {
                var extension = state.getOwnExtension && state.getOwnExtension();
                extension = extension ? String(extension).replace(/^\*/, '') : '';
                return 'Extension Directory' + (extension ? ' - *' + escapeHtml(extension) : '');
            }

            function ownExtension() {
                var extension = state.getOwnExtension && state.getOwnExtension();
                return extension ? String(extension).replace(/^\*/, '') : '';
            }

            function hasOwnExtension() {
                return !!ownExtension();
            }

            function requestStorageKey() {
                var email = state.getUserEmail && state.getUserEmail();
                email = String(email || '').toLowerCase().trim();
                return 'redline_extension_request_' + (email || 'anonymous');
            }

            function getExtensionRequestRecord() {
                if (state.requestSubmitted) return { submitted: true };
                try {
                    var raw = localStorage.getItem(requestStorageKey());
                    if (!raw) return null;
                    var record = JSON.parse(raw);
                    return record && record.submitted ? record : null;
                } catch (e) {
                    return null;
                }
            }

            function hasExtensionRequestSubmitted() {
                return !!getExtensionRequestRecord();
            }

            function saveExtensionRequest(extension) {
                state.requestSubmitted = true;
                try {
                    localStorage.setItem(requestStorageKey(), JSON.stringify({
                        submitted: true,
                        extension: extension,
                        requestedAt: new Date().toISOString(),
                    }));
                } catch (e) { }
            }

            function clearExtensionRequestIfAssigned() {
                if (!hasOwnExtension()) return;
                state.requestSubmitted = false;
                state.requestOpen = false;
                state.requestExtension = '';
                try { localStorage.removeItem(requestStorageKey()); } catch (e) { }
            }

            function filteredItems() {
                var q = (state.query || '').toLowerCase().trim();
                var ownExt = ownExtension();
                return state.items.filter(function (item) {
                    if (ownExt && String(item.extension || '').replace(/^\*/, '') === ownExt) return false;
                    if (!q) return true;
                    return [
                        item.companyName,
                        item.displayName,
                        item.email,
                        item.extension,
                        item.roomName,
                    ].join(' ').toLowerCase().indexOf(q) !== -1;
                });
            }

            function setMessage(message) {
                state.message = message || '';
                renderList();
            }

            function clampBottom(value) {
                var max = Math.max(92, (window.innerHeight || 700) - 110);
                return Math.max(18, Math.min(max, value));
            }

            function getFabBottom() {
                state.bottom = clampBottom(parseInt(state.bottom || 92, 10));
                return state.bottom;
            }

            function getModalStyle() {
                var buttonBottom = getFabBottom();
                var viewportHeight = window.innerHeight || 700;
                var spaceAbove = viewportHeight - (buttonBottom + 86);
                var spaceBelow = buttonBottom - 18;
                var openBelow = spaceAbove < 180 && spaceBelow > spaceAbove;
                var verticalStyle = openBelow ? 'top:18px;' : 'bottom:' + (buttonBottom + 72) + 'px;';
                var maxHeight = Math.max(260, Math.min(620, (openBelow ? spaceBelow : spaceAbove) - 18));
                return 'position:fixed;right:20px;' + verticalStyle + 'z-index:2147483647;width:min(430px,calc(100vw - 40px));max-height:' + maxHeight + 'px;display:flex;flex-direction:column;background:linear-gradient(180deg,#fff 0%,#fff7f8 100%);border:1px solid #fecaca;border-top:5px solid #e11d2e;border-radius:22px;box-shadow:0 26px 76px rgba(185,28,28,.28);font-family:Inter,Arial,sans-serif;overflow:hidden;';
            }

            function load(force) {
                if (state.loading || (state.loaded && !force)) return;
                var token = state.getToken && state.getToken();
                if (!token) {
                    state.message = 'Login required before loading extensions.';
                    render();
                    return;
                }
                state.loading = true;
                state.message = 'Loading extensions...';
                render();

                fetch(state.apiBase + '/api/v1/client/extensions', {
                    cache: 'no-store',
                    headers: { 'Authorization': 'Bearer ' + token },
                })
                    .then(function (res) {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.json();
                    })
                    .then(function (json) {
                        state.items = json.data || [];
                        state.loaded = true;
                        state.message = state.items.length ? '' : 'No extensions found.';
                        state.loading = false;
                        render();
                    })
                    .catch(function (err) {
                        state.loading = false;
                        state.message = 'Failed to load extensions: ' + err.message;
                        render();
                    });
            }

            function handleCall(item) {
                var dialCode = '*' + item.extension;
                if (typeof state.callExtension === 'function') {
                    var result = state.callExtension(item, dialCode) || {};
                    if (result.message) setMessage(result.message);
                    return;
                }
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(dialCode).catch(function () { });
                    }
                } catch (e) { }
                setMessage('Dial ' + dialCode + ' from your phone.');
            }

            function submitExtensionRequest() {
                if (state.requestLoading) return;
                var token = state.getToken && state.getToken();
                var extension = parseInt(state.requestExtension, 10);
                if (!token) return setMessage('Login required before requesting an extension.');
                if (!extension || extension < 100 || extension > 999) return setMessage('Enter an extension from 100 to 999.');

                state.requestLoading = true;
                setMessage('Sending extension request...');
                fetch(state.apiBase + '/api/v1/client/extension-request', {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ extension: extension }),
                })
                    .then(function (res) {
                        return res.json().catch(function () { return {}; }).then(function (json) {
                            if (!res.ok || json.status === false) throw new Error(json.error || ('HTTP ' + res.status));
                            return json;
                        });
                    })
                    .then(function (json) {
                        saveExtensionRequest(extension);
                        state.requestOpen = false;
                        state.requestExtension = '';
                        setMessage(json.message || 'Request received. We will review your preferred extension shortly.');
                    })
                    .catch(function (err) {
                        setMessage('Failed to send request: ' + err.message);
                    })
                    .finally(function () {
                        state.requestLoading = false;
                        render();
                    });
            }

            function renderRequestForm() {
                if (!state.requestOpen) return '';
                if (hasExtensionRequestSubmitted()) {
                    return '<div style="padding:16px;">' +
                        '<div style="background:#fff7f8;border:1px solid #fecaca;border-radius:18px;padding:18px;text-align:center;box-shadow:0 12px 30px rgba(225,29,46,.10);">' +
                        '<div style="font-size:18px;font-weight:800;color:#b91c1c;">Request received</div>' +
                        '<div style="font-size:13px;color:#475569;margin-top:6px;">We will review your preferred extension and update your account shortly.</div>' +
                        '</div></div>';
                }
                return '<div style="padding:12px 16px 0;">' +
                    '<div style="background:#fff;border:1px solid #fecaca;border-radius:18px;padding:13px;box-shadow:0 12px 30px rgba(225,29,46,.10);">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;">' +
                    '<div><div style="font-size:13px;font-weight:750;color:#111827;">Request your preferred extension</div><div style="font-size:11px;color:#64748b;margin-top:2px;">Type your extension</div></div>' +
                    '<button id="redline_ext_request_send" style="border:0;border-radius:999px;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;font-size:12px;font-weight:800;padding:10px 15px;cursor:pointer;box-shadow:0 10px 22px rgba(225,29,46,.24);flex:0 0 auto;">' + (state.requestLoading ? 'Sending...' : 'Send') + '</button>' +
                    '</div>' +
                    '<label style="display:flex;align-items:center;gap:8px;background:#fff7f8;border:1px solid #fecaca;border-radius:14px;padding:10px 12px;">' +
                    '<span style="font-size:18px;font-weight:850;color:#b91c1c;line-height:1;">*</span>' +
                    '<input id="redline_ext_request_input" value="' + escapeHtml(state.requestExtension) + '" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Type your extension" style="min-width:0;flex:1;border:0;outline:none;font-size:18px;font-weight:750;color:#111827;background:transparent;letter-spacing:.04em;">' +
                    '<span style="font-size:11px;color:#94a3b8;">100-999</span>' +
                    '</label>' +
                    '</div>';
            }

            function renderDirectoryBody() {
                var hasExtension = hasOwnExtension();
                var requestSubmitted = hasExtensionRequestSubmitted();
                var requestOverlayHtml = requestSubmitted
                    ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.58);backdrop-filter:blur(.8px);"><div style="text-align:center;padding:0 26px;"><div style="font-size:22px;font-weight:850;color:#b91c1c;">Request received</div><div style="margin-top:8px;color:#475569;font-size:14px;font-weight:650;line-height:1.35;">We will review your preferred extension and update your account shortly.</div></div></div>'
                    : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.44);backdrop-filter:blur(.6px);"><div style="text-align:center;padding:0 24px;"><button id="redline_ext_request_overlay" style="border:0;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;border-radius:999px;padding:15px 26px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 18px 36px rgba(225,29,46,.34);">Request Extension</button><div class="redline-ext-hook-text">Limited Extension Slot left, Hurry up to book your slot.</div></div></div>';
                return '<div style="position:relative;min-height:0;flex:1;display:flex;flex-direction:column;">' +
                    '<div style="min-height:0;flex:1;display:flex;flex-direction:column;' + (hasExtension ? '' : 'filter:blur(.6px);opacity:.34;pointer-events:none;') + '">' +
                    '<div style="padding:13px 16px 0;flex:0 0 auto;"><input id="redline_ext_search" value="' + escapeHtml(state.query) + '" placeholder="Search company, name, ext..." style="width:100%;box-sizing:border-box;border:1px solid #fecaca;border-radius:14px;padding:12px 13px;font-size:13px;outline:none;background:#fff;color:#111827;box-shadow:0 5px 18px rgba(225,29,46,.08);"></div>' +
                    '<div id="redline_extension_list" style="min-height:0;flex:1;padding:4px 16px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>' +
                    '</div>' +
                    (hasExtension ? '' : requestOverlayHtml) +
                    '</div>';
            }

            function renderList() {
                var list = document.getElementById('redline_extension_list');
                if (!list) return;
                var items = filteredItems();
                var html = '';
                if (state.message) {
                    html += '<div style="font-size:12px;color:#64748b;padding:10px 2px;">' + escapeHtml(state.message) + '</div>';
                }
                if (!items.length && !state.message) {
                    html += '<div style="font-size:12px;color:#64748b;padding:10px 2px;">No matching extensions.</div>';
                }
                html += items.map(function (item, index) {
                    var isConnected = item.connected === true || item.connectionState === 'connected';
                    var statusLabel = isConnected ? 'Available' : 'Not connected';
                    var statusColor = isConnected ? '#16a34a' : '#94a3b8';
                    var buttonStyle = isConnected
                        ? 'border:0;border-radius:999px;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;font-size:11px;font-weight:700;padding:8px 12px;cursor:pointer;flex:0 0 auto;box-shadow:0 8px 18px rgba(225,29,46,.2);letter-spacing:.02em;'
                        : 'border:0;border-radius:999px;background:#e5e7eb;color:#94a3b8;font-size:11px;font-weight:700;padding:8px 12px;cursor:not-allowed;flex:0 0 auto;letter-spacing:.02em;';
                    return '<div data-ext-index="' + index + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb;">' +
                        '<div style="min-width:0;">' +
                        '<div style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(label(item)) + '</div>' +
                        '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + escapeHtml(item.roomName || '') + ' • <span style="font-weight:700;color:#334155;">Ext *' + escapeHtml(item.extension) + '</span> • <span style="color:' + statusColor + ';">' + statusLabel + '</span></div>' +
                        '</div>' +
                        '<button data-ext-call="' + index + '"' + (isConnected ? '' : ' disabled') + ' style="' + buttonStyle + '">' + (isConnected ? 'Call' : 'Offline') + '</button>' +
                        '</div>';
                }).join('');
                list.innerHTML = html;
                var buttons = list.querySelectorAll('[data-ext-call]');
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].onclick = function () {
                        var item = items[parseInt(this.getAttribute('data-ext-call'), 10)];
                        if (!item || item.connected !== true) return;
                        if (item) handleCall(item);
                    };
                }
            }

            function render() {
                var el = root();
                if (!state.visible) {
                    state.open = false;
                    el.innerHTML = '';
                    return;
                }
                clearExtensionRequestIfAssigned();
                var sipIcon = '<img src="' + publicAsset('/favicon.svg') + '" alt="Extension Directory" draggable="false" style="display:block;width:36px;height:36px;object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none;">';
                var rippleCss = '<style id="redline_ext_ripple_css">@keyframes redlineExtRipple{0%{transform:scale(.72);opacity:.42}70%{opacity:.12}100%{transform:scale(1.9);opacity:0}}#redline_ext_fab_wrap{position:fixed;right:20px;bottom:' + getFabBottom() + 'px;z-index:2147483646;width:74px;height:74px;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-user-select:none;user-select:none}#redline_ext_fab_wrap:before,#redline_ext_fab_wrap:after{content:"";position:absolute;inset:5px;border:2px solid rgba(217,45,32,.38);border-radius:999px;animation:redlineExtRipple 2.2s ease-out infinite}#redline_ext_fab_wrap:after{animation-delay:1.1s}.redline-ext-hook-text{display:inline-block;margin-top:14px;color:#991b1b;font-size:14px;font-weight:800;line-height:1.25;letter-spacing:-.01em}#redline_ext_fab{position:relative;z-index:1;width:62px;height:62px;border-radius:999px;border:4px solid #fff;background:linear-gradient(135deg,#d92d20,#b42318);color:#fff;box-shadow:0 18px 38px rgba(217,45,32,.42);display:flex;align-items:center;justify-content:center;cursor:grab;padding:0;transition:transform .16s ease,box-shadow .16s ease;-webkit-user-select:none;user-select:none}#redline_ext_fab:active{cursor:grabbing}#redline_ext_fab:hover{transform:translateY(-1px) scale(1.04);box-shadow:0 22px 46px rgba(217,45,32,.5)}</style>';
                el.innerHTML =
                    rippleCss +
                    '<div id="redline_ext_fab_wrap"><button id="redline_ext_fab" title="Search SIP extensions">' + sipIcon + '</button></div>' +
                    (state.open ? '<div id="redline_ext_backdrop" style="position:fixed;inset:0;z-index:2147483645;background:rgba(17,24,39,.26);backdrop-filter:blur(2px);"></div>' +
                        '<div style="' + getModalStyle() + '">' +
                        '<div style="display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #fee2e2;background:linear-gradient(90deg,#fff,#fff1f2);">' +
                        '<div><div style="font-size:16px;font-weight:650;color:#111827;letter-spacing:-.01em;">' + directoryTitle() + '</div><div style="font-size:12px;color:#6b7280;margin-top:2px;">Limited Extension Slot left, Hurry up to book your slot.</div></div>' +
                        '<button id="redline_ext_close" style="border:0;background:#fee2e2;color:#b91c1c;border-radius:10px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;">×</button>' +
                        '</div>' +
                        renderRequestForm() +
                        renderDirectoryBody() +
                        '</div>' : '');

                var fabWrap = document.getElementById('redline_ext_fab_wrap');
                var fabButton = document.getElementById('redline_ext_fab');
                var drag = { active: false, moved: false, suppressClick: false, startX: 0, startY: 0, startBottom: 0 };
                if (fabWrap) {
                    fabWrap.onpointerdown = function (event) {
                        if (event.button !== undefined && event.button !== 0) return;
                        drag.active = true;
                        drag.moved = false;
                        drag.suppressClick = false;
                        drag.startX = event.clientX;
                        drag.startY = event.clientY;
                        drag.startBottom = getFabBottom();
                        try { fabWrap.setPointerCapture(event.pointerId); } catch (e) { }
                    };
                    fabWrap.onpointermove = function (event) {
                        if (!drag.active) return;
                        var deltaX = event.clientX - drag.startX;
                        var deltaY = drag.startY - event.clientY;
                        if (Math.sqrt((deltaX * deltaX) + (deltaY * deltaY)) > 10) drag.moved = true;
                        if (!drag.moved) return;
                        drag.suppressClick = true;
                        state.bottom = clampBottom(drag.startBottom + deltaY);
                        fabWrap.style.bottom = state.bottom + 'px';
                    };
                    fabWrap.onpointercancel = function (event) {
                        drag.active = false;
                        try { fabWrap.releasePointerCapture(event.pointerId); } catch (e) { }
                    };
                    fabWrap.onpointerup = function (event) {
                        if (!drag.active) return;
                        drag.active = false;
                        try { fabWrap.releasePointerCapture(event.pointerId); } catch (e) { }
                        if (drag.moved) {
                            try { localStorage.setItem('redline_extension_widget_bottom', String(state.bottom)); } catch (e) { }
                            return;
                        }
                        state.open = !state.open;
                        render();
                        if (state.open) load(true);
                    };
                }
                if (fabButton) fabButton.onclick = function (event) {
                    if (drag.suppressClick) {
                        event.preventDefault();
                        event.stopPropagation();
                        drag.suppressClick = false;
                    }
                    return false;
                };
                var close = document.getElementById('redline_ext_close');
                if (close) close.onclick = function () { state.open = false; render(); };
                var requestOverlay = document.getElementById('redline_ext_request_overlay');
                if (requestOverlay) requestOverlay.onclick = function () { state.requestOpen = true; render(); };
                var requestInput = document.getElementById('redline_ext_request_input');
                if (requestInput) requestInput.oninput = function () { state.requestExtension = this.value.replace(/\D/g, '').slice(0, 3); this.value = state.requestExtension; };
                if (requestInput && state.requestOpen) setTimeout(function () { try { requestInput.focus(); } catch (e) { } }, 0);
                var requestSend = document.getElementById('redline_ext_request_send');
                if (requestSend) requestSend.onclick = submitExtensionRequest;
                var backdrop = document.getElementById('redline_ext_backdrop');
                if (backdrop) backdrop.onclick = function () { state.open = false; render(); };
                var search = document.getElementById('redline_ext_search');
                if (search) {
                    search.oninput = function () {
                        state.query = this.value;
                        renderList();
                    };
                    if (!state.requestOpen && hasOwnExtension()) setTimeout(function () { try { search.focus(); } catch (e) { } }, 0);
                }
                renderList();
            }

            window.RedlineExtensionDirectory = {
                configure: function (opts) {
                    opts = opts || {};
                    if (opts.apiBase) state.apiBase = opts.apiBase.replace(/\/$/, '');
                    if (opts.getToken) state.getToken = opts.getToken;
                    if (opts.getOwnExtension) state.getOwnExtension = opts.getOwnExtension;
                    if (opts.getUserEmail) state.getUserEmail = opts.getUserEmail;
                    if (opts.callExtension !== undefined) state.callExtension = opts.callExtension;
                    if (opts.visible !== undefined) state.visible = !!opts.visible;
                    clearExtensionRequestIfAssigned();
                    render();
                },
                open: function () {
                    if (!state.visible) return;
                    state.open = true;
                    render();
                    load(true);
                },
                setMessage: setMessage,
                setVisible: function (visible) {
                    state.visible = !!visible;
                    render();
                },
                refresh: function () {
                    state.loaded = false;
                    load(true);
                },
            };
            return window.RedlineExtensionDirectory;
        }

        if (config.extensionWidget === false) {
            console.log('[SIP] Extension directory widget disabled via config');
        } else ensureExtensionDirectoryWidget().configure({
            apiBase: apiBase,
            getToken: function () { return clientToken; },
            getOwnExtension: function () { return accountData && accountData.extension; },
            getUserEmail: function () { return accountData && accountData.email; },
            visible: false,
            callExtension: function (item, dialCode) {
                if (!clientToken) return { ok: false, message: 'Login required before calling ' + dialCode + '.' };
                fetch(apiBase + '/api/v1/client/direct-call/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                    body: JSON.stringify({ extension: item.extension }),
                })
                    .then(function (res) {
                        return res.json().then(function (json) {
                            if (!res.ok || !json.status) throw new Error(json.error || ('HTTP ' + res.status));
                            return json;
                        });
                    })
                    .then(function () {
                        renderDirectCallStatus('Calling extension', (item.companyName || '') + ' / ' + (item.displayName || '') + ' • ' + dialCode, false, 3000, 'info');
                    })
                    .catch(function (err) {
                        if (window.RedlineExtensionDirectory?.setMessage) window.RedlineExtensionDirectory.setMessage(err.message);
                        renderDirectCallStatus('Unable to call extension', err.message, false, 3000, 'warn');
                    });
                return { ok: true };
            },
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

        function getDirectCallBanner() {
            var banner = document.getElementById('redline_direct_call_banner');
            if (banner) return banner;

            banner = document.createElement('div');
            banner.id = 'redline_direct_call_banner';
            banner.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(360px,calc(100vw - 36px));background:linear-gradient(145deg,rgba(15,23,42,.98),rgba(30,41,59,.96));color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 18px 45px rgba(2,6,23,.36);font-family:Inter,Arial,sans-serif;padding:14px;display:none;backdrop-filter:blur(10px);';
            document.body.appendChild(banner);
            return banner;
        }

        function rejectDirectCall() {
            try {
                if (!clientToken) return;
                fetch(apiBase + '/api/v1/client/direct-call/decline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                }).catch(function (err) { console.error('[DIRECT] Decline failed:', err.message); });
                renderDirectCallStatus('Rejecting private call...', '', false, 2500);
            } catch (err) {
                console.error('[DIRECT] reject error:', err.message);
            }
        }

        function answerDirectCall() {
            try {
                if (!clientToken) return;
                fetch(apiBase + '/api/v1/client/direct-call/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
                }).catch(function (err) { console.error('[DIRECT] Accept failed:', err.message); });
                renderDirectCallStatus('Answering private call...', '', false, 2500, 'success');
            } catch (err) {
                console.error('[DIRECT] answer error:', err.message);
            }
        }

        function endDirectCall(options) {
            try {
                options = options || {};
                if (!clientToken || !directCallState) return;
                var url = apiBase + '/api/v1/client/direct-call/end';
                var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken };
                if (options.keepalive && navigator.sendBeacon) {
                    var blob = new Blob([JSON.stringify({})], { type: 'application/json' });
                    navigator.sendBeacon(url + '?token=' + encodeURIComponent(clientToken), blob);
                } else {
                    fetch(url, { method: 'POST', headers: headers, keepalive: !!options.keepalive })
                        .catch(function (err) { console.error('[DIRECT] End failed:', err.message); });
                }
                if (!options.silent) {
                    notifyDirectCallState('ending', { source: 'web' });
                    clearDirectCallState();
                    renderDirectCallStatus('Ending private call...', '', false, 2500, 'warn');
                }
            } catch (err) {
                console.error('[DIRECT] end error:', err.message);
            }
        }

        function formatDirectCallDuration(ms) {
            var total = Math.max(0, Math.floor((ms || 0) / 1000));
            var minutes = Math.floor(total / 60);
            var seconds = total % 60;
            return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }

        function clearDirectCallState() {
            directCallState = null;
            if (directCallTimer) { clearInterval(directCallTimer); directCallTimer = null; }
        }

        function renderActiveDirectCall() {
            if (!directCallState) return;
            renderDirectCallStatus(
                'Private call connected',
                directCallState.detail,
                false,
                0,
                'success',
                false,
                {
                    duration: formatDirectCallDuration(Date.now() - directCallState.startedAt),
                    showEnd: true,
                }
            );
        }

        function startDirectCallState(data, detail) {
            directCallState = {
                callId: data.callId,
                role: data.role,
                peer: data.peer,
                detail: detail,
                startedAt: Date.now(),
            };
            if (directCallTimer) clearInterval(directCallTimer);
            renderActiveDirectCall();
            directCallTimer = setInterval(renderActiveDirectCall, 1000);
            notifyDirectCallState('connected', data);
        }

        function getDirectCallTheme(tone) {
            if (tone === 'danger') return { accent: '#ef4444', bg: 'rgba(239,68,68,.14)', icon: '✕' };
            if (tone === 'success') return { accent: '#22c55e', bg: 'rgba(34,197,94,.14)', icon: '✓' };
            if (tone === 'warn') return { accent: '#f59e0b', bg: 'rgba(245,158,11,.14)', icon: '!' };
            return { accent: '#38bdf8', bg: 'rgba(56,189,248,.14)', icon: '☎' };
        }

        function renderDirectCallStatus(title, detail, showReject, autoHideMs, tone, showAnswer, options) {
            try {
                options = options || {};
                var banner = getDirectCallBanner();
                var theme = getDirectCallTheme(tone);
                if (directCallHideTimer) { clearTimeout(directCallHideTimer); directCallHideTimer = null; }
                var buttonHtml = '';
                if (showAnswer || showReject || options.showEnd) {
                    buttonHtml = '<div style="display:flex;gap:8px;margin-top:12px;">' +
                        (showAnswer ? '<button id="redline_direct_call_answer" style="flex:1;background:#22c55e;color:#fff;border:0;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(34,197,94,.25);">Answer</button>' : '') +
                        (showReject ? '<button id="redline_direct_call_reject" style="flex:1;background:#ef4444;color:#fff;border:0;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(239,68,68,.28);">Reject</button>' : '') +
                        (options.showEnd ? '<button id="redline_direct_call_end" style="flex:1;background:#ef4444;color:#fff;border:0;border-radius:11px;padding:10px 12px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(239,68,68,.28);">End Call</button>' : '') +
                        '</div>';
                }
                banner.innerHTML =
                    '<div style="display:flex;gap:12px;align-items:flex-start;">' +
                    '<div style="width:38px;height:38px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:' + theme.bg + ';color:' + theme.accent + ';font-size:18px;font-weight:800;flex:0 0 auto;">' + theme.icon + '</div>' +
                    '<div style="min-width:0;flex:1;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:3px;">' +
                    '<div style="font-size:14px;font-weight:800;line-height:1.2;letter-spacing:-.01em;">' + escapeHtml(title) + '</div>' +
                    '<div style="height:8px;width:8px;border-radius:999px;background:' + theme.accent + ';box-shadow:0 0 0 4px ' + theme.bg + ';flex:0 0 auto;"></div>' +
                    '</div>' +
                    (detail ? '<div style="font-size:12px;color:rgba(255,255,255,.74);line-height:1.35;margin-bottom:2px;">' + escapeHtml(detail) + '</div>' : '') +
                    (options.duration ? '<div style="display:inline-flex;align-items:center;gap:7px;margin-top:8px;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;font-weight:800;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;"><span style="width:7px;height:7px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.14);"></span>' + escapeHtml(options.duration) + '</div>' : '') +
                    buttonHtml +
                    '</div></div>';
                banner.style.display = 'block';
                var answerButton = document.getElementById('redline_direct_call_answer');
                if (answerButton) answerButton.onclick = answerDirectCall;
                var rejectButton = document.getElementById('redline_direct_call_reject');
                if (rejectButton) rejectButton.onclick = rejectDirectCall;
                var endButton = document.getElementById('redline_direct_call_end');
                if (endButton) endButton.onclick = function () { endDirectCall(); };
                if (autoHideMs) {
                    directCallHideTimer = setTimeout(function () {
                        banner.style.display = 'none';
                    }, autoHideMs);
                }
            } catch (err) { }
        }

        function handleDirectCallEvent(data) {
            if (!data || !data.type || data.type.indexOf('direct_call_') !== 0) return false;

            var peerName = data.peer && data.peer.displayName ? data.peer.displayName : 'user';
            var peerExt = data.peer && data.peer.extension ? 'Ext ' + data.peer.extension : '';
            var detail = peerName + (peerExt ? ' • ' + peerExt : '');
            var timeoutMs = data.timeoutMs || 15000;

            if (data.type === 'direct_call_incoming') {
                notifyDirectCallState('incoming', data);
                var showAnswer = config.directCallAnswerButton === true;
                renderDirectCallStatus('Incoming private call', detail + (showAnswer ? ' — answer here or reject' : ' — lift handset to accept'), true, timeoutMs + 2000, 'info', showAnswer);
            } else if (data.type === 'direct_call_outgoing') {
                notifyDirectCallState('outgoing', data);
                renderDirectCallStatus('Calling...', detail, false, timeoutMs + 2000, 'info');
            } else if (data.type === 'direct_call_answered') {
                startDirectCallState(data, detail);
            } else if (data.type === 'direct_call_busy') {
                notifyDirectCallState('busy', data);
                clearDirectCallState();
                renderDirectCallStatus('User busy', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_unavailable') {
                notifyDirectCallState('unavailable', data);
                clearDirectCallState();
                renderDirectCallStatus('Extension unavailable', data.message || ('Extension *' + (data.extension || '') + ' is not available'), false, 3000, 'warn');
            } else if (data.type === 'direct_call_declined') {
                notifyDirectCallState('declined', data);
                clearDirectCallState();
                renderDirectCallStatus('Private call declined', detail, false, 3000, 'danger');
            } else if (data.type === 'direct_call_missed') {
                notifyDirectCallState('missed', data);
                clearDirectCallState();
                renderDirectCallStatus('Private call missed', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_cancelled') {
                notifyDirectCallState('cancelled', data);
                clearDirectCallState();
                renderDirectCallStatus('Private call cancelled', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_ended') {
                notifyDirectCallState('ended', data);
                clearDirectCallState();
                renderDirectCallStatus('Private call ended', 'Returning to room', false, 3000, 'success');
            }
            return true;
        }

        function handleDirectCallPageExit() {
            if (!directCallState) return;
            endDirectCall({ keepalive: true, silent: true });
        }

        window.addEventListener('pagehide', handleDirectCallPageExit);
        window.addEventListener('beforeunload', handleDirectCallPageExit);

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
