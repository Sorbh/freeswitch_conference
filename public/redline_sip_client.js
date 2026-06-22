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
//     defaultPassword: '12345678' // SIP password (also used for /client/login)
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
//
// OPTIONAL CALLBACKS (set before or after loading):
//   window.onHotlineReady = function(accountData) { ... }     // fired when registered + account loaded
//   window.onHotlineCallState = function(state) { ... }       // 'connected' or 'disconnected'
//   window.onHotlineRoomChange = function(data) { ... }       // { source, room, roomName } — called on room change (API or SSE)
//   window.updateOnlineCounts = function(onlineMap) { ... }   // { roomId: count, ... }
//
// MANUAL CONTROL (if needed):
//   window.hotlineClient.login('email@example.com')  // login with specific email
//   window.hotlineClient.toggleMute()                // Ctrl+L equivalent
//   window.hotlineClient.joinConference()            // request server to call this user
//   window.hotlineClient.hangup()                    // end current call
//   window.hotlineClient.logout()                    // disconnect everything
//   window.hotlineClient.getRoomDetails()             // get all rooms with online counts
//   window.hotlineClient.changeRoom(roomId)          // switch to a different room (reloads page)
//   window.hotlineClient.getAccount()                // get loaded account data
//   window.hotlineClient.isConnected()               // true if in active call
//   window.hotlineClient.isMuted()                   // true if muted
//   window.RedlineExtensionDirectory.open()          // open extension search
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

        var ua = null;
        var currentSession = null;
        var isMuted = true;
        var accountData = null;
        var clientToken = null;
        var loggingOut = false;
        var regRetryTimer = null;
        var callerIdSource = null;
        var lastHeartbeat = Date.now();
        var callerIdReconnectAttempts = 0;
        var directCallHideTimer = null;

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
                    setMessage(result.message || ('Calling ' + dialCode));
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
                        if (window.RedlineExtensionDirectory?.setMessage) window.RedlineExtensionDirectory.setMessage('Calling ' + dialCode + '...');
                        renderDirectCallStatus('Calling extension', (item.companyName || '') + ' / ' + (item.displayName || '') + ' • ' + dialCode, false, 3000, 'info');
                    })
                    .catch(function (err) {
                        if (window.RedlineExtensionDirectory?.setMessage) window.RedlineExtensionDirectory.setMessage(err.message);
                        renderDirectCallStatus('Unable to call extension', err.message, false, 3000, 'warn');
                    });
                return { ok: true, message: 'Calling ' + dialCode + '...' };
            },
        });

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

        function getDirectCallTheme(tone) {
            if (tone === 'danger') return { accent: '#ef4444', bg: 'rgba(239,68,68,.14)', icon: '✕' };
            if (tone === 'success') return { accent: '#22c55e', bg: 'rgba(34,197,94,.14)', icon: '✓' };
            if (tone === 'warn') return { accent: '#f59e0b', bg: 'rgba(245,158,11,.14)', icon: '!' };
            return { accent: '#38bdf8', bg: 'rgba(56,189,248,.14)', icon: '☎' };
        }

        function renderDirectCallStatus(title, detail, showReject, autoHideMs, tone) {
            try {
                var banner = getDirectCallBanner();
                var theme = getDirectCallTheme(tone);
                if (directCallHideTimer) { clearTimeout(directCallHideTimer); directCallHideTimer = null; }
                banner.innerHTML =
                    '<div style="display:flex;gap:12px;align-items:flex-start;">' +
                    '<div style="width:38px;height:38px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:' + theme.bg + ';color:' + theme.accent + ';font-size:18px;font-weight:800;flex:0 0 auto;">' + theme.icon + '</div>' +
                    '<div style="min-width:0;flex:1;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:3px;">' +
                    '<div style="font-size:14px;font-weight:800;line-height:1.2;letter-spacing:-.01em;">' + escapeHtml(title) + '</div>' +
                    '<div style="height:8px;width:8px;border-radius:999px;background:' + theme.accent + ';box-shadow:0 0 0 4px ' + theme.bg + ';flex:0 0 auto;"></div>' +
                    '</div>' +
                    (detail ? '<div style="font-size:12px;color:rgba(255,255,255,.74);line-height:1.35;margin-bottom:' + (showReject ? '12px' : '2px') + ';">' + escapeHtml(detail) + '</div>' : '') +
                    (showReject ? '<button id="redline_direct_call_reject" style="width:100%;background:#ef4444;color:#fff;border:0;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(239,68,68,.28);">Reject</button>' : '') +
                    '</div></div>';
                banner.style.display = 'block';
                var rejectButton = document.getElementById('redline_direct_call_reject');
                if (rejectButton) rejectButton.onclick = rejectDirectCall;
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
                renderDirectCallStatus('Incoming private call', detail + ' — lift handset to accept', true, timeoutMs + 2000, 'info');
            } else if (data.type === 'direct_call_outgoing') {
                renderDirectCallStatus('Calling...', detail, false, timeoutMs + 2000, 'info');
            } else if (data.type === 'direct_call_answered') {
                renderDirectCallStatus('Private call connected', detail, false, 0, 'success');
            } else if (data.type === 'direct_call_busy') {
                renderDirectCallStatus('User busy', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_unavailable') {
                renderDirectCallStatus('Extension unavailable', data.message || ('Extension *' + (data.extension || '') + ' is not available'), false, 3000, 'warn');
            } else if (data.type === 'direct_call_declined') {
                renderDirectCallStatus('Private call declined', detail, false, 3000, 'danger');
            } else if (data.type === 'direct_call_missed') {
                renderDirectCallStatus('Private call missed', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_cancelled') {
                renderDirectCallStatus('Private call cancelled', detail, false, 3000, 'warn');
            } else if (data.type === 'direct_call_ended') {
                renderDirectCallStatus('Private call ended', 'Returning to room', false, 3000, 'success');
            }
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
                if (tracks.length > 0) {
                    var el = ensureAudioElement();
                    if (!el) return;
                    el.srcObject = new MediaStream(tracks);
                    el.play().catch(function (e) { });
                }
            } catch (e) { }
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

                _startSipRegistration(email, password);
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
                                    muteAudio(true);
                                    attachRemoteAudio(session);
                                    if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(true);
                                    if (typeof window.onHotlineCallState === 'function') {
                                        window.onHotlineCallState('connected');
                                    }
                                } catch (e) { }
                            });
                            session.on('failed', function (e) {
                                currentSession = null;
                                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState('disconnected');
                            });
                            session.on('ended', function (e) {
                                currentSession = null;
                                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                                if (typeof window.onHotlineCallState === 'function') window.onHotlineCallState('disconnected');
                            });
                            session.answer({
                                mediaConstraints: { audio: true, video: false },
                                pcConfig: { iceServers: [{ urls: "stun:74.125.250.129:19302" }] },
                            });
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

        // ── Actions ──
        function toggleMute() {
            try {
                isMuted = !isMuted;
                muteAudio(isMuted);

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
                        window._muteToggleAt = Date.now();
                        console.log('[TIMING] Ctrl+L pressed — ' + (isMuted ? 'unmuting' : 'muting'));
                        if (accountData) toggleMute();
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
            getRoomDetails: getRoomDetails,
            changeRoom: changeRoom,
            getAccount: function () { return accountData; },
            getLocalData: getLocalStorageUserData,
            isConnected: function () { return !!currentSession; },
            isMuted: function () { return isMuted; },
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
