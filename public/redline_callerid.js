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
