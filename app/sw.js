/* Walo offline cache: exactly the files the app ships (crop photos and lib/supabase.js, used only for the optional backup, are cached the first time they load).
   Code and data network-first (cache when offline); photos and fonts cache-first. /api/ calls (AI, forecast, Twi) and other sites are never cached here (Twi voice clips are kept by js/twi.js in their own cache). */
const CACHE = "walo-v21";
const FILES = ["./", "index.html", "styles.css", "icon.svg", "manifest.json", "fonts/jakarta-var.woff2", "lib/agro.js",
  "js/main.js", "js/data.js", "js/store.js", "js/ui.js", "js/util.js", "js/icons.js",
  "js/screens/home.js", "js/screens/now.js", "js/screens/crop.js", "js/screens/farm.js", "js/screens/start.js", "js/screens/sell.js", "js/screens/doctor.js", "js/screens/about.js", "js/screens/pickers.js", "js/screens/words.js", "js/screens/backup.js", "js/sync.js", "js/photo.js", "js/log.js", "js/twi.js", "js/net.js", "js/screens/help.js",
  "data/app.json", "data/rules.json", "data/crops.json", "data/places.json", "data/agro.json", "data/ndvi.json", "data/market.json", "data/credits.json", "data/ghana-map.json", "data/i18n-tw.json", "data/help.json",
  "img/maize.webp", "img/maize-field.webp", "img/hero.webp", "img/field.webp", "img/grain.webp", "img/market.webp"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("walo-v")).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  const save = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; };
  // code and data: network first, so a new version shows on the next load; the cache is only for offline
  if (e.request.mode === "navigate" || /\.(js|css|json|html)$/.test(u.pathname) || u.pathname === "/") {
    e.respondWith(fetch(e.request).then(save).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))));
    return;
  }
  // photos and fonts: cache first
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then(save)));
});
