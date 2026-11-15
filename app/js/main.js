/* Walo app shell: one router (location.hash), top bar with the place chip, picture tabs, re-render on state change. */
import { online } from "./net.js";
import { load, setForecastListener, CFG, setActiveCountry, loadCountryData, crop, isTree } from "./data.js";
import { place, placeLabel, focusCrop, subscribe, hydrate, farmsHere, placeChosen, countryId } from "./store.js";
import { icon, wire, resetSheets, closeSheet, stopSpeaking, openSheet, toast, note } from "./ui.js";
import { esc } from "./util.js";
import * as home from "./screens/home.js";
import * as now from "./screens/now.js";
import * as cropScreen from "./screens/crop.js";
import * as farm from "./screens/farm.js";
import * as start from "./screens/start.js";
import * as sell from "./screens/sell.js";
import * as doctor from "./screens/doctor.js";
import * as about from "./screens/about.js";
import * as backup from "./screens/backup.js";
import * as help from "./screens/help.js";
import * as nextScreen from "./screens/next.js";
import * as shift from "./screens/shift.js";
import * as welcome from "./screens/welcome.js";
import { startSync } from "./sync.js";
import { isTwi, twiOn, setLang, apply as applyLang } from "./twi.js";
import { openPlacePicker } from "./screens/pickers.js";

/* route -> screen, tab, whether the answer depends on the chosen place */
const ROUTES = {
  welcome: { s: welcome, root: true }, // no tab bar: there is nowhere to go until she has a farm
  home: { s: home, tab: "home", root: true, chip: true },
  now: { s: now, tab: "home", chip: true },
  crop: { s: cropScreen, tab: "home", chip: true },
  farm: { s: farm, tab: "farm" },
  start: { s: start, tab: "farm", chip: true },
  sell: { s: sell, tab: "sell", chip: true },
  doctor: { s: doctor, tab: "doctor", chip: true },
  about: { s: about, tab: "home" },
  backup: { s: backup, tab: "farm" },
  help: { s: help, tab: "home" },
  next: { s: nextScreen, tab: "farm", chip: true },
  shift: { s: shift, tab: "home", chip: true },
};
const TABS = [["home", "#/", "house", "Home"], ["farm", "#/farm", "sprout", "My farm"], ["sell", null, "tag", "Sell"], ["doctor", null, "stethoscope", "Doctor"]];

/* first run, or a country she has not picked a town in yet: no place chosen and no real field in THIS country to read
   one from. A field in another country does not count, and the demo field never does. */
const needsSetup = () => { try { return !placeChosen() && !farmsHere().some((f) => !f.demo); } catch { return false; } };
const parse = () => { const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent); return { raw: parts[0], name: ROUTES[parts[0]] ? parts[0] : "home", a: parts[1], b: parts[2] }; };
/* A route can be typed, shared, restored from another country, or left behind by a deleted field, so what the URL
   claims is checked before it renders. Anything that cannot be shown is replaced (not pushed) by the screen it
   falls back to, so the address bar never describes a screen she is not on, and Back never returns to the lie. */
