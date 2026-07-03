import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const SUPPORTED = typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function usePushNotifications() {
  const { apiFetch } = useAuth();
  const [permission, setPermission] = useState(SUPPORTED ? Notification.permission : 'denied');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);

  // iOS only allows web push from a Home Screen-installed app (16.4+)
  const needsInstallHint = isIos && !isStandalone;
  const supported = SUPPORTED && !needsInstallHint;

  useEffect(() => {
    if (!SUPPORTED) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSubscribed(!!sub);
        // Keep the endpoint→account binding fresh (e.g. after re-login on a shared browser)
        if (sub && Notification.permission === 'granted') {
          apiFetch('/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) }).catch(() => {});
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [apiFetch]);

  const loadPrefs = useCallback(async () => {
    try {
      const json = await apiFetch('/push/prefs');
      setPrefs(json.data);
      return json.data;
    } catch { return null; }
  }, [apiFetch]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const enable = useCallback(async () => {
    if (!SUPPORTED) throw new Error('Notifications are not supported in this browser');
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission was not granted');
      const { key } = await apiFetch('/push/public-key');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await apiFetch('/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
      setSubscribed(true);
      await loadPrefs();
    } finally {
      setBusy(false);
    }
  }, [apiFetch, loadPrefs]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      await loadPrefs();
    } finally {
      setBusy(false);
    }
  }, [apiFetch, loadPrefs]);

  const updatePrefs = useCallback(async (patch) => {
    setPrefs(p => ({ ...p, ...patch }));
    try {
      await apiFetch('/push/prefs', { method: 'PUT', body: JSON.stringify(patch) });
    } catch {
      await loadPrefs(); // revert optimistic update
    }
  }, [apiFetch, loadPrefs]);

  const sendTest = useCallback(async () => {
    const json = await apiFetch('/push/test', { method: 'POST' });
    return json.sent;
  }, [apiFetch]);

  return { supported, needsInstallHint, permission, subscribed, busy, prefs, enable, disable, updatePrefs, sendTest };
}
