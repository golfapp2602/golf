// Offline-first: the app opens from the phone's cache at once and refreshes itself in the background.
const VERSION = "golf-v14";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-180.png"];

self.addEventListener("install", e => {
  // only the small app shell blocks installation
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = [VERSION, "tiles", "runtime"];
    await Promise.all((await caches.keys()).filter(k => !keep.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const refresh = (req, key, cacheName) => fetch(req).then(r => {
  if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(cacheName).then(c => c.put(key, copy)); }
  return r;
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.includes("overpass-api") || url.hostname.includes("nominatim")) return;
  if (req.mode === "navigate") {
    // cached page first, newer version saved for next time
    e.respondWith(caches.match("index.html").then(hit => {
      const net = refresh(req, "index.html", VERSION);
      return hit || net.catch(() => caches.match("./"));
    }));
    return;
  }
  const cacheName = url.hostname.includes("arcgisonline") ? "tiles" : url.origin === location.origin ? VERSION : "runtime";
  e.respondWith(caches.match(req).then(hit => {
    if (hit) { if (cacheName === "runtime" && url.hostname.includes("googleapis")) refresh(req, req, cacheName).catch(() => {}); return hit; }
    return refresh(req, req, cacheName);
  }));
});
