/* The two pickers every path uses: place (towns + "Use my location") and crop. Both open as a bottom sheet. */
import { towns, crops, cropsHere, fetchLive, placeName, nearestTown, inCountry, country, countryIds, loadCountryData } from "../data.js";
import { place, setPlace, setGps, placeLabel, mainCrop, mainIsAuto, autoMainCrop, setMainCrop, setCountry } from "../store.js";
import { openSheet, closeSheet, icon, cropImg, row } from "../ui.js";
import { esc } from "../util.js";

export function openPlacePicker(next, from) {
  const cur = place();
  const html = `<button type="button" class="btn secondary wide" id="use-gps" data-net>${icon("locate-fixed")}<span>Use my location</span></button>
    <p class="gps-msg" id="gps-msg" aria-live="polite"></p>
    ${countryIds().length > 1 ? `<button type="button" class="btn secondary wide" id="pick-country">${icon("map-pin")}<span>Country: ${esc(country().name)}</span></button>` : ""}
    <p class="list-h">Or pick the town nearest your farm</p>
    <input class="search-in" type="search" data-filter placeholder="Search a town" aria-label="Search a town">
    <p class="muted small" data-none hidden>No town matches that.</p>
    <div class="list">${towns().sort((a, b) => a.name.localeCompare(b.name)).map((t) => row({ attrs: `data-town="${t.id}"`, ic: "map-pin", title: esc(t.name), sub: esc(t.region), status: t.id === cur.id ? "good" : "" })).join("")}</div>`;
  openSheet({ title: "Choose the town nearest your farm", html, onOpen: (b) => {
    b.addEventListener("click", (e) => {
      const t = e.target.closest("[data-town]");
      if (t) { setPlace(t.dataset.town); closeSheet(true); go(next); return; }
      if (e.target.closest("#pick-country")) { openCountryPicker(null, b); return; }
      if (e.target.closest("#use-gps")) useGps(b, next);
    });
  } }, from);
}
const go = (next) => { if (next && location.hash !== next) location.hash = next; };

/* Country. Only a country Walo has data for is offered: "live" means its prices and planting windows have been
   checked by someone farming there; "preview" means they have not, and the app says so before you choose it. */
export function openCountryPicker(from, host) {
  const cur = (country() || {}).id;
  const cards = countryIds().map((k) => {
    const c = country(k), sub = c.status === "live" ? "Dates checked by a farmer" : "Dates not checked yet";
    return `<button type="button" class="ccard" data-country="${k}">
      <img class="ccard-flag" src="img/flags/${esc(c.flag || k.toLowerCase())}.png" alt="">
      <span class="ccard-t"><b>${esc(c.name)}</b><small>${esc(sub)}</small></span>
    </button>`;
  }).join("");
  openSheet({ title: "Choose your country", html: `<input class="search-in" type="search" data-filter placeholder="Search a country" aria-label="Search a country">
    <p class="muted small" data-none hidden>No country matches that.</p>
    <div class="ccards">${cards}</div>
    <p class="muted small">You will pick your town again: a town belongs to one country. "Dates not checked yet" means the planting dates come from published calendars, not from a farmer there.</p>`, onOpen: (b) => {
    b.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-country]");
      if (!t) return;
      if (t.dataset.country === cur) { closeSheet(true); return; }
      setCountry(t.dataset.country);
      try { await loadCountryData(); } catch { /* planting still works without prices */ }
      // a new country means new towns, map and prices everywhere, so start cleanly - and land on that
      // country's towns straight away instead of dropping her on Home with no place
      try { localStorage.setItem("walo.asktown", "1"); } catch { /* full */ }
      closeSheet(true);
      location.hash = "#/";
      location.reload();
    });
  } }, from || host);
}

function useGps(b, next) {
  const msg = b.querySelector("#gps-msg"), btn = b.querySelector("#use-gps"), say = (t, busy) => { msg.innerHTML = `${busy ? icon("loader-circle", "spin") : ""}<span>${t}</span>`; };
  if (!("geolocation" in navigator)) { say("This phone cannot share its location. Pick a town below."); return; }
  btn.disabled = true; say("Finding you…", true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude, n = nearestTown({ lat, lon });
    if (!inCountry(lat, lon)) { btn.disabled = false; say("Walo does not cover this place yet. Pick a town below."); return; }
    const name = await placeName(lat, lon);
    say(`Found you${name ? ` near ${esc(name)}` : ""}. Getting NASA weather for this spot…`, true);
    try {
      const live = await fetchLive(lat, lon);
      live.name = name || `Near ${n.t.name}`;
      setGps(live); closeSheet(true); go(next);
    } catch {
      btn.disabled = false; say(`Could not reach NASA right now. Pick a town below (nearest: ${esc(n.t.name)}).`);
    }
  }, () => { btn.disabled = false; say("Location was not shared. Pick a town below."); }, { timeout: 15000, maximumAge: 6e5 });
}

/* crop grid. mode: "where" (any place, A-Z) | "sell" | "doctor" (crops of this zone first). Start planting has its own grouped list. */
export function openCropPicker(mode, from, onPick) {
  const p = place(), here = new Set(cropsHere(p).map((c) => c.id));
  const list = crops().slice().sort((a, b) => (mode === "where" ? 0 : here.has(b.id) - here.has(a.id)) || a.name.localeCompare(b.name));
  const tile = (c) => `<button type="button" class="tile" data-crop="${c.id}">${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`;
  const html = `<input class="search-in" type="search" data-filter placeholder="Search a crop" aria-label="Search a crop">
    <p class="muted small" data-none hidden>No crop matches that.</p>
    <div class="tiles">${list.map(tile).join("")}</div>
    ${mode !== "where" ? `<p class="muted small">${esc(placeLabel(p))}: crops that grow in this zone come first.</p>` : ""}`;
  openSheet({ title: mode === "where" ? "Choose a crop" : "Choose your crop", html, onOpen: (b) => {
    b.addEventListener("click", (e) => { const t = e.target.closest("[data-crop]"); if (t && !t.disabled) { closeSheet(true); onPick(t.dataset.crop); } });
  } }, from);
}

/* my main crop: the crop Walo opens on (Sell, Plant Doctor, Crop). "From my fields" goes back to auto. */
export function openMainCropPicker(from) {
  const cur = mainCrop(), auto = autoMainCrop(), p = place(), here = new Set(cropsHere(p).map((c) => c.id));
  const list = crops().slice().sort((a, b) => here.has(b.id) - here.has(a.id) || a.name.localeCompare(b.name));
  const html = `${auto ? `<button type="button" class="btn secondary wide" data-main="">${icon("leaf")}<span>From my fields${mainIsAuto() ? " (now)" : ""}</span></button>` : ""}
    <input class="search-in" type="search" data-filter placeholder="Search a crop" aria-label="Search a crop">
    <div class="tiles">${list.map((c) => `<button type="button" class="tile${c.id === cur ? " sel" : ""}" data-main="${c.id}" ${c.id === cur ? 'aria-current="true"' : ""}>${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`).join("")}</div>
    <p class="muted small">Sell, Plant Doctor and crop pages open on this crop.</p>`;
  openSheet({ title: "Choose your main crop", html, onOpen: (b) => {
    b.addEventListener("click", (e) => { const t = e.target.closest("[data-main]"); if (t) { setMainCrop(t.dataset.main || null); closeSheet(true); } });
  } }, from);
}
