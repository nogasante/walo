/* Tiny client log for real-phone problems: event names, counts, sizes and types only. Never photo data, words or places.
   Sent with sendBeacon to CFG().log.endpoint (api/log.js prints one line to the server log). */
import { CFG } from "./data.js";

let sid = "";
try { sid = sessionStorage.getItem("walo.sid") || Math.random().toString(36).slice(2, 8); sessionStorage.setItem("walo.sid", sid); } catch { sid = Math.random().toString(36).slice(2, 8); }
const ua = navigator.userAgent || "";
const DEV = {
  os: /Android/.test(ua) ? "android" : /iPhone|iPad|iPod/.test(ua) ? "ios" : "other",
  br: /SamsungBrowser/.test(ua) ? "samsung" : /OPR|Opera/.test(ua) ? "opera" : /Firefox|FxiOS/.test(ua) ? "firefox" : /CriOS|Chrome/.test(ua) ? "chrome" : /Safari/.test(ua) ? "safari" : "other",
  ver: ((ua.match(/(?:SamsungBrowser|OPR|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/) || [])[1]) || "",
  mem: navigator.deviceMemory || null,
};
const queue = [];
function endpoint() { try { const c = CFG(); if (!c) return undefined; return c.log && c.log.enabled ? c.log.endpoint : null; } catch { return undefined; } }
function flush() {
  const ep = endpoint();
  if (ep === undefined) { setTimeout(flush, 1500); return; } // config not loaded yet
  while (queue.length) {
    const body = JSON.stringify(queue.shift());
    if (!ep) continue;
    try { if (!(navigator.sendBeacon && navigator.sendBeacon(ep, body))) fetch(ep, { method: "POST", body, keepalive: true }).catch(() => {}); } catch { /* never break the app for a log */ }
  }
}
export function log(ev, d = {}) {
  queue.push({ ev, ...d, ...DEV, sid, route: (location.hash.split("/")[1] || "home").slice(0, 12), t: Date.now() });
  flush();
}
window.addEventListener("error", (e) => log("js_error", { msg: String(e.message || "").slice(0, 120) }));
window.addEventListener("unhandledrejection", (e) => log("js_reject", { msg: String((e.reason && e.reason.message) || e.reason || "").slice(0, 120) }));
