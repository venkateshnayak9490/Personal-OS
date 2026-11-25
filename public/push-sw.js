// Loaded into the generated service worker (workbox importScripts in vite.config.ts).
// Shows reminders sent by the send-due function, and opens the right page when one is clicked.

self.addEventListener('push', (event) => {
  let msg;
  try {
    msg = event.data ? event.data.json() : null;
  } catch {
    msg = null;
  }
  if (!msg || !msg.title) return;
  event.waitUntil(
    (async () => {
      // The app is on screen: its own reminder card shows this already, so no second, system one.
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;
      await self.registration.showNotification(msg.title, {
        body: msg.body || '',
        // Same reminder again (another device, a retry) replaces instead of stacking.
        tag: msg.tag || msg.title,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: msg.url || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        await win.focus();
        // navigate() only works on pages this worker controls; otherwise open a fresh window.
        if (win.url !== url) await win.navigate(url).catch(() => self.clients.openWindow(url));
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
