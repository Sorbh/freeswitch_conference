import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api/v1/client';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('hq_token'));
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hq_account')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const apiFetch = useCallback(async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && json.code === 'TOKEN_EXPIRED') {
      setToken(null);
      setAccount(null);
      localStorage.removeItem('hq_token');
      localStorage.removeItem('hq_account');
    }
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
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
      try { sessionStorage.setItem('hq_sip_pwd', password); } catch {};
      // Also set user_data + room for redline_sip_client.js compatibility
      localStorage.setItem('user_data', JSON.stringify({
        id: json.data.id,
        email: json.data.email,
        is_sip: 0,
        user_type: 2,
        name: json.data.display_name,
        parent_id: null,
        parent_city: '',
        user_detail: {
          company_name: json.data.company_name,
          representative_name: json.data.display_name,
          company_phone: json.data.company_phone || '',
          city: json.data.city || '',
          email: json.data.email,
        },
      }));
      localStorage.setItem('room', String(json.data.current_room || json.data.room || ''));
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
    if (window.hotlineClient?.logout) window.hotlineClient.logout();
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const json = await apiFetch('/account');
      setAccount(json.data);
      localStorage.setItem('hq_account', JSON.stringify(json.data));
      return json.data;
    } catch { return null; }
  }, [apiFetch]);

  useEffect(() => {
    if (token && !account) refreshAccount();
  }, [token, account, refreshAccount]);

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
