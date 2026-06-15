import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { registerAuthFetch } from "@/lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = 'accessToken';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const tokenRef = useRef(null);
    const refreshTimerRef = useRef(null);

    const scheduleRefresh = useCallback((expiresInMs) => {
        clearTimeout(refreshTimerRef.current);
        const refreshAt = Math.max(expiresInMs - 60_000, 5_000);
        refreshTimerRef.current = setTimeout(() => refresh(), refreshAt);
    }, []);

    const setToken = useCallback((token) => {
        tokenRef.current = token;
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const expiresInMs = (payload.exp * 1000) - Date.now();
                scheduleRefresh(expiresInMs);
            } catch {}
        }
    }, [scheduleRefresh]);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/auth/refresh', {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Refresh failed');
            const data = await res.json();
            setToken(data.accessToken);
            setUser(data.user);
            return data.accessToken;
        } catch {
            tokenRef.current = null;
            setUser(null);
            clearTimeout(refreshTimerRef.current);
            return null;
        }
    }, [setToken]);

    const login = useCallback(async (email, password, remember = false) => {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, remember }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setToken(data.accessToken);
        setUser(data.user);
        return data.user;
    }, [setToken]);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenRef.current}` },
                credentials: 'include',
            });
        } catch {}
        tokenRef.current = null;
        setUser(null);
        clearTimeout(refreshTimerRef.current);
    }, []);

    const getToken = useCallback(async () => {
        if (tokenRef.current) {
            try {
                const payload = JSON.parse(atob(tokenRef.current.split('.')[1]));
                if (payload.exp * 1000 > Date.now() + 30_000) {
                    return tokenRef.current;
                }
            } catch {}
        }
        return await refresh();
    }, [refresh]);

    const authFetch = useCallback(async (url, options = {}) => {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
        });

        if (res.status === 401) {
            const retryToken = await refresh();
            if (!retryToken) throw new Error('Session expired');
            return fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${retryToken}`,
                },
                credentials: 'include',
            });
        }

        return res;
    }, [getToken, refresh]);

    useEffect(() => {
        registerAuthFetch(authFetch);
    }, [authFetch]);

    useEffect(() => {
        refresh().finally(() => setLoading(false));
        return () => clearTimeout(refreshTimerRef.current);
    }, [refresh]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, getToken, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
