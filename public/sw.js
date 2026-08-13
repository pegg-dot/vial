// VialGrade service worker — offline app-shell + web push delivery.
const CACHE = "vial-shell-v2";
const PRECACHE = ["/offline", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for navigations; fall back to a cached copy, then the offline page.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))),
  );
});

// Reviewed-change push. Payload is JSON: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = { title: "VialGrade", body: "A reviewed change occurred." };
  try { if (event.data) data = event.data.json(); } catch { /* keep default */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "VialGrade", {
      body: data.body || "",
      tag: data.tag,
      data: { url: data.url || "/" },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
