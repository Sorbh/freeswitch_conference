/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// Redline Push — shared web-push helper
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT IT DOES:
//   1. Registers the service worker (default /sw.js on the PAGE's origin)
//   2. Subscribes the browser to web push (VAPID) and registers the
//      subscription with the Hotline API (POST /api/v1/client/push/subscribe)
//   3. If permission was already granted: re-syncs silently on every load
//   4. If permission was never asked: shows a small "Enable notifications"
//      chip (dismissable, snoozes for 7 days)
//
// LOADED AUTOMATICALLY by redline_sip_client.js and redline_callerid.js
// after login. Can also be used standalone:
//
//   <script src="https://hotlinehq.online/hotlinehq_push_notification.js"></script>
//   <script>
//     RedlinePush.init({
//       apiBase: 'https://hotlinehq.online/fs',
//       getToken: function () { return myClientJwt; },
//     });
//   </script>
//
// IMPORTANT — SERVICE WORKER ORIGIN:
//   Browsers only allow registering a service worker served from the SAME
//   origin as the page. hotlinehq.online already serves
//   /sw.js. Any OTHER site loading this module must host a copy of sw.js
//   at its own web root (or pass swPath in init()). If the worker file is
//   missing this module logs a warning and does nothing.
//
// OPTIONAL CONFIG (via init opts or window.HOTLINE_CONFIG):
//   pushPrompt: false   — never show the "Enable notifications" chip
//   swPath: '/sw.js'    — path of the service worker on the page's origin
//
// MANUAL CONTROL:
//   RedlinePush.enable()      — request permission + subscribe (needs user gesture)
//   RedlinePush.disable()     — unsubscribe this browser
//   RedlinePush.isSupported() — true if the browser can do web push
//   RedlinePush.isEnabled()   — promise<bool>, true if subscribed
//
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    if (window.RedlinePush) return;

    var DISMISS_KEY = 'redline_push_dismissed_at';
    var DISMISS_DAYS = 7;

    var state = {
        apiBase: '',
        getToken: function () { return ''; },
        swPath: '/sw.js',
        prompt: true,
        registration: null,
        initialized: false,
    };

    function isSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    function isIosNotInstalled() {
        var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
        return ios && !standalone;
    }

    function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var raw = window.atob(base64);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
    }

    function authHeaders() {
        var token = state.getToken && state.getToken();
        return token ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } : null;
    }

    function registerWorker() {
        if (state.registration) return Promise.resolve(state.registration);
        return navigator.serviceWorker.register(state.swPath)
            .then(function (reg) {
                state.registration = reg;
                return reg;
            })
            .catch(function (err) {
                console.warn('[Push] Service worker registration failed (' + state.swPath + '): ' + err.message +
                    ' — this page\'s origin must host the worker file.');
                throw err;
            });
    }

    function fetchPublicKey() {
        return fetch(state.apiBase + '/api/v1/client/push/public-key')
            .then(function (res) { return res.json(); })
            .then(function (json) {
                if (!json.status || !json.key) throw new Error(json.error || 'Push not configured');
                return json.key;
            });
    }

    function registerSubscription(sub) {
        var headers = authHeaders();
        if (!headers) return Promise.reject(new Error('Not logged in'));
        return fetch(state.apiBase + '/api/v1/client/push/subscribe', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(sub.toJSON()),
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
        });
    }

    function subscribe() {
        return registerWorker()
            .then(function (reg) {
                return reg.pushManager.getSubscription().then(function (existing) {
                    if (existing) return existing;
                    return fetchPublicKey().then(function (key) {
                        return reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(key),
                        });
                    });
                });
            })
            .then(function (sub) {
                return registerSubscription(sub).then(function () {
                    console.log('[Push] Subscribed and registered with server');
                    return true;
                });
            });
    }

    function enable() {
        if (!isSupported()) return Promise.reject(new Error('Push not supported in this browser'));
        if (isIosNotInstalled()) return Promise.reject(new Error('On iPhone/iPad, add this app to your Home Screen first'));
        return Promise.resolve(Notification.requestPermission()).then(function (perm) {
            if (perm !== 'granted') throw new Error('Notification permission not granted');
            return subscribe();
        });
    }

    function disable() {
        if (!isSupported()) return Promise.resolve(false);
        return registerWorker().then(function (reg) {
            return reg.pushManager.getSubscription().then(function (sub) {
                if (!sub) return false;
                var headers = authHeaders();
                if (headers) {
                    fetch(state.apiBase + '/api/v1/client/push/unsubscribe', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ endpoint: sub.endpoint }),
                    }).catch(function () { });
                }
                return sub.unsubscribe();
            });
        });
    }

    function isEnabled() {
        if (!isSupported() || Notification.permission !== 'granted') return Promise.resolve(false);
        return navigator.serviceWorker.getRegistration(state.swPath)
            .then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; })
            .then(function (sub) { return !!sub; })
            .catch(function () { return false; });
    }

    // ── Prompt chip ──

    function promptDismissed() {
        try {
            var at = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
            return at && (Date.now() - at) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
        } catch (e) { return false; }
    }

    function dismissPrompt() {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { }
        hidePromptChip();
    }

    function hidePromptChip() {
        var el = document.getElementById('redline_push_chip');
        if (el) el.remove();
    }

    function showPromptChip() {
        if (document.getElementById('redline_push_chip')) return;
        var el = document.createElement('div');
        el.id = 'redline_push_chip';
        el.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:2147483646;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#d92d20,#b42318);color:#fff;border-radius:999px;padding:10px 14px 10px 16px;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;box-shadow:0 14px 34px rgba(217,45,32,.38);cursor:pointer;';
        el.innerHTML =
            '<span style="font-size:16px;line-height:1;">🔔</span>' +
            '<span id="redline_push_chip_label">Get notified about parts requests</span>' +
            '<button id="redline_push_chip_close" style="border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:999px;width:22px;height:22px;font-size:13px;font-weight:800;cursor:pointer;line-height:1;flex:0 0 auto;">×</button>';
        document.body.appendChild(el);

        el.onclick = function () {
            var label = document.getElementById('redline_push_chip_label');
            if (label) label.textContent = 'Enabling...';
            enable()
                .then(function () {
                    if (label) label.textContent = 'Notifications enabled ✓';
                    setTimeout(hidePromptChip, 2500);
                })
                .catch(function (err) {
                    console.warn('[Push] Enable failed:', err.message);
                    if (label) label.textContent = err.message;
                    setTimeout(hidePromptChip, 3500);
                });
        };
        var close = document.getElementById('redline_push_chip_close');
        if (close) close.onclick = function (event) {
            event.stopPropagation();
            dismissPrompt();
        };
    }

    // ── Init ──

    function init(opts) {
        opts = opts || {};
        if (opts.apiBase !== undefined) state.apiBase = String(opts.apiBase || '').replace(/\/$/, '');
        if (opts.getToken) state.getToken = opts.getToken;
        if (opts.swPath) state.swPath = opts.swPath;
        if (opts.prompt !== undefined) state.prompt = !!opts.prompt;

        if (state.initialized) return;
        state.initialized = true;

        if (!isSupported()) {
            console.log('[Push] Web push not supported in this browser');
            return;
        }
        if (isIosNotInstalled()) {
            console.log('[Push] iOS requires Add to Home Screen for push — skipping');
            return;
        }

        if (Notification.permission === 'granted') {
            // Already allowed — silently (re)subscribe so the server binding stays fresh
            subscribe().catch(function (err) {
                console.warn('[Push] Silent re-subscribe failed:', err.message);
            });
        } else if (Notification.permission === 'default' && state.prompt && !promptDismissed()) {
            showPromptChip();
        }
    }

    window.RedlinePush = {
        init: init,
        enable: enable,
        disable: disable,
        isSupported: isSupported,
        isEnabled: isEnabled,
    };
})();
