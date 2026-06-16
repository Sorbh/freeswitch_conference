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
    var config = window.CALLERID_CONFIG || { sseBase: 'https://hotline.redlineusedautoparts.com/fs/' };
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

    function getReconnectDelay() {
        var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        return delay;
    }

    function doLogin(cb) {
        var base = sseBase.indexOf('://') === -1 ? 'https://' + sseBase : sseBase;
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
            console.log("[CallerID] Login successful, token acquired");
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

            var base = sseBase.indexOf('://') === -1 ? 'https://' + sseBase : sseBase;
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
