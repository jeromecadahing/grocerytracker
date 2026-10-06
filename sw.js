// Keeps the app opening with no signal in the store. Firebase handles its own offline data.
const CACHE = "grocery-tally-v3";
const FILES = ["./", "./index.html", "./config.js", "./sync.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
const CACHEABLE = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin && !CACHEABLE.includes(url.hostname)) return; // leave Firebase traffic alone
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
