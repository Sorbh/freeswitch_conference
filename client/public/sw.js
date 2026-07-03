/* Hotline HQ service worker — push notifications only.
   No fetch handler on purpose: HTML is served no-store, hashed assets are
   browser-cached, and the SIP client must always hit the network. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Hotline HQ', {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.icon || '/icons/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/client/dashboard' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/client/dashboard';
  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin);
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = wins.find(w => new URL(w.url).origin === target.origin);
    if (existing) {
      await existing.focus();
      // Only force-navigate for broadcast share links; a focused dashboard
      // already shows an incoming call, and navigating would kill the live SIP session.
      if (target.pathname.startsWith('/b/') && !new URL(existing.url).pathname.startsWith(target.pathname) && 'navigate' in existing) {
        try { await existing.navigate(target.href); } catch {}
      }
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
