/* Service worker · Mi Turno · offline básico (cache-first) */
const CACHE = "mi-turno-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/app.js",
  "./js/gym.js",
  "./js/reorder.js",
  "./js/sync.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Notificaciones push */
self.addEventListener("push", e => {
  let d = { title: "Mi Turno", body: "" };
  try { d = e.data.json(); } catch (_) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title || "Mi Turno", {
    body: d.body || "", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
    tag: d.tag || "mi-turno", data: { url: d.url || "./index.html" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cl => {
    for (const c of cl) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
