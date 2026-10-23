// Network first for the page (3 s limit), so a new version shows up straight away; the cached copy covers no coverage.
const VERSION = "golf-v18";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-180.png"];

self.addEventListener("install", e => {
  // only the small app shell blocks installation
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
    // fresh page when online (cache copy if the network is slow or absent); the copy is kept for next time
    const net = refresh(new Request(req.url, { cache: "no-cache" }), "index.html", VERSION);
    const slow = new Promise(ok => setTimeout(ok, 3000));
    e.respondWith(Promise.race([net, slow.then(() => caches.match("index.html"))])
      .then(r => r || net)
      .catch(() => caches.match("index.html")));
    return;
  }
  const cacheName = url.hostname.includes("arcgisonline") ? "tiles" : url.origin === location.origin ? VERSION : "runtime";
  e.respondWith(caches.match(req).then(hit => {
    if (hit) { if (cacheName === "runtime" && url.hostname.includes("googleapis")) refresh(req, req, cacheName).catch(() => {}); return hit; }
    return refresh(req, req, cacheName);
  }));
});