function canonical(r) {
  if (r.raw && !ROUTES[r.raw]) return "#/"; // an unknown path is not a screen
  if (r.name === "crop") {
    if (!crop(r.a)) return `#/crop/${focusCrop()}`;
    if (r.b && r.b !== "where") return `#/crop/${r.a}`;
  }
  if (r.name === "farm" && r.a && !farmsHere().some((f) => f.id === r.a)) return "#/farm"; // fields elsewhere are not this farm
  if (r.name === "next") {
    if (!crop(r.a)) return `#/next/${focusCrop()}`;
    if (isTree(crop(r.a))) return `#/crop/${r.a}`; // a tree has no season to follow with a rotation
    if (r.b && !farmsHere().some((f) => f.id === r.b)) return `#/next/${r.a}`;
  }
  if (r.name === "start" && r.a) {
    if (!crop(r.a)) return "#/start";
    if (isTree(crop(r.a))) return `#/crop/${r.a}`; // a tree cannot be followed as a field, and the crop page says so
  }
  if (r.name === "doctor") {
    const id = r.a && crop(r.a) ? r.a : focusCrop();
    if (id !== r.a) return `#/doctor/${id}`;
    if (r.b && !farmsHere().some((f) => f.id === r.b)) return `#/doctor/${id}`;
  }
  if (r.name === "sell") {
    if (!r.a) return null;
    if (!crop(r.a)) return "#/sell";
    if (r.b && !farmsHere().some((f) => f.id === r.b)) return `#/sell/${r.a}`;
  }
  return null;
}
function topbar(r, rt) {
  const farmCtx = (r.name === "sell" && !r.a) || ((r.name === "sell" || r.name === "doctor") && r.b); // the fields' own places, not the chip
  const t = rt.s.title(r.a, r.b);
  return `${rt.root ? `<a class="brand" href="#/about" aria-label="About Walo"><img class="brand-logo" src="img/logo-mark.png" alt="" width="30" height="30"></a>` : `<button type="button" class="back" id="back" aria-label="Back">${icon("chevron-left")}</button>`}
    <h1 class="tb-title">${esc(t)}</h1>
    ${online() ? "" : `<button type="button" class="offchip" id="offchip" aria-label="Offline. What works">${icon("wifi-off")}<span>Offline</span></button>`}
    ${twiOn() ? `<button type="button" class="langchip" id="langchip" data-notw aria-label="${isTwi() ? "Language: Twi. Switch to English" : "Language: English. Switch to Twi"}"><span${isTwi() ? "" : ' class="on"'}>EN</span><span${isTwi() ? ' class="on"' : ""}>Twi</span></button>` : ""}
    ${rt.chip && !farmCtx ? `<button type="button" class="placechip" id="placechip" aria-label="Place: ${esc(placeLabel(place()))}. Change">${icon("map-pin")}<span>${esc(placeLabel(place()))}</span></button>` : "<span class=\"tb-gap\"></span>"}`;
}
function tabbar(active) {
  const href = { sell: "#/sell", doctor: `#/doctor/${focusCrop()}` }; // Sell opens on the farmer's own fields; Doctor on the main crop
  return TABS.map(([k, h, ic, label]) => `<a href="${h || href[k]}" ${k === active ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("");
}
/* offline: things that need internet say so (grey tag + this sheet) instead of failing quietly */
function netSheet() {
  return { title: "This needs internet", html: `<div class="why"><p>You are offline. This part of Walo needs internet. Try again when you have a connection.</p>
    <p><b>Works without internet:</b></p><ul class="plain">${CFG().offline.works.map((w) => `<li>${w}</li>`).join("")}</ul>
    ${note("Planting advice offline uses the usual weather, not this week's forecast.", "wifi-off")}</div>` };
}
window.addEventListener("click", (e) => {
  const n = e.target.closest("[data-net]"), off = e.target.closest("#offchip");
  if ((n && !online()) || off) { e.preventDefault(); e.stopPropagation(); openSheet(netSheet(), n || off); }
}, true);
let twiToldAt = 0;
document.addEventListener("walo-twi-limit", (e) => { if (Date.now() - twiToldAt > 10 * 60e3) { twiToldAt = Date.now(); toast(e.detail || "Twi is resting now. Some words stay in English."); } });
let busy = false, ready = false;
function render(keepScroll = false) {
  if (busy || !ready) return; busy = true;
  try {
    const y = window.scrollY, r = parse(), rt = ROUTES[r.name];
    if (needsSetup() && r.name !== "welcome" && r.name !== "backup") { location.hash = "#/welcome"; return; }
    const fix = canonical(r);
    if (fix && fix !== location.hash) { location.replace(fix); return; } // re-enters with a route that exists
    if (!(rt.s === help && help.voiceOn())) stopSpeaking(); // a voice chat keeps talking while its own screen redraws
    resetSheets();
    const main = document.getElementById("main");
    main.innerHTML = `<div class="screen">${rt.s.render(r.a, r.b)}</div>`;
    document.getElementById("topbar").innerHTML = topbar(r, rt);
    const tb = document.getElementById("tabbar"); tb.innerHTML = rt.tab ? tabbar(rt.tab) : ""; tb.hidden = !rt.tab; tb.style.display = rt.tab ? "" : "none";
    document.body.dataset.route = r.name;
    document.body.classList.add("ready"); // from here the bars belong to a real screen, not the boot splash
    document.body.classList.toggle("has-hero", !!main.querySelector(".hero"));
    document.title = `${rt.s.title(r.a, r.b)} · Walo`;
    if (rt.s.mount) rt.s.mount(main.firstElementChild, r.a, r.b, () => render(true)); // the .screen node is new each render, so listeners never pile up
    hydrate(main);
    window.scrollTo(0, keepScroll ? y : 0); onScroll();
  } finally { busy = false; }
}
/* Back stays inside Walo and goes to the screen's parent. Using the browser history instead could take her out of the
   app, or to a screen that redirects straight back, which read as a dead button. */
function parentHash() {
  const { name, a, b } = parse();
  if (name === "crop" && b === "where" && a) return `#/crop/${encodeURIComponent(a)}`;
  if (name === "start" && a) return `#/crop/${encodeURIComponent(a)}`;
  if (name === "next" && b) return `#/farm/${encodeURIComponent(b)}`;
  if (name === "next" && a) return `#/crop/${encodeURIComponent(a)}`;
  if (name === "doctor" && b) return `#/doctor/${encodeURIComponent(a)}`;
  if (name === "help" && a) return "#/help";
  return "#/";
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#back")) { const h = parentHash(); if (location.hash !== h) location.hash = h; return; }
  const pc = e.target.closest("#placechip"); if (pc) { openPlacePicker(null, pc); }
  const po = e.target.closest("[data-place-open]"); if (po) { openPlacePicker("#/now", po); }
  if (e.target.closest("#langchip")) setLang(isTwi() ? "en" : "tw");
});
/* over a photo band the top bar is clear; once the page scrolls it turns solid again */
const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
document.addEventListener("sheet-open", (e) => hydrate(e.detail));
document.addEventListener("walo-refresh", () => render(true));
window.addEventListener("hashchange", () => { if (!ready) return; closeSheet(true); render(); document.getElementById("main").focus({ preventScroll: true }); });

