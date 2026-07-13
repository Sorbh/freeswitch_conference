// ═══════════════════════════════════════════════════════════════════════════
// Hotline HQ — Broadcast Feed (SSE + REST)
// ═══════════════════════════════════════════════════════════════════════════
//
// Standalone broadcast feed module. Can be used independently or via
// window.hotlineClient (which delegates to this module).
//
// USAGE (standalone):
//   <script src="/hotlinehq_broadcast_feed.js"></script>
//
//   window.HotlineBroadcastFeed.configure({
//     apiBase: 'https://hotlinehq.online/fs',
//     getToken: function() { return myJwtToken; },
//   });
//   window.HotlineBroadcastFeed.start(roomId, { answered: 0 });
//   window.HotlineBroadcastFeed.stop();
//   window.HotlineBroadcastFeed.getBroadcasts(roomId, { page: 1, pageSize: 25 });
//
// CALLBACKS:
//   window.onHotlineBroadcastConnected = function(data) { ... }
//   window.onHotlineBroadcast = function(data) { ... }
//
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    var _apiBase = '';
    var _getToken = function () { return null; };
    var _stopped = false;

    var broadcastSource = null;
    var reconnectAttempts = 0;
    var feedRoom = null;
    var feedAnswered = undefined;
    var feedHasParts = undefined;

    function configure(opts) {
        if (opts.apiBase) _apiBase = opts.apiBase;
        if (opts.getToken) _getToken = opts.getToken;
    }

    function start(room, options) {
        stop();
        _stopped = false;
        reconnectAttempts = 0;
        options = options || {};
        feedRoom = room || undefined;
        feedAnswered = options.answered;
        feedHasParts = options.hasParts;
        console.log('[BroadcastFeed] start room=' + feedRoom + ' hasParts=' + feedHasParts + ' answered=' + feedAnswered);
        connectSSE();
    }

    function connectSSE() {
        var token = _getToken();
        if (!token) return;
        var url = _apiBase + '/api/v1/client/events/broadcasts';
        if (feedRoom) url += '/' + feedRoom;
        url += '?token=' + token;
        if (feedAnswered !== undefined) url += '&answered=' + feedAnswered;
        if (feedHasParts !== undefined) url += '&hasParts=' + feedHasParts;

        try {
            broadcastSource = new EventSource(url);

            broadcastSource.onopen = function () {
                reconnectAttempts = 0;
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
                if (_stopped) return;
                reconnectAttempts++;
                var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                setTimeout(function () { if (!_stopped) connectSSE(); }, delay);
            };
        } catch (e) {
            reconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            setTimeout(function () { if (!_stopped) connectSSE(); }, delay);
        }
    }

    function stop() {
        _stopped = true;
        try {
            if (broadcastSource) { broadcastSource.close(); broadcastSource = null; }
        } catch (e) { }
    }

    function getBroadcasts(room, options) {
        var token = _getToken();
        if (!token) return Promise.reject(new Error('Not logged in'));
        options = options || {};
        var url = _apiBase + '/api/v1/client/broadcasts/list';
        if (room) url += '/' + room;
        var params = [];
        if (options.page) params.push('page=' + options.page);
        if (options.pageSize) params.push('pageSize=' + options.pageSize);
        if (options.answered !== undefined) params.push('answered=' + options.answered);
        if (options.dateFrom) params.push('dateFrom=' + options.dateFrom);
        if (options.hasParts !== undefined) params.push('hasParts=' + options.hasParts);
        if (options.dateTo) params.push('dateTo=' + options.dateTo);
        if (params.length) url += '?' + params.join('&');

        return fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token },
        })
        .then(function (res) { return res.json().then(function (json) { if (!res.ok || !json.status) throw new Error(json.error || 'HTTP ' + res.status); return json; }); });
    }

    window.HotlineBroadcastFeed = {
        configure: configure,
        start: start,
        stop: stop,
        getBroadcasts: getBroadcasts,
    };
})();
