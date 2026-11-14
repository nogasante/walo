/* First run: the two questions Walo exists to answer, then the one thing it needs to answer them.
   Door 1: I have a farm — what can I grow there?  Door 2: I want to plant a crop — where should I plant it?
   Nothing is assumed: no town is picked for her, and she can sign in instead if she has used Walo before. */
import { towns, crops, cropsHere, fetchLive, placeName, nearestTown, inCountry } from "../data.js";
import { place, placeLabel, setPlace, setGps, setMainCrop, mainCrop, mainIsAuto } from "../store.js";
import { btn, icon, note, row, cropImg } from "../ui.js";
import { esc } from "../util.js";

/* step: "doors" | "place" | "crop".  order: which of the two she picked first. */
let W = { step: "doors", order: "place", crop: null };
export const title = () => "Welcome";

export function render() {
  if (W.step === "doors") return doors();
  if (W.step === "place") return placeStep();
  return cropStep();
}

function doors() {
  return `<div class="stack">
    <h1 class="q">What do you want to know?</h1>
    <div class="choices two">
      <button type="button" class="choice" data-door="place"><span class="tile-ic">${icon("map-pin")}</span><b>I have a farm</b><small>What can I grow there?</small></button>
      <button type="button" class="choice" data-door="crop"><span class="tile-ic">${icon("sprout")}</span><b>I want to plant a crop</b><small>Where should I plant it?</small></button>
    </div>
    <p class="muted small">Used Walo before? <a href="#/backup">Sign in with your email</a> and your fields come back.</p>
  </div>`;
}

function placeStep() {
  const list = towns().slice().sort((a, b) => a.name.localeCompare(b.name));
  const forCrop = W.order === "crop" && W.crop;
  return `<div class="stack">
    <h1 class="q">${forCrop ? "Where are you planting?" : "Where is your farm?"}</h1>
    ${note(forCrop ? `Walo will show you ${esc(W.crop)} where you are, and better places for it.` : "Walo uses NASA rain and temperature for your place. It stays on this phone.", "map-pin")}
    ${btn("Use my location", { ic: "locate-fixed", attrs: 'id="w-gps" data-net' })}
    <p class="gps-msg" id="w-msg" aria-live="polite"></p>
    <p class="list-h">Or pick the town nearest your farm</p>
    <div class="list">${list.map((t) => row({ attrs: `data-town="${t.id}"`, ic: "map-pin", title: esc(t.name), sub: esc(t.region) })).join("")}</div>
  </div>`;
}

function cropStep() {
  const here = new Set(cropsHere(place()).map((c) => c.id));
  const list = crops().slice().sort((a, b) => here.has(b.id) - here.has(a.id) || a.name.localeCompare(b.name));
  const cur = mainIsAuto() ? null : mainCrop(); // a crop from a field is not a choice she made here
  const asking = W.order === "crop";
  return `<div class="stack">
    <h1 class="q">${asking ? "Which crop do you want to plant?" : `What can you grow in ${esc(placeLabel(place()))}?`}</h1>
    ${note(asking ? "Walo will show you where it does best." : "The crops that do well here come first. Pick the one you grow.", "sprout")}
    <div class="tiles">${list.map((c) => `<button type="button" class="tile${c.id === cur ? " sel" : ""}" data-crop="${c.id}">${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`).join("")}</div>
    ${btn("I grow more than one", { kind: "secondary", attrs: "data-later" })}
    ${note("Sell, Plant Doctor and crop pages open on this crop. You can change it later.")}
  </div>`;
}

/* after she answers both questions, land where her question started */
const finish = (id) => {
  if (W.order === "crop" && id) location.hash = `#/crop/${id}/where`; // her crop, and the best places for it
  else location.hash = "#/";
};

export function mount(root) {
  root.addEventListener("click", (e) => {
    const door = e.target.closest("[data-door]");
    if (door) { W.order = door.dataset.door; W.step = W.order === "crop" ? "crop" : "place"; document.dispatchEvent(new Event("walo-refresh")); return; }
    const t = e.target.closest("[data-town]");
    if (t) { choosePlace(t.dataset.town); return; }
    const c = e.target.closest("[data-crop]");
    if (c) { chooseCrop(c.dataset.crop); return; }
    if (e.target.closest("[data-later]")) { setMainCrop(null); finish(null); return; }
    if (e.target.closest("#w-gps")) useGps(root);
  });
}

/* chose a crop */
function chooseCrop(id) {
  setMainCrop(id);
  if (W.order === "crop") { W.crop = id; W.step = "place"; }
  else finish(id);
  document.dispatchEvent(new Event("walo-refresh"));
}
/* chose a town */
function choosePlace(id) {
  setPlace(id);
  if (W.order === "crop") { W.step = "doors"; finish(W.crop); }
  else { W.step = "crop"; document.dispatchEvent(new Event("walo-refresh")); }
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
      if (W.order === "crop") { W.step = "doors"; finish(W.crop); }
      else { W.step = "crop"; document.dispatchEvent(new Event("walo-refresh")); }
    } catch {
      b.disabled = false; say("Could not reach NASA right now. Pick a town below.");
    }
  }, () => { b.disabled = false; say("Location was not shared. Pick a town below."); }, { timeout: 15000, maximumAge: 6e5 });
}
