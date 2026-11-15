/* First run: the two questions Walo exists to answer, then the answer to the one she picked.
   Door 1: I have a farm — what can I grow there?      → ask the place, then the crops that do well there.
   Door 2: I want to plant a crop — where should I plant it? → ask the crop, then SHOW the places (never ask).
   Nothing is assumed: no town is picked for her, and she can sign in instead if she has used Walo before. */
import { towns, cropsHere, crop, scoreCrop, fetchLive, placeName, nearestTown, inCountry, country, countryIds, loadCountryData } from "../data.js";
import { place, placeLabel, setPlace, setGps, setMainCrop, mainCrop, mainIsAuto, setCountry } from "../store.js";
import { btn, icon, row, cropImg, wireSearch, emptyState, groupedCrops } from "../ui.js";
import { placesHtml } from "./crop.js";
import { esc } from "../util.js";
import { openCountryPicker } from "./pickers.js";

/* step: "doors" | "place" | "crop" | "places".  order: which of the two she picked first. */
let W = { step: "doors", order: "place", crop: null, near: null }; // near: her position, to order towns by how close they are
export const title = () => "Welcome";

export function render() {
  if (W.step === "doors") return doors();
  if (W.step === "country") return countryStep();
  if (W.step === "place") return placeStep();
  if (W.step === "places") return placesStep();
  return cropStep();
}

function doors() {
  return `<div class="stack wl">
    <div class="wl-hero">
      <p class="wl-to">Welcome to</p>
      <img class="wl-mark" src="img/logo-mark.png" alt="" width="96" height="96">
      <p class="wl-name">walo</p>
    </div>
    <div class="wl-doors">
      <button type="button" class="door" data-door="place">
        <img class="door-pic" src="img/field.webp" alt="">
        <span class="door-t"><b>I have a farm</b><small>What can I grow there?</small></span>
      </button>
      <button type="button" class="door" data-door="crop">
        <img class="door-pic" src="img/maize.webp" alt="">
        <span class="door-t"><b>I want to plant a crop</b><small>Where should I plant it?</small></span>
      </button>
    </div>
    <p class="muted small wl-signin">Used Walo before? <a href="#/backup">Sign in with your email</a> and your fields come back.</p>
  </div>`;
}

/* Step one is the country on its own, and nothing else: her country decides which towns can be offered,
   so showing the towns of the old one underneath was asking her a question out of order. */
function countryStep() {
  const cur = (country() || {}).id;
  return `<div class="stack">
    ${whead()}
    <h1 class="q wl-q">Choose the country you farm in</h1>
    <input class="search-in" type="search" data-filter placeholder="Search a country" aria-label="Search a country">
    <div data-none hidden></div>
    <div class="ccards">${countryIds().map((k) => {
      // flag and name only: a card is a choice, not a place to explain ourselves
      const c = country(k);
      return `<button type="button" class="ccard" data-wcountry="${k}">
        <img class="ccard-flag" src="img/flags/${esc(c.flag || k.toLowerCase())}.png" alt="">
        <span class="ccard-t"><b>${esc(c.name)}</b></span>
      </button>`;
    }).join("")}</div>
  </div>`;
}

/* the country she is in, the GPS shortcut, then the towns: one column, in the order she needs them */
function placeStep() {
  const list = towns().slice().sort((a, b) => a.name.localeCompare(b.name));
  const c = country();
  return `<div class="stack">
    ${whead()}
    <h1 class="q wl-q">Choose the town nearest your farm</h1>
    <div class="loccard">
      <img class="locflag" src="img/flags/${esc(c.flag || c.id.toLowerCase())}.png" alt="">
      <span class="loctext"><b>${esc(c.name)}</b><small>Planting dates and market prices come from here.</small></span>
      ${countryIds().length > 1 ? `<button type="button" class="locchange" data-wchange>Change</button>` : ""}
    </div>
    ${btn("Use my location", { ic: "locate-fixed", attrs: 'id="w-gps" data-net' })}
    <p class="gps-msg" id="w-msg" aria-live="polite"></p>
    <p class="muted small loc-note">Reads NASA rain and temperature for the spot. It stays on this phone.</p>
    <div class="or"><span></span><em>or pick a town</em><span></span></div>
    <input class="search-in" type="search" data-filter placeholder="Search a town" aria-label="Search a town">
    <div data-none hidden></div>
    ${list.length
      ? `<div class="list">${list.map((t) => row({ attrs: `data-town="${t.id}"`, ic: "map-pin", title: esc(t.name), sub: esc(t.region) })).join("")}</div>`
      : emptyState({ ic: "map-pin", title: `No towns in ${c.name} yet`, sub: "Change country, or tell us your town and Walo will add it.", action: "Change country", attrs: "data-wchange" })}
  </div>`;
}

