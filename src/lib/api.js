let _authFetch = null;

export function registerAuthFetch(fn) {
    _authFetch = fn;
}

export function apiFetch(url, options = {}) {
    if (_authFetch) return _authFetch(url, options);
    return fetch(url, options);
}
