/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// Redline CallerID Client — SSE-based CallerID display
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT IT DOES:
//   1. Reads room number from localStorage("room") — same as audiobridge.js
//   2. Connects to SSE endpoint for real-time CallerID events
//   3. Renders caller ID HTML into #caller_grid
//   4. Shows direct-call notification banners from SSE events
//   5. Auto-reconnects with exponential backoff
//   6. Integrates with Offline.js (optional)
//
// REQUIRED HTML ELEMENTS:
//   <div id="caller_grid"></div>
//
// HOW TO USE (single script tag, no function calls needed):
//   <script src="https://hotline.redlineusedautoparts.com/redline_callerid.js"></script>
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
//   window.HOTLINE_CONFIG = {
//     apiBase: '',              // API base URL (default: https://hotline.redlineusedautoparts.com/fs)
//     baseUrl: '',              // origin serving the shared helper scripts (redline_push.js,
//                               // redline_extensions.js); default: https://hotline.redlineusedautoparts.com
//     room: '123456701',        // override room (default: reads localStorage)
//     email: '',                // email for client login (default: reads localStorage user_data)
//     password: '12345678',     // SIP password (default: 12345678)
//     token: '',                // pre-fetched client JWT (skips login if set)
//     extensionWidget: true,    // set false to disable floating extension directory (default: true)
//     pushNotifications: false,  // set true to enable loading push notification module (default: false)
//     directCallAnswerButton: false, // set true to show Answer button in incoming direct-call notifications
//   };
//
// OPTIONAL CALLBACKS:
//   window.onHotlineRoomChange = function(data) { ... }      // { source, room, roomName } — called on room change (API or SSE)
//   window.updateOnlineCounts = function(onlineMap) { ... }  // { roomId: count, ... }
//   window.onCallerIdUpdate = function(callerIdHtml) { ... } // raw caller ID HTML array
//
// MANUAL CONTROL (if needed):
//   window.hotlineClient.login('email@example.com')               // login with specific email
//   window.hotlineClient.logout()                                 // disconnect and clear session
//   window.hotlineClient.reconnect()                              // force reconnect SSE
//   window.hotlineClient.disconnect()                             // stop SSE and clear grid
//   window.hotlineClient.getRoom()                                // get current room
//   window.hotlineClient.getRoomDetails()                         // get all rooms with online counts
//   window.hotlineClient.changeRoom(roomId)                       // switch to a different room (reloads page)
//   window.hotlineClient.requestRoom({ city, state, message })    // request a new room
//   window.hotlineClient.getAccount()                             // get loaded account data
//   window.RedlineExtensionDirectory.open()                       // open extension search
//
// SSE EVENTS HANDLED:
//   callerid      — caller ID HTML + online counts
//   online_update — online/offline count changes
//   room_change   — user changed room (auto-reloads if current user)
//   direct_call_* — incoming/outgoing direct-call notification banners only
//
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    var config = window.HOTLINE_CONFIG || {};
    // Origin hosting the shared helper scripts (redline_push.js, redline_extensions.js)
    var baseUrl = (config.baseUrl || 'https://hotline.redlineusedautoparts.com').replace(/\/$/, '');
    var apiBase = config.apiBase || 'https://hotline.redlineusedautoparts.com/fs';
    var room = config.room || window.CALLERID_ROOM || localStorage.getItem("room");
    var clientToken = config.token || null;
    var accountData = config.accountData || null;

    console.log("[CallerID] Initializing...");
    console.log("[CallerID] Config:", JSON.stringify(config));
    console.log("[CallerID] apiBase:", apiBase);
    console.log("[CallerID] Room:", room);

    if (!room) {
        console.error("[CallerID] No room configured. Set localStorage 'room' or HOTLINE_CONFIG.room");
        return;
    }

    var eventSource = null;
    var reconnectTimeout = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_DELAY = 30000;
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
            console.log('[CallerID] Extension directory widget disabled via config');
            window.RedlineExtensionDirectory.configure({ disabled: true });
        } else window.RedlineExtensionDirectory.configure({
            apiBase: apiBase,
            getToken: function () { return clientToken; },
            getOwnExtension: function () { return accountData && accountData.extension; },
            getUserEmail: function () { return accountData && accountData.email; },
            visible: false,
        });
    });

    function updateExtensionDirectoryVisibility() {
        if (!clientToken) {
            if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
            return;
        }

        fetch(apiBase + '/api/v1/client/conference-status', {
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

    // Direct-call banner + handlers live in redline_extensions.js (RedlineDirectCall)
    function handleDirectCallEvent(data) {
        if (!data || !data.type || data.type.indexOf('direct_call_') !== 0) return false;
        if (window.RedlineDirectCall) window.RedlineDirectCall.handleEvent(data);
        return true;
    }

    // ── Push notifications (shared module: redline_push.js) ──
    function initPushNotifications(getToken) {
        if (config.pushNotifications !== true) {
            console.log('[CallerID] Push notifications disabled (set pushNotifications: true to enable)');
            return;
        }
        function start() {
            window.RedlinePush.init({
                apiBase: apiBase,
                getToken: getToken,
                prompt: config.pushPrompt !== false,
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

    function getReconnectDelay() {
        var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        return delay;
    }

    function doLogin(cb) {
        var base = apiBase;
        var email = config.email || '';
        var password = config.password || '12345678';

        if (!email) {
            try {
                var raw = localStorage.getItem("user_data");
                if (raw) { var ud = JSON.parse(raw); email = ud.email || (ud.user_detail || {}).email || ''; }
            } catch (e) { }
        }

        if (!email) {
            console.error("[CallerID] No email for login. Set HOTLINE_CONFIG.email or localStorage user_data");
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
                accountData = json.data || null;
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
        initPushNotifications(function () { return clientToken; });

        try {
            if (eventSource) { eventSource.close(); eventSource = null; }

            var base = apiBase;
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
                    if (data.type === 'room_change') {
                        var myEmail = accountData && accountData.email;
                        if (myEmail && data.email === myEmail) {
                            console.log("[CallerID] Own room changed to", data.toRoom);
                            if (typeof window.onHotlineRoomChange === 'function') {
                                window.onHotlineRoomChange({ source: 'sse', room: data.toRoom, roomName: data.toRoomName, direction: data.direction });
                            } else {
                                window.location.reload();
                            }
                            return;
                        }
                    }
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

    // ── Room API ──
    function getRoomDetails() {
        if (!clientToken) { console.error('[CallerID] getRoomDetails: not logged in'); return Promise.reject(new Error('Not logged in')); }
        return fetch(apiBase + '/api/v1/client/rooms/details', {
            headers: { 'Authorization': 'Bearer ' + clientToken },
        })
            .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json.data; }); });
    }

    function changeRoom(newRoomId) {
        if (!clientToken) { console.error('[CallerID] changeRoom: not logged in'); return Promise.reject(new Error('Not logged in')); }
        return fetch(apiBase + '/api/v1/client/room/change', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
            body: JSON.stringify({ room: newRoomId }),
        })
            .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); })
            .then(function (json) {
                console.log('[CallerID] Room changed to', json.room, json.roomName);
                room = json.room;
                if (typeof window.onHotlineRoomChange === 'function') {
                    window.onHotlineRoomChange({ source: 'api', room: json.room, roomName: json.roomName });
                } else {
                    window.location.reload();
                }
                return json;
            });
    }

    function requestRoom(data) {
        if (!clientToken) { console.error('[CallerID] requestRoom: not logged in'); return Promise.reject(new Error('Not logged in')); }
        return fetch(apiBase + '/api/v1/client/room-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientToken },
            body: JSON.stringify(data),
        })
            .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); });
    }

    // ── Public API ──
    window.hotlineClient = {
        login: function (email) {
            if (email) config.email = email;
            doLogin(connect);
        },
        logout: function () {
            try {
                clientToken = null;
                accountData = null;
                if (eventSource) { eventSource.close(); eventSource = null; }
                if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
                if (conferenceStatusTimer) { clearInterval(conferenceStatusTimer); conferenceStatusTimer = null; }
                var grid = getGrid();
                if (grid) grid.innerHTML = '';
                if (window.RedlineExtensionDirectory?.setVisible) window.RedlineExtensionDirectory.setVisible(false);
                console.log("[CallerID] Logged out");
            } catch (e) {
                console.error("[CallerID] Logout error:", e.message);
            }
        },
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
        getRoomDetails: getRoomDetails,
        changeRoom: changeRoom,
        requestRoom: requestRoom,
        getAccount: function () { return accountData; },
        enablePush: function () { return window.RedlinePush ? window.RedlinePush.enable() : Promise.reject(new Error('Push module not loaded')); },
        disablePush: function () { return window.RedlinePush ? window.RedlinePush.disable() : Promise.resolve(false); },
    };
})();