function cropStep() {
  const asking = W.order === "crop", p = place(), cur = mainIsAuto() ? null : mainCrop(); // a crop from a field is not a choice she made here
  // A crop list sorted "best first" still put crops Walo rates poorly under a heading promising otherwise, so the
  // tiles are grouped by what Walo actually found: grows well, can grow, grows poorly. Nothing is hidden.
  const list = cropsHere(p).slice().sort((a, b) => scoreCrop(b, p).score - scoreCrop(a, p).score || a.name.localeCompare(b.name));
  const band = (c) => scoreCrop(c, p).score;
  const groups = [
    { title: "Grows well here", icon: "leaf", tone: "good", items: list.filter((c) => band(c) >= 4) },
    { title: "Can grow here", icon: "sprout", tone: "wait", items: list.filter((c) => band(c) === 3) },
    { title: "Grows poorly here", icon: "circle-x", tone: "bad", items: list.filter((c) => band(c) <= 2), collapsed: true },
  ].filter((g) => g.items.length);
  const tile = (c) => `<button type="button" class="tile${c.id === cur ? " sel" : ""}" data-crop="${c.id}">${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`;
  return `<div class="stack">
    ${whead()}
    <h1 class="q wl-q">${asking ? "Choose the crop you want to plant" : "Choose the crop you grow"}</h1>
    <input class="search-in" type="search" data-filter placeholder="Search a crop" aria-label="Search a crop">
    <div data-none hidden></div>
    ${groups.length ? groupedCrops(groups, tile, "tiles") : emptyState({ ic: "sprout", title: "No crops listed yet", sub: "Walo has no crops for this country yet.", action: "Change country", attrs: "data-wchange" })}
  </div>`;
}

/* door 2's answer: the places that suit the crop, and nothing asked of her */
function placesStep() {
  const c = crop(W.crop);
  if (!c) { W.step = "doors"; return doors(); }
  return `<div class="stack">
    ${whead()}
    <h1 class="q wl-q">How ${esc(c.name.toLowerCase())} grows in each town</h1>
    ${btn(W.near ? "Best for this crop first" : "Towns near me first", { kind: "secondary", ic: "locate-fixed", attrs: 'id="w-near"' })}
    <p class="gps-msg" id="w-near-msg" aria-live="polite"></p>
    ${placesHtml(c, { near: W.near })}
  </div>`;
}
/* "near me first" asks the phone once; the order only changes, the verdicts do not */
function nearMe(root) {
  if (W.near) { W.near = null; refresh(); return; }
  const msg = root.querySelector("#w-near-msg");
  if (!("geolocation" in navigator)) { if (msg) msg.textContent = "This phone cannot share its location."; return; }
  if (msg) msg.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => { W.near = { lat: pos.coords.latitude, lon: pos.coords.longitude }; refresh(); },
    () => { if (msg) msg.textContent = "Location was not shared. The towns are still listed."; },
    { timeout: 15000, maximumAge: 6e5 },
  );
}

/* every step after the two doors: back on the far left, the brand centred, nothing else in the bar */
const whead = () => `<div class="whead">
  <button type="button" class="wback" data-wback aria-label="Back">${icon("chevron-left")}</button>
  <a class="wbrand" href="#/about"><img src="img/logo-mark.png" alt="" width="26" height="26"><span>walo</span></a>
  <span></span>
</div>`;

