// Minimaler Service Worker: sorgt nur dafür, dass Klicks auf eine
// Benachrichtigung die App öffnen bzw. fokussieren und zum richtigen Lead
// springen. Kein Offline-Caching - die App braucht ohnehin eine Verbindung
// zu Supabase, ein Cache würde hier nur falsche Sicherheit vorgaukeln.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const leadId = event.notification.data?.leadId;
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = allClients[0];
      if (client) {
        client.focus();
        client.postMessage({ type: "open-lead", leadId });
      } else if (self.registration.scope) {
        const hash = leadId ? `#/lead/${leadId}` : "#/liste";
        self.clients.openWindow(self.registration.scope + hash);
      }
    })()
  );
});
