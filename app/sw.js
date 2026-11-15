/* Walo offline cache: exactly the files the app ships (crop photos and lib/supabase.js, used only for the optional backup, are cached the first time they load).
   Code and data network-first (cache when offline); photos and fonts cache-first. /api/ calls (AI, forecast) and other sites are never cached.

   Install is deliberately all-or-nothing-free: each file is cached on its own, so one renamed or
   missing file can no longer fail the whole install and leave a farmer with no offline copy at all.
   Any file that fails is reported to /api/log (app/api/log.js) as "sw_missing" so it shows up in the
   server log instead of failing silently. Bump CACHE whenever FILES or a shipped asset changes. */
const CACHE = "walo-v74";
const FILES = ["./", "index.html", "styles.css", "icon.svg", "manifest.json", "fonts/jakarta-var.woff2", "lib/agro.js",
  "img/flags/gh.png", "img/flags/ke.png", "img/flags/ng.png", "img/flags/tg.png", "img/flags/ci.png", "img/flags/sn.png", "img/flags/ml.png", "img/flags/ne.png", "img/logo-mark.png", "img/logo-mark-192.png", "img/logo-mark-512-maskable.png", "img/favicon-32.png", "img/apple-touch-icon.png",
  "js/main.js", "js/data.js", "js/store.js", "js/ui.js", "js/util.js", "js/icons.js",
  "js/screens/home.js", "js/screens/now.js", "js/screens/crop.js", "js/tips.js", "js/calendar.js", "js/screens/farm.js", "js/screens/start.js", "js/screens/sell.js", "js/screens/doctor.js", "js/screens/about.js", "js/screens/pickers.js", "js/screens/words.js", "js/screens/welcome.js", "js/screens/backup.js", "js/sync.js", "js/photo.js", "js/log.js", "js/twi.js", "js/net.js", "js/screens/help.js",
  "data/app.json", "data/rules.json", "data/countries.json", "data/crops.json", "data/places.json", "data/agro.json", "data/ndvi.json", "data/market.json", "data/prices.json", "data/prices-ke.json", "data/prices-ng.json", "data/prices-tg.json", "data/prices-ci.json", "data/prices-sn.json", "data/prices-ml.json", "data/prices-ne.json", "data/exchange.json", "data/credits.json", "data/ghana-map.json", "data/kenya-map.json", "data/help.json",
  "img/maize.webp", "img/maize-field.webp", "img/hero.webp", "img/field.webp", "img/grain.webp", "img/market.webp"];

function reportMissing(failed) {
  // the same log the app already uses for real-phone problems: an event name, nothing personal
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ev: "sw_missing", owner: "offline", msg: failed.join(",").slice(0, 120) }),
    }).catch(() => {});
  } catch { /* never break install for a report */ }
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache: "reload" so a precache never picks up an older HTTP-cached copy of a file
    const results = await Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: "reload" }))));
    const failed = FILES.filter((_, i) => results[i].status === "rejected");
    if (failed.length) reportMissing(failed);
  })());
  self.skipWaiting();
});

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
