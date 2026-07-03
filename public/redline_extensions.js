/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// Redline Extension Directory — shared floating widget
// ═══════════════════════════════════════════════════════════════════════════
//
// The draggable red FAB + searchable extension directory + "request your
// extension" flow. Single source of truth for redline_sip_client.js and
// redline_callerid.js, which lazy-load this file and then call:
//
//   window.RedlineExtensionDirectory.configure({
//     apiBase: '...',                    // API server base URL
//     getToken: function () {...},      // returns client JWT
//     getOwnExtension: function () {...},
//     getUserEmail: function () {...},
//     callExtension: function (item, dialCode) {...},  // host-specific call action
//     visible: false,                   // toggled later via setVisible()
//   });
//
// Public API: configure(opts), open(), setMessage(msg), setVisible(bool), refresh()
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
    }

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
        // Default: start a direct call via the API and show the call banner
        var token = state.getToken && state.getToken();
        if (!token) return setMessage('Login required before calling ' + dialCode + '.');
        fetch(state.apiBase + '/api/v1/client/direct-call/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
                setMessage(err.message);
                renderDirectCallStatus('Unable to call extension', err.message, false, 3000, 'warn');
            });
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

    // ── Direct-call UI (banner + SSE event handling) ──
    // Hosts forward direct_call_* SSE events via window.RedlineDirectCall.handleEvent(data).
    // Uses the same configured state (apiBase, getToken) as the extension directory.

    var directCallHideTimer = null;
    var directCallTimer = null;
    var directCallState = null;

    function notifyDirectCallState(callState, data) {
        try {
            if (typeof window.onHotlineDirectCallState === 'function') window.onHotlineDirectCallState(callState, data || null);
        } catch (e) { }
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
            var token = state.getToken && state.getToken();
            if (!token) return;
            fetch(state.apiBase + '/api/v1/client/direct-call/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            }).catch(function (err) { console.error('[DirectCall] Decline failed:', err.message); });
            renderDirectCallStatus('Rejecting private call...', '', false, 2500);
        } catch (err) {
            console.error('[DirectCall] reject error:', err.message);
        }
    }

    function answerDirectCall() {
        try {
            var token = state.getToken && state.getToken();
            if (!token) return;
            fetch(state.apiBase + '/api/v1/client/direct-call/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            }).catch(function (err) { console.error('[DirectCall] Accept failed:', err.message); });
            renderDirectCallStatus('Answering private call...', '', false, 2500, 'success');
        } catch (err) {
            console.error('[DirectCall] answer error:', err.message);
        }
    }

    function endDirectCall(options) {
        try {
            options = options || {};
            var token = state.getToken && state.getToken();
            if (!token || !directCallState) return;
            var url = state.apiBase + '/api/v1/client/direct-call/end';
            var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
            if (options.keepalive && navigator.sendBeacon) {
                var blob = new Blob([JSON.stringify({})], { type: 'application/json' });
                navigator.sendBeacon(url + '?token=' + encodeURIComponent(token), blob);
            } else {
                fetch(url, { method: 'POST', headers: headers, keepalive: !!options.keepalive })
                    .catch(function (err) { console.error('[DirectCall] End failed:', err.message); });
            }
            if (!options.silent) {
                notifyDirectCallState('ending', { source: 'web' });
                clearDirectCallState();
                renderDirectCallStatus('Ending private call...', '', false, 2500, 'warn');
            }
        } catch (err) {
            console.error('[DirectCall] end error:', err.message);
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
            var showAnswer = (window.HOTLINE_CONFIG || {}).directCallAnswerButton === true;
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

    window.RedlineDirectCall = {
        configure: function (opts) {
            opts = opts || {};
            if (opts.apiBase) state.apiBase = opts.apiBase.replace(/\/$/, '');
            if (opts.getToken) state.getToken = opts.getToken;
        },
        handleEvent: handleDirectCallEvent,
        renderStatus: renderDirectCallStatus,
        end: endDirectCall,
        isActive: function () { return !!directCallState; },
    };
})();