(async function boot() {
  wire();
  try { await load(); } catch {
    document.getElementById("main").innerHTML = `<div class="screen"><div class="stack"><article class="answer bad"><h1 class="a-title">Could not load Walo</h1><p class="a-sub">Walo needs its data files the first time it opens. Check your connection, then try again.</p></article><a class="btn primary" href="./">Try again</a></div></div>`;
    return;
  }
  // which country this phone chose last time (Ghana if it never chose), and that country's price file
  setActiveCountry(countryId());
  try { await loadCountryData(); } catch { /* a country without prices still answers about planting */ }
  // older versions kept the place under walo.loc
  try { const old = localStorage.getItem("walo.loc"); if (old && !localStorage.getItem("walo.place") && old !== "live") localStorage.setItem("walo.place", JSON.stringify(old)); localStorage.removeItem("walo.loc"); localStorage.removeItem("walo.live"); } catch { /* ignore */ }
  startSync(); // only does anything if this phone turned backup on
  // No demo field is planted on a real phone any more: it made Home claim a crop she never
  // planted and made Sell and Doctor say "Ejura". seedDemo() is kept in store.js for an
  // explicit "see an example farm" later.
  ready = true;
  applyLang(); // English only unless data/app.json languages.enabled has "tw" (js/twi.js); clears a saved Twi choice
  subscribe(() => render(true));
  setForecastListener(() => render(true));
  render();
  // she just picked a country: show that country's towns straight away, not a Home with no place
  try {
    if (localStorage.getItem("walo.asktown")) {
      localStorage.removeItem("walo.asktown");
      if (parse().name === "welcome") { welcome.askPlace(); render(); }
      else openPlacePicker();
    }
  } catch { /* private mode */ }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // a new deploy should reach a phone that is never fully closed: check on return to the screen, and hourly
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
      setInterval(check, 60 * 60e3);
    }).catch(() => {});
  }
})();

