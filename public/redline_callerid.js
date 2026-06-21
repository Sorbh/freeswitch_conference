/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// Redline CallerID Client — SSE-based CallerID display
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT IT DOES:
//   1. Reads room number from localStorage("room") — same as audiobridge.js
//   2. Connects to SSE endpoint for real-time CallerID events
//   3. Renders caller ID HTML into #caller_grid
//   4. Auto-reconnects with exponential backoff
//   5. Integrates with Offline.js (optional)
//
// REQUIRED HTML ELEMENTS:
//   <div id="caller_grid"></div>
//
// HOW TO USE (single script tag, no function calls needed):
//   <script src="/redline_callerid.js"></script>
//
//   That's it. It auto-reads room from localStorage and connects.
//
// LOCALSTORAGE FORMAT (set by Vue app on login):
//   localStorage.setItem("room", "123456701");
//   localStorage.setItem("user_data", JSON.stringify({
//     id: 201,
//     email: "phoenix.blueyellowline@gmail.com",
//     is_sip: 1,
//     user_type: 2,
//     name: "Phoenix SB",
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
//
// OPTIONAL CONFIG (set before loading this script):
//   window.CALLERID_CONFIG = {
//     sseBase: '',              // API server base URL (empty = same origin)
//     room: '123456701',        // override room (default: reads localStorage)
//     email: '',                // email for client login (default: reads localStorage user_data)
//     password: '12345678',     // SIP password (default: 12345678)
//     token: '',                // pre-fetched client JWT (skips login if set)
//   };
//
// OPTIONAL CALLBACKS (set before or after loading):
//   window.updateOnlineCounts = function(onlineMap) { ... }  // { roomId: count }
//   window.onCallerIdUpdate = function(callerIdHtml) { ... } // raw HTML array
//
// MANUAL CONTROL (if needed):
//   window.callerIdSSE.reconnect()   // force reconnect
//   window.callerIdSSE.disconnect()  // stop and clear
//   window.callerIdSSE.getRoom()     // get current room
//   window.RedlineExtensionDirectory.open() // open extension search
//
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    var config = window.CALLERID_CONFIG || { sseBase: 'https://hotline.redlineusedautoparts.com/fs' };
    var sseBase = config.sseBase || window.CALLERID_SSE_BASE || '';
    var room = config.room || window.CALLERID_ROOM || localStorage.getItem("room");
    var clientToken = config.token || null;

    console.log("[CallerID] Initializing...");
    console.log("[CallerID] Config:", JSON.stringify(config));
    console.log("[CallerID] sseBase:", sseBase);
    console.log("[CallerID] Room:", room);

    if (!room) {
        console.error("[CallerID] No room configured. Set localStorage 'room' or window.CALLERID_CONFIG.room");
        return;
    }

    var eventSource = null;
    var reconnectTimeout = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_DELAY = 30000;
    var directCallHideTimer = null;
    var conferenceStatusTimer = null;

    function getGrid() {
        try { return document.getElementById("caller_grid"); } catch (e) { return null; }
    }

    function renderCallerIds(callerIdHtml) {
        try {
            var grid = getGrid();
            if (!grid) {
                console.warn("[CallerID] #caller_grid element not found in DOM");
                return;
            }
            console.log("[CallerID] Rendering", (callerIdHtml || []).length, "caller IDs");
            grid.innerHTML = (callerIdHtml || []).join('');
            if (typeof window.onCallerIdUpdate === 'function') {
                window.onCallerIdUpdate(callerIdHtml);
            }
        } catch (e) {
            console.error("[CallerID] Render error:", e.message);
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
            callExtension: null,
            items: [],
            loaded: false,
            loading: false,
            query: '',
            message: '',
            open: false,
            visible: false,
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

        function filteredItems() {
            var q = (state.query || '').toLowerCase().trim();
            if (!q) return state.items;
            return state.items.filter(function (item) {
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
                var isConnected = item.connected === true;
                var statusLabel = isConnected ? 'Available' : 'Not connected';
                var statusColor = isConnected ? '#16a34a' : '#94a3b8';
                var buttonStyle = isConnected
                    ? 'border:0;border-radius:999px;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;font-size:11px;font-weight:700;padding:8px 12px;cursor:pointer;flex:0 0 auto;box-shadow:0 8px 18px rgba(225,29,46,.2);letter-spacing:.02em;'
                    : 'border:0;border-radius:999px;background:#e5e7eb;color:#94a3b8;font-size:11px;font-weight:700;padding:8px 12px;cursor:not-allowed;flex:0 0 auto;letter-spacing:.02em;';
                return '<div data-ext-index="' + index + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb;">' +
                    '<div style="min-width:0;">' +
                    '<div style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(label(item)) + '</div>' +
                    '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + escapeHtml(item.roomName || '') + ' • Ext *' + escapeHtml(item.extension) + ' • <span style="color:' + statusColor + ';">' + statusLabel + '</span></div>' +
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
            var sipIcon = '<span style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;"><svg viewBox="0 0 32 32" width="31" height="31" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><path d="M10.2 5.8 7.8 8.2c-.9.9-1.2 2.3-.8 3.5 2.3 7.1 7.9 12.7 15 15 .6.2 1.2.2 1.8.1.7-.1 1.3-.4 1.7-.9l2.5-2.4c.8-.8.8-2.2 0-3l-3.2-3.2c-.7-.7-1.9-.8-2.7-.2l-2.5 1.8c-2.8-1.4-5.1-3.7-6.5-6.5l1.8-2.5c.6-.8.5-2-.2-2.7l-3.2-3.2c-.9-.8-2.3-.8-3.1 0Z"></path><path d="M20.5 5.2c3 .9 5.4 3.3 6.3 6.3"></path><path d="M20.8 10.2c1.2.4 2.1 1.3 2.5 2.5"></path></svg><span style="position:absolute;right:-7px;top:-7px;background:#fff;color:#e11d2e;border-radius:999px;font-size:8px;font-weight:700;line-height:1;padding:3px 4px;letter-spacing:.03em;">SIP</span></span>';
            var rippleCss = '<style id="redline_ext_ripple_css">@keyframes redlineExtRipple{0%{transform:scale(.72);opacity:.42}70%{opacity:.12}100%{transform:scale(1.9);opacity:0}}#redline_ext_fab_wrap{position:fixed;right:20px;bottom:' + getFabBottom() + 'px;z-index:2147483646;width:74px;height:74px;display:flex;align-items:center;justify-content:center;touch-action:none}#redline_ext_fab_wrap:before,#redline_ext_fab_wrap:after{content:"";position:absolute;inset:5px;border:2px solid rgba(225,29,46,.38);border-radius:999px;animation:redlineExtRipple 2.2s ease-out infinite}#redline_ext_fab_wrap:after{animation-delay:1.1s}#redline_ext_fab{position:relative;z-index:1;width:62px;height:62px;border-radius:999px;border:4px solid #fff;background:linear-gradient(135deg,#e11d2e,#b91c1c);color:#fff;box-shadow:0 18px 38px rgba(185,28,28,.42);display:flex;align-items:center;justify-content:center;cursor:grab;padding:0;transition:transform .16s ease,box-shadow .16s ease}#redline_ext_fab:active{cursor:grabbing}#redline_ext_fab:hover{transform:translateY(-1px) scale(1.04);box-shadow:0 22px 46px rgba(185,28,28,.48)}</style>';
            el.innerHTML =
                rippleCss +
                '<div id="redline_ext_fab_wrap"><button id="redline_ext_fab" title="Search SIP extensions">' + sipIcon + '</button></div>' +
                (state.open ? '<div id="redline_ext_backdrop" style="position:fixed;inset:0;z-index:2147483645;background:rgba(17,24,39,.26);backdrop-filter:blur(2px);"></div>' +
                    '<div style="' + getModalStyle() + '">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #fee2e2;background:linear-gradient(90deg,#fff,#fff1f2);">' +
                    '<div><div style="font-size:16px;font-weight:650;color:#111827;letter-spacing:-.01em;"><span style="color:#e11d2e;font-weight:750;">SIP</span> Extension Directory</div><div style="font-size:12px;color:#6b7280;margin-top:2px;">Search user and start a private extension call</div></div>' +
                    '<button id="redline_ext_close" style="border:0;background:#fee2e2;color:#b91c1c;border-radius:10px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;">×</button>' +
                    '</div>' +
                    '<div style="padding:13px 16px 0;"><input id="redline_ext_search" value="' + escapeHtml(state.query) + '" placeholder="Search company, name, ext..." style="width:100%;box-sizing:border-box;border:1px solid #fecaca;border-radius:14px;padding:12px 13px;font-size:13px;outline:none;background:#fff;color:#111827;box-shadow:0 5px 18px rgba(225,29,46,.08);"></div>' +
                    '<div id="redline_extension_list" style="padding:4px 16px 14px;overflow:auto;"></div>' +
                    '</div>' : '');

            var fabWrap = document.getElementById('redline_ext_fab_wrap');
            var fabButton = document.getElementById('redline_ext_fab');
            var drag = { active: false, moved: false, startY: 0, startBottom: 0 };
            if (fabWrap) {
                fabWrap.onpointerdown = function (event) {
                    drag.active = true;
                    drag.moved = false;
                    drag.startY = event.clientY;
                    drag.startBottom = getFabBottom();
                    try { fabWrap.setPointerCapture(event.pointerId); } catch (e) { }
                };
                fabWrap.onpointermove = function (event) {
                    if (!drag.active) return;
                    var delta = drag.startY - event.clientY;
                    if (Math.abs(delta) > 4) drag.moved = true;
                    if (!drag.moved) return;
                    state.bottom = clampBottom(drag.startBottom + delta);
                    fabWrap.style.bottom = state.bottom + 'px';
                };
                fabWrap.onpointerup = function (event) {
                    if (!drag.active) return;
                    drag.active = false;
                    try { fabWrap.releasePointerCapture(event.pointerId); } catch (e) { }
                    if (drag.moved) {
                        try { localStorage.setItem('redline_extension_widget_bottom', String(state.bottom)); } catch (e) { }
                        render();
                        return;
                    }
                    state.open = !state.open;
                    render();
                    if (state.open) load(false);
                };
            }
            if (fabButton) fabButton.onclick = function () {
                return false;
            };
            var close = document.getElementById('redline_ext_close');
            if (close) close.onclick = function () { state.open = false; render(); };
            var backdrop = document.getElementById('redline_ext_backdrop');
            if (backdrop) backdrop.onclick = function () { state.open = false; render(); };
            var search = document.getElementById('redline_ext_search');
            if (search) {
                search.oninput = function () {
                    state.query = this.value;
                    renderList();
                };
                setTimeout(function () { try { search.focus(); } catch (e) { } }, 0);
            }
            renderList();
        }

        window.RedlineExtensionDirectory = {
            configure: function (opts) {
                opts = opts || {};
                if (opts.apiBase) state.apiBase = opts.apiBase.replace(/\/$/, '');
                if (opts.getToken) state.getToken = opts.getToken;
                if (opts.callExtension !== undefined) state.callExtension = opts.callExtension;
                if (opts.visible !== undefined) state.visible = !!opts.visible;
                render();
            },
            open: function () {
                if (!state.visible) return;
                state.open = true;
                render();
                load(false);
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

    ensureExtensionDirectoryWidget().configure({
        apiBase: sseBase,
        getToken: function () { return clientToken; },
        visible: false,
        callExtension: function (item, dialCode) {
            if (!clientToken) return { ok: false, message: 'Login required before calling ' + dialCode + '.' };
            fetch(sseBase + '/api/v1/client/direct-call/start', {
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

    function updateExtensionDirectoryVisibility() {
        if (!clientToken) {
            if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
            return;
        }

        fetch(sseBase + '/api/v1/client/conference-status', {
            headers: { 'Authorization': 'Bearer ' + clientToken },
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (json) {
                var inConference = !!(json && json.data && json.data.inConference);
                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(inConference);
            })
            .catch(function () {
                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
            });
    }

    function startConferenceStatusPolling() {
        updateExtensionDirectoryVisibility();
        if (conferenceStatusTimer) clearInterval(conferenceStatusTimer);
        conferenceStatusTimer = setInterval(updateExtensionDirectoryVisibility, 5000);
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
            fetch(sseBase + '/api/v1/client/direct-call/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
            }).catch(function (err) { console.error('[CallerID] Direct decline failed:', err.message); });
            renderDirectCallStatus('Rejecting private call...', '', false, 2500);
        } catch (err) {
            console.error('[CallerID] reject error:', err.message);
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

    function getReconnectDelay() {
        var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        return delay;
    }

    function doLogin(cb) {
        var base = sseBase;
        var email = config.email || '';
        var password = config.password || '12345678';

        if (!email) {
            try {
                var raw = localStorage.getItem("user_data");
                if (raw) { var ud = JSON.parse(raw); email = ud.email || (ud.user_detail || {}).email || ''; }
            } catch (e) { }
        }

        if (!email) {
            console.error("[CallerID] No email for login. Set CALLERID_CONFIG.email or localStorage user_data");
            return;
        }

        fetch(base + "/api/v1/client/login", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password }),
        })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (json) {
            clientToken = json.token;
            if (json.data && (json.data.current_room || json.data.room)) {
                room = json.data.current_room || json.data.room;
            }
            console.log("[CallerID] Login successful, token acquired, room:", room);
            startConferenceStatusPolling();
            if (cb) cb();
        })
        .catch(function (e) {
            console.error("[CallerID] Login failed:", e.message);
            var delay = getReconnectDelay();
            reconnectTimeout = setTimeout(function () { doLogin(cb); }, delay);
        });
    }

    function connect() {
        if (!clientToken) { doLogin(connect); return; }
        startConferenceStatusPolling();

        try {
            if (eventSource) { eventSource.close(); eventSource = null; }

            var base = sseBase;
            var url = base + "/api/v1/client/events/room/" + room + "?token=" + clientToken;
            console.log("[CallerID] Connecting to SSE:", url);
            eventSource = new EventSource(url);

            eventSource.onopen = function () {
                reconnectAttempts = 0;
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                console.log("[CallerID] SSE connected to room", room);
                try {
                    if (typeof Offline !== 'undefined' && Offline.state !== 'up') {
                        Offline.options.checks.active = 'up';
                        Offline.check();
                    }
                } catch (e) { }
            };

            eventSource.onmessage = function (event) {
                try {
                    console.log("[CallerID] SSE message received:", event.data.substring(0, 200));
                    var data = JSON.parse(event.data);
                    if (handleDirectCallEvent(data)) return;
                    if (data.ts) {
                        console.log("[CallerID] [TIMING] server -> browser: +" + (Date.now() - data.ts) + "ms", data.type, data.callerIds || '');
                    }
                    if (data.callerIdHtml) {
                        renderCallerIds(data.callerIdHtml);
                    }
                    if (data.online && typeof window.updateOnlineCounts === 'function') {
                        console.log("[CallerID] Online counts:", JSON.stringify(data.online));
                        window.updateOnlineCounts(data.online);
                    }
                } catch (e) {
                    console.error("[CallerID] Message parse error:", e.message, "Raw:", event.data.substring(0, 200));
                }
            };

            eventSource.onerror = function (err) {
                console.error("[CallerID] SSE error event fired. readyState:", eventSource ? eventSource.readyState : "null");
                try {
                    if (eventSource) { eventSource.close(); eventSource = null; }
                    var grid = getGrid();
                    if (grid) grid.innerHTML = '';
                    if (typeof Offline !== 'undefined' && Offline.state !== 'down') {
                        Offline.options.checks.active = 'down';
                        Offline.check();
                    }
                } catch (e) { }

                var delay = getReconnectDelay();
                console.warn("[CallerID] Connection lost, reconnecting in " + (delay / 1000) + "s (attempt " + reconnectAttempts + ")");
                reconnectTimeout = setTimeout(connect, delay);
            };
        } catch (e) {
            console.error("[CallerID] Connect error:", e.message);
            var delay = getReconnectDelay();
            reconnectTimeout = setTimeout(connect, delay);
        }
    }

    // ── Offline.js integration ──
    try {
        if (typeof Offline !== 'undefined') {
            Offline.options = {
                checks: {},
                checkOnLoad: false,
                interceptRequests: false,
                reconnect: { initialDelay: 30 },
                requests: true,
                game: false,
            };
            Offline.on("reconnect:connecting", connect);
        }
    } catch (e) { }

    // ── Auto-connect ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // ── Public API ──
    window.callerIdSSE = {
        reconnect: function () { reconnectAttempts = 0; connect(); },
        disconnect: function () {
            try {
                if (eventSource) { eventSource.close(); eventSource = null; }
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                var grid = getGrid();
                if (grid) grid.innerHTML = '';
            } catch (e) {
                console.error("[CallerID] Disconnect error:", e.message);
            }
        },
        getRoom: function () { return room; },
    };
})();