/* the country sheet, or a reload after changing country, lands her on the town list */
export function askPlace() { W.step = "place"; W.order = "place"; }

/* where "back" goes from the step she is on */
function stepBack() {
  if (W.step === "place") W.step = countryIds().length > 1 ? "country" : "doors";
  else if (W.step === "country") W.step = "doors";
  else if (W.step === "crop") W.step = W.order === "place" ? "country" : "doors";
  else { W.step = "crop"; W.crop = null; }
  refresh();
}

/* chose a country: fetch its towns and prices, then ask for the town */
async function awaitCountry(id) {
  if (id !== (country() || {}).id) {
    setCountry(id);
    try { await loadCountryData(); } catch { /* towns still work without prices */ }
  }
  // a country bounds the answer: "where should I plant it?" must only ever name towns in the country she farms in
  W.step = W.order === "crop" ? "crop" : "place";
  refresh();
}

export function mount(root) {
  wireSearch(root);
  root.addEventListener("click", (e) => {
    const door = e.target.closest("[data-door]");
    if (door) { W.order = door.dataset.door; W.step = countryIds().length > 1 ? "country" : W.order === "crop" ? "crop" : "place"; refresh(); return; }
    const wc = e.target.closest("[data-wcountry]");
    if (wc) { awaitCountry(wc.dataset.wcountry); return; }
    if (e.target.closest("[data-wchange]")) { W.step = "country"; refresh(); return; }
    if (e.target.closest("[data-wback]")) { stepBack(); return; }
    const t = e.target.closest("[data-town]");
    if (t) { choosePlace(t.dataset.town); return; }
    const c = e.target.closest("[data-crop]");
    if (c) { chooseCrop(c.dataset.crop); return; }
    if (e.target.closest("[data-later]")) { setMainCrop(null); location.hash = "#/"; return; }
    if (e.target.closest("#w-gps")) useGps(root);
    if (e.target.closest("#w-near")) nearMe(root);
    if (e.target.closest("#w-country")) openCountryPicker(null, root);
  });
}

const refresh = () => document.dispatchEvent(new Event("walo-refresh"));

/* chose a crop: door 1 goes on to ask the place; door 2 gets its answer straight away */
function chooseCrop(id) {
  setMainCrop(id);
  W.crop = id;
  if (W.order === "crop") W.step = "places";
  else { W.step = "doors"; location.hash = "#/"; return; }
  refresh();
}
/* chose a town */
function choosePlace(id) {
  setPlace(id);
  if (W.order === "crop") { W.step = "doors"; location.hash = `#/crop/${W.crop}`; }
  else { W.step = "crop"; refresh(); }
}

/* same rules as the place picker: only inside a country Walo covers, and NASA must answer */
function useGps(root) {
  const msg = root.querySelector("#w-msg"), b = root.querySelector("#w-gps");
  const say = (t, busy) => { msg.innerHTML = `${busy ? icon("loader-circle", "spin") : ""}<span>${t}</span>`; };
  if (!("geolocation" in navigator)) { say("This phone cannot share its location. Pick a town below."); return; }
  b.disabled = true; say("Finding you…", true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (!inCountry(lat, lon)) { b.disabled = false; say("Walo does not cover this place yet. Pick a town below."); return; }
    const name = await placeName(lat, lon);
    say(`Found you${name ? ` near ${esc(name)}` : ""}. Getting NASA weather for this spot…`, true);
    try {
      const live = await fetchLive(lat, lon);
      live.name = name || `Near ${nearestTown({ lat, lon }).t.name}`;
      setGps(live);
      W.step = "crop"; refresh();
    } catch {
      b.disabled = false; say("Could not reach NASA right now. Pick a town below.");
    }
  }, () => { b.disabled = false; say("Location was not shared. Pick a town below."); }, { timeout: 15000, maximumAge: 6e5 });
}
