/* Walo state: the chosen place and crop, the farms, and farm photos. Everything stays on this phone
   (localStorage for small values, IndexedDB for photos). Screens read from here and call the setters.
   If the farmer turns on backup (js/sync.js), each changed field also gets a time stamp so the newest copy wins. */
import { CFG, town, towns, crop, crops, setActiveCountry, cropInCountry } from "./data.js";
import { DAY, today0, iso } from "./util.js";

const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

/* ---------- place ---------- */
export function place() {
  const id = get("walo.place", null);
  if (id === "gps") { const g = get("walo.gps", null); if (g && g.agro) return g; }
  return town(id) || town(CFG().default_place) || towns()[0];
}
/* ---------- country ---------- */
/* Changing country clears the place and any phone location, because neither is in the new country. */
export const countryId = () => get("walo.country", null);
/* Changing country clears the place, a phone location, the main crop and the crop as well: rice in Ghana is not a
   choice about Kenya, and keeping it made Walo open on a crop nobody there grows. */
export function setCountry(id) { set("walo.country", id); set("walo.place", null); set("walo.gps", null); set("walo.main", { crop: null, updated: new Date().toISOString() }); set("walo.crop", null); setActiveCountry(id); emit(); }
export function setPlace(id) { set("walo.place", id); emit(); }
export function setGps(p) { set("walo.gps", p); set("walo.place", "gps"); emit(); }
export const placeLabel = (p) => (p.kind === "gps" ? p.name || "My location" : p.name);
/* has she actually chosen a place? Before that, place() is only the demo default and must not look like hers. */
export const placeChosen = () => !!get("walo.place", null);

/* ---------- crop ---------- */
export function cropId() { const id = get("walo.crop", null); return crop(id) ? id : crop(CFG().default_crop) ? CFG().default_crop : crops()[0].id; }
export function setCrop(id) { if (crop(id)) set("walo.crop", id); }

/* ---------- main crop: the crop this farmer focuses on. A choice made here wins; otherwise ("auto") the crop of most of
   their fields (real fields before the demo; on a tie the newest field). Sell, Plant Doctor and Crop open on it. ---------- */
const mainRaw = () => get("walo.main", null); // { crop: id | null (auto), updated }
export function autoMainCrop() {
  const all = farms(), real = all.filter((f) => !f.demo), list = real.length ? real : all, n = {};
  list.forEach((f) => { n[f.crop] = (n[f.crop] || 0) + 1; });
  return list.reduce((best, f) => (best == null || n[f.crop] > n[best] ? f.crop : best), null);
}
export const mainIsAuto = () => { const m = mainRaw(); return !(m && crop(m.crop)); };
/* A stored choice survives only where it still applies: a crop this country does not grow is ignored (it can only
   be left over from another country), and then the fields decide, and if they cannot either there is no main crop. */
export function mainCrop() {
  const pick = mainIsAuto() ? autoMainCrop() : mainRaw().crop;
  if (pick && cropInCountry(crop(pick))) return pick;
  const auto = autoMainCrop();
  return auto && cropInCountry(crop(auto)) ? auto : null;
}
export const focusCrop = () => mainCrop() || cropId();
export function setMainCrop(id) { set("walo.main", { crop: id && crop(id) ? id : null, updated: new Date().toISOString() }); emit(); }
/* for js/sync.js only */
export const mainCropRaw = mainRaw;
export const putMainCropRaw = (m) => { set("walo.main", m); emit(); };

/* ---------- farms ---------- */
export const farms = () => get("walo.farms", []).filter((f) => crop(f.crop));
export const farm = (id) => farms().find((f) => f.id === id) || null;
/* A field belongs to the country of its town. When she switches country her Ghanaian field must not be priced with
   another country's markets and crop calendars, so the screens use these two lists and say where the others are. */
export const farmsHere = () => farms().filter((f) => !!town(f.loc)); // a field keeps its town in f.loc
export const farmsElsewhere = () => farms().filter((f) => !town(f.loc));

/* ---------- where she left off ---------- */
/* Choosing a crop and a town is a job she may not finish in one go. This remembers the pair so Home can offer it back
   until she starts the field, and is cleared the moment a field exists or she dismisses the card. */
