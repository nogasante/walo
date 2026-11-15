/* First run: the two questions Walo exists to answer, then the answer to the one she picked.
   Door 1: I have a farm — what can I grow there?      → ask the place, then the crops that do well there.
   Door 2: I want to plant a crop — where should I plant it? → ask the crop, then SHOW the places (never ask).
   Nothing is assumed: no town is picked for her, and she can sign in instead if she has used Walo before. */
import { towns, crops, cropsHere, crop, fetchLive, placeName, nearestTown, inCountry, country, countryIds } from "../data.js";
import { place, placeLabel, setPlace, setGps, setMainCrop, mainCrop, mainIsAuto } from "../store.js";
import { btn, icon, note, row, cropImg } from "../ui.js";
import { placesHtml } from "./crop.js";
import { esc } from "../util.js";
import { openCountryPicker } from "./pickers.js";

/* step: "doors" | "place" | "crop" | "places".  order: which of the two she picked first. */
let W = { step: "doors", order: "place", crop: null };
export const title = () => "Welcome";

export function render() {
  if (W.step === "doors") return doors();
  if (W.step === "place") return placeStep();
  if (W.step === "places") return placesStep();
  return cropStep();
}

function doors() {
  return `<div class="stack wl">
    <div class="wl-head">
      <h1 class="q">What do you want to know?</h1>
      <p class="muted">Pick one. You can change it any time.</p>
    </div>
    <div class="wl-doors">
      <button type="button" class="door" data-door="place">
        <img class="door-pic" src="img/field.webp" alt="" width="84" height="84">
        <span class="door-t"><b>I have a farm</b><small>What can I grow there?</small></span>
        <span class="door-go">${icon("chevron-right")}</span>
      </button>
      <button type="button" class="door" data-door="crop">
        <img class="door-pic" src="img/maize.webp" alt="" width="84" height="84">
        <span class="door-t"><b>I want to plant a crop</b><small>Where should I plant it?</small></span>
        <span class="door-go">${icon("chevron-right")}</span>
      </button>
    </div>
    <p class="muted small wl-signin">Used Walo before? <a href="#/backup">Sign in with your email</a> and your fields come back.</p>
  </div>`;
}

function placeStep() {
  const list = towns().slice().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="stack">
    ${backBtn()}
    <h1 class="q">Where is your farm?</h1>
    ${note("Walo uses NASA rain and temperature for your place. It stays on this phone.", "map-pin")}
    ${btn("Use my location", { ic: "locate-fixed", attrs: 'id="w-gps" data-net' })}
    ${countryIds().length > 1 ? btn(`Country: ${country().name}`, { kind: "secondary", ic: "map-pin", attrs: 'id="w-country"' }) : ""}
    <p class="gps-msg" id="w-msg" aria-live="polite"></p>
    <p class="list-h">Or pick the town nearest your farm</p>
    <div class="list">${list.map((t) => row({ attrs: `data-town="${t.id}"`, ic: "map-pin", title: esc(t.name), sub: esc(t.region) })).join("")}</div>
  </div>`;
}

function cropStep() {
  const asking = W.order === "crop";
  const here = new Set(cropsHere(place()).map((c) => c.id));
  // door 1: the crops that do well here come first. Door 2: she already knows the crop, so keep it A-Z.
  const list = crops().slice().sort((a, b) => (asking ? 0 : here.has(b.id) - here.has(a.id)) || a.name.localeCompare(b.name));
  const cur = mainIsAuto() ? null : mainCrop(); // a crop from a field is not a choice she made here
  return `<div class="stack">
    ${backBtn()}
    <h1 class="q">${asking ? "Which crop do you want to plant?" : `What can you grow in ${esc(placeLabel(place()))}?`}</h1>
    ${note(asking ? "Walo will show you where it does best." : "The crops that do well here come first. Pick the one you grow.", "sprout")}
    <div class="tiles">${list.map((c) => `<button type="button" class="tile${c.id === cur ? " sel" : ""}" data-crop="${c.id}">${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`).join("")}</div>
    ${asking ? "" : btn("I grow more than one", { kind: "secondary", attrs: "data-later" })}
    ${note("Sell, Plant Doctor and crop pages open on this crop. You can change it later.")}
  </div>`;
}

/* door 2's answer: the places that suit the crop, and nothing asked of her */
function placesStep() {
  const c = crop(W.crop);
  if (!c) { W.step = "doors"; return doors(); }
  return `<div class="stack">
    ${backBtn("Choose another crop")}
    <h1 class="q">Where should you plant ${esc(c.name.toLowerCase())}?</h1>
    ${placesHtml(c, "Tap the town where you will plant it.")}
  </div>`;
}

/* one way back from every step, so a wrong tap never strands her in the middle of setup */
const backBtn = (label = "Back") => `<button type="button" class="wback" data-wback>${icon("chevron-left")}<span>${label}</span></button>`;

/* where "back" goes from the step she is on */
function stepBack() {
  if (W.step === "place") W.step = "doors";
  else if (W.step === "crop") W.step = W.order === "place" ? "place" : "doors";
  else { W.step = "crop"; W.crop = null; }
  refresh();
}

export function mount(root) {
  root.addEventListener("click", (e) => {
    const door = e.target.closest("[data-door]");
    if (door) { W.order = door.dataset.door; W.step = W.order === "crop" ? "crop" : "place"; refresh(); return; }
    if (e.target.closest("[data-wback]")) { stepBack(); return; }
    const t = e.target.closest("[data-town]");
    if (t) { choosePlace(t.dataset.town); return; }
    const c = e.target.closest("[data-crop]");
    if (c) { chooseCrop(c.dataset.crop); return; }
    if (e.target.closest("[data-later]")) { setMainCrop(null); location.hash = "#/"; return; }
    if (e.target.closest("#w-gps")) useGps(root);
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
