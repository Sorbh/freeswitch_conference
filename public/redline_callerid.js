/* eslint-disable */
// CallerID SSE Client — replaces audiobridge_sip.js (Janus WebRTC)
// Usage: set window.CALLERID_ROOM = 123456701 before loading
// Requires: #caller_grid element in the DOM, Offline.js (optional)

(function () {
    var SSE_BASE = window.CALLERID_SSE_BASE || '';
    var room = window.CALLERID_ROOM || localStorage.getItem("room");
    if (!room) {
        console.error("[CallerID-SSE] No room configured. Set window.CALLERID_ROOM or localStorage room.");
        return;
    }

    var eventSource = null;
    var reconnectTimeout = null;

    function getGrid() {
        return document.getElementById("caller_grid");
    }

    function renderCallerIds(callerIdHtml) {
        var grid = getGrid();
        if (!grid) return;
        grid.innerHTML = (callerIdHtml || []).join('');
    }

    function connect() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        eventSource = new EventSource(SSE_BASE + "/api/v1/admin/events/room/" + room);

        eventSource.onopen = function () {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (typeof Offline !== 'undefined' && Offline.state !== 'up') {
                Offline.options.checks.active = 'up';
                Offline.check();
            }
        };

        eventSource.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);
                if (data.callerIdHtml) {
                    renderCallerIds(data.callerIdHtml);
                }
                if (data.online && typeof window.updateOnlineCounts === 'function') {
                    window.updateOnlineCounts(data.online);
                }
            } catch (e) {
                console.error("[CallerID-SSE] Parse error:", e);
            }
        };

        eventSource.onerror = function () {
            eventSource.close();
            eventSource = null;
            var grid = getGrid();
            if (grid) grid.innerHTML = '';

            if (typeof Offline !== 'undefined' && Offline.state !== 'down') {
                Offline.options.checks.active = 'down';
                Offline.check();
            }

            reconnectTimeout = setTimeout(connect, 5000);
        };
    }

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    window.callerIdSSE = {
        reconnect: connect,
        disconnect: function () {
            if (eventSource) { eventSource.close(); eventSource = null; }
            if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
            var grid = getGrid();
            if (grid) grid.innerHTML = '';
        },
    };
})();