export const resumeTask = () => get("walo.resume", null);
export const setResumeTask = (t) => { set("walo.resume", t); emit(); };
export const clearResumeTask = () => { set("walo.resume", null); emit(); };
function saveFarms(list) {
  if (!set("walo.farms", list)) { alert("Phone storage is full. Remove a field and try again."); return false; }
  emit(); return true;
}
const stamp = () => new Date().toISOString();
const newUid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
export function addFarm(f) { const id = Date.now().toString(36); return saveFarms([{ id, uid: newUid(), photos: [], ...f, updated: stamp() }, ...farms()]) ? id : null; }
export function updateFarm(id, fn) { const all = farms(), f = all.find((x) => x.id === id); if (!f) return false; fn(f); f.updated = stamp(); return saveFarms(all); }
export function removeFarm(id) {
  const all = farms(), gone = all.find((f) => f.id === id);
  ((gone && gone.photos) || []).forEach((ph) => { if (/^idb:/.test(ph.src || "")) delPhoto(ph.src.slice(4)); });
  if (gone && gone.uid && !gone.demo) set("walo.removed", [...get("walo.removed", []), { uid: gone.uid, at: stamp() }]); // so backup removes it too
  return saveFarms(all.filter((f) => f.id !== id));
}
/* for js/sync.js only: the raw list, a whole-list replace after a download, and the removed-fields list */
export const allFarmsRaw = () => get("walo.farms", []);
export const replaceFarms = (list) => saveFarms(list);
export const removedFarms = () => get("walo.removed", []);
export const clearRemoved = (uids) => set("walo.removed", get("walo.removed", []).filter((r) => !uids.includes(r.uid)));
export const ensureUid = (f) => (f.uid ? false : ((f.uid = newUid()), (f.updated = f.updated || stamp()), true));
/* first open: one demo field (data/app.json demo_farm), clearly tagged "Demo" */
export function seedDemo() {
  if (get("walo.seeded", null)) return;
  set("walo.seeded", 1);
  if (farms().length) return;
  const d = CFG().demo_farm, sow = new Date(today0().getTime() - d.days_ago * DAY);
  set("walo.farms", [{ id: d.id, demo: true, name: d.name, crop: d.crop, date: iso(sow), loc: d.loc,
    photos: d.photos.map((ph) => ({ src: ph.src, stage: ph.stage, date: iso(new Date(sow.getTime() + ph.day_offset * DAY)) })) }]);
}

/* ---------- photos: resized JPEG in IndexedDB; a farm keeps "idb:<key>" ---------- */
let _db;
function db() {
  if (!_db) _db = new Promise((res, rej) => {
    if (!("indexedDB" in window)) { rej(new Error("no IndexedDB")); return; }
    const r = indexedDB.open("walo", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return _db;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction("photos", mode), q = fn(t.objectStore("photos")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
const delPhoto = (k) => tx("readwrite", (s) => s.delete(k)).catch(() => {});
export const getPhotoBlob = (k) => tx("readonly", (s) => s.get(k)).catch(() => null);
export const putPhotoBlob = (k, blob) => tx("readwrite", (s) => s.put(blob, k));
const URLS = {};
export async function photoUrl(src) {
  if (!/^idb:/.test(src || "")) return src;
  const k = src.slice(4);
  if (!URLS[k]) { const b = await tx("readonly", (s) => s.get(k)).catch(() => null); if (b) URLS[k] = URL.createObjectURL(b); }
  return URLS[k] || "";
}
export const photoUrlNow = (src) => (/^idb:/.test(src || "") ? URLS[src.slice(4)] || "" : src);
/* fill <img data-ph="idb:..."> after render */
export async function hydrate(root) {
  for (const el of root.querySelectorAll("img[data-ph]")) { const u = await photoUrl(el.dataset.ph); if (u) el.src = u; }
}
/* keep a prepared JPEG (js/photo.js) on the phone; returns "idb:<key>" */
export async function saveBlob(blob) {
  const k = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await tx("readwrite", (s) => s.put(blob, k));
  URLS[k] = URL.createObjectURL(blob);
  return "idb:" + k;
}
