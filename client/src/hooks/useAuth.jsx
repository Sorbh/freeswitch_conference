import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api/v1/client';
const PROFILE_PROMPT_LOGIN_KEY = 'hq_profile_prompt_login';
const PROFILE_PROMPT_HANDLED_KEY = 'hq_profile_prompt_handled_login';

function getProfilePromptLoginId(account) {
  return `${account?.id || account?.email || 'account'}:${Date.now()}`;
}

function clearProfilePromptSession() {
  try {
    sessionStorage.removeItem(PROFILE_PROMPT_LOGIN_KEY);
    sessionStorage.removeItem(PROFILE_PROMPT_HANDLED_KEY);
  } catch {}
}

// Set user_data + room for redline_sip_client.js compatibility
function syncSipClientStorage(data) {
  localStorage.setItem('user_data', JSON.stringify({
    id: data.id,
    email: data.email,
    is_sip: 0,
    user_type: 2,
    name: data.display_name,
    parent_id: null,
    parent_city: '',
    user_detail: {
      company_name: data.company_name,
      representative_name: data.display_name,
      company_phone: data.company_phone || '',
      city: data.city || '',
      email: data.email,
    },
  }));
  localStorage.setItem('room', String(data.current_room || data.room || ''));
}

// One-time login token handed off by GET /api/v1/client/verify via URL fragment
// (/client/dashboard#vt=<jwt>). Stored exactly like the token login stores, then
// stripped from the URL. hq_account is cleared so it is re-fetched fresh.
function consumeVerifyLoginToken() {
  try {
    const match = window.location.hash.match(/[#&]vt=([^&]+)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    localStorage.setItem('hq_token', token);
    localStorage.removeItem('hq_account');
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return token;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => consumeVerifyLoginToken() || localStorage.getItem('hq_token'));
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hq_account')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const apiFetch = useCallback(async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    const refreshed = res.headers.get('x-refreshed-token');
    if (refreshed) {
      localStorage.setItem('hq_token', refreshed);
      setToken(refreshed);
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && (json.code === 'TOKEN_EXPIRED' || json.code === 'ACCOUNT_NOT_FOUND')) {
      setToken(null);
      setAccount(null);
      localStorage.removeItem('hq_token');
      localStorage.removeItem('hq_account');
      clearProfilePromptSession();
      window.location.replace('/client/login?session=expired');
      return new Promise(() => {});
    }
    if (!res.ok) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.code = json.code;
      throw err;
    }
    return json;
  }, [token]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const json = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(json.token);
      setAccount(json.data);
      localStorage.setItem('hq_token', json.token);
      localStorage.setItem('hq_account', JSON.stringify(json.data));
      try {
        sessionStorage.setItem('hq_sip_pwd', password);
        sessionStorage.setItem(PROFILE_PROMPT_LOGIN_KEY, getProfilePromptLoginId(json.data));
        sessionStorage.removeItem(PROFILE_PROMPT_HANDLED_KEY);
      } catch {};
      syncSipClientStorage(json.data);
      return json;
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const logout = useCallback(() => {
    setToken(null);
    setAccount(null);
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_account');
    localStorage.removeItem('user_data');
    localStorage.removeItem('room');
    try { sessionStorage.removeItem('hq_sip_pwd'); } catch {};
    clearProfilePromptSession();
    if (window.hotlineClient?.logout) window.hotlineClient.logout();
    try { if (window.Supportgram) window.Supportgram.reset(); } catch { /* widget not loaded */ }
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const json = await apiFetch('/account');
      setAccount(json.data);
      localStorage.setItem('hq_account', JSON.stringify(json.data));
      syncSipClientStorage(json.data);
      return json.data;
    } catch { return null; }
  }, [apiFetch]);

  // Always re-sync on boot: the cached hq_account renders instantly, but
  // server-derived fields (web_takeover, connection_state, current_room)
  // change outside this tab and must not stay frozen at login-time values.
  useEffect(() => {
    if (token) refreshAccount();
  }, [token, refreshAccount]);

  return (
    <AuthContext.Provider value={{ token, account, loading, login, logout, apiFetch, refreshAccount, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
