/* First run: one screen, two questions. Where is your farm, then what do you mainly grow.
   Nothing is assumed: no town is picked for her, and she can sign in instead if she has used Walo before. */
import { towns, crops, cropsHere, fetchLive, placeName, nearestTown, inCountry } from "../data.js";
import { place, placeLabel, setPlace, setGps, setMainCrop, mainCrop, mainIsAuto } from "../store.js";
import { btn, icon, note, row, cropImg } from "../ui.js";
import { esc } from "../util.js";

let W = { step: 0 };
export const title = () => "Welcome";

export function render() {
  const p = place();
  if (W.step === 0 || !p) return stepPlace();
  return stepCrop(p);
}

function stepPlace() {
  const list = towns().slice().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="stack">
    <h1 class="q">Where is your farm?</h1>
    ${note("Walo uses NASA rain and temperature for your place. It stays on this phone.", "map-pin")}
    ${btn("Use my location", { ic: "locate-fixed", attrs: 'id="w-gps" data-net' })}
    <p class="gps-msg" id="w-msg" aria-live="polite"></p>
    <p class="muted small">Used Walo before? <a href="#/backup">Sign in with your email</a> and your fields come back.</p>
    <p class="list-h">Or pick the town nearest your farm</p>
    <div class="list">${list.map((t) => row({ attrs: `data-town="${t.id}"`, ic: "map-pin", title: esc(t.name), sub: esc(t.region) })).join("")}</div>
  </div>`;
}

function stepCrop(p) {
  const here = new Set(cropsHere(p).map((c) => c.id));
  const list = crops().slice().sort((a, b) => here.has(b.id) - here.has(a.id) || a.name.localeCompare(b.name));
  const cur = mainIsAuto() ? null : mainCrop(); // a crop from a field is not a choice she made here
  return `<div class="stack">
    <h1 class="q">What do you mainly grow?</h1>
    <p class="muted small">These do well in ${esc(placeLabel(p))}.${here.size ? "" : " Walo has no crop calendar for this zone, so this is a best guess."}</p>
    <div class="tiles">${list.map((c) => `<button type="button" class="tile${c.id === cur ? " sel" : ""}" data-crop="${c.id}">${cropImg(c, "tile-img")}<span>${esc(c.name)}</span></button>`).join("")}</div>
    ${btn("I grow more than one", { kind: "secondary", attrs: "data-later" })}
    ${note("Sell, Plant Doctor and crop pages open on this crop. You can change it later.")}
  </div>`;
}

export function mount(root) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-town]");
    if (t) { W.step = 1; setPlace(t.dataset.town); return; }
    const c = e.target.closest("[data-crop]");
    if (c) { setMainCrop(c.dataset.crop); location.hash = "#/"; return; }
    if (e.target.closest("[data-later]")) { setMainCrop(null); location.hash = "#/"; return; }
    if (e.target.closest("#w-gps")) useGps(root);
  });
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
      W.step = 1; setGps(live);
    } catch {
      b.disabled = false; say("Could not reach NASA right now. Pick a town below.");
    }
  }, () => { b.disabled = false; say("Location was not shared. Pick a town below."); }, { timeout: 15000, maximumAge: 6e5 });
}
