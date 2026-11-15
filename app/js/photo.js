/* The one photo path for Walɔ (Plant Doctor, Add photo, Start planting).
   - Two file inputs live in index.html (#walo-camera with capture, #walo-gallery without). Screens show them with
     <label for>, so the phone opens its own picker from a real tap; no script .click() on a hidden input.
   - The screen that asked is written to sessionStorage before the picker opens. If the phone reloads Walɔ meanwhile,
     the next visit either picks up the file (if the browser kept it) or tells the farmer the photo was lost.
   - The picked file is copied into memory at once, shown at once, then shrunk to a small JPEG with a time limit.
   - Screens get photos with takePhotos(prefix, fn) in mount(); photos that arrive before a screen is ready wait. */
import { CFG } from "./data.js";
import { icon } from "./ui.js";
import { log } from "./log.js";

const KEY = "walo.photo.open"; // { owner, kind, t } from the tap until the picker returns
export const MSG = {
  lost: "The phone closed Walɔ while the camera was open, so the photo was lost. Try again. If it happens again, take the photo with the phone's camera first, then use \"Choose a photo from the phone\".",
  unreadable: "Walɔ could not open that photo. Take the photo again, or choose a JPG photo from the phone.",
  save: "Walɔ could not save that photo on this phone. Try again.",
};
const readMark = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); return v && Date.now() - v.t < 10 * 60e3 ? v : null; } catch { return null; } };
const clearMark = () => { try { sessionStorage.removeItem(KEY); } catch { /* private mode */ } };
const prefix = (owner) => String(owner || "").split(":")[0];

/* ---------- delivery: owner "farm:<id>" goes to the handler for "farm" ---------- */
const HANDLERS = {}, PENDING = [];
let LOST = null;
function deliver(item) {
  const fn = HANDLERS[prefix(item.owner)];
  if (fn) fn(item.file, item.owner); else PENDING.push(item);
}
/* call in a screen's mount(): fn(file, owner) gets every photo picked for this screen, including one that came in before */
export function takePhotos(pre, fn) {
  HANDLERS[pre] = fn;
  for (let i = 0; i < PENDING.length; i++) if (prefix(PENDING[i].owner) === pre) { const it = PENDING.splice(i--, 1)[0]; fn(it.file, it.owner); }
}
/* message for this owner if its photo was lost when the page reloaded (shown once) */
export function lostPhoto(owner) { if (LOST && LOST === owner) { LOST = null; return MSG.lost; } return ""; }

/* ---------- the two inputs in index.html ---------- */
const INPUT = { camera: "walo-camera", gallery: "walo-gallery" };
const inputEl = (kind) => document.getElementById(INPUT[kind]);
let busyInput = false, lastOpen = {};
async function changed(kind, owner) {
  const inp = inputEl(kind), file = inp && inp.files && inp.files[0];
  if (!file) return;
  if (busyInput) return; busyInput = true;
  owner = owner || (readMark() || {}).owner || lastOpen.owner || "";
  clearMark();
  const t0 = performance.now();
  log("picked", { owner, kind, type: file.type || (file.name || "").split(".").pop(), size: file.size });
  let copy = null;
  try { copy = new File([await file.arrayBuffer()], file.name || "photo", { type: file.type || "" }); } // copy now: some Android pickers drop access later
  catch (e) { log("read_fail", { owner, kind, type: file.type, size: file.size, msg: String(e && e.name) }); }
  try { inp.value = ""; } catch { /* */ }
  lastOpen = {};
  busyInput = false;
  if (!owner) { log("no_owner", { kind }); return; }
  if (!copy || !copy.size) { copy = new File([], "unreadable"); }
  log("read_ok", { owner, kind, ms: performance.now() - t0, size: copy.size });
  deliver({ file: copy, owner });
}
for (const kind of Object.keys(INPUT)) {
  const inp = inputEl(kind);
  if (!inp) continue;
  inp.addEventListener("change", () => changed(kind));
  inp.addEventListener("cancel", () => { log("cancel", { owner: (readMark() || {}).owner, kind }); clearMark(); });
}
/* a tap on a photo label: remember who asked BEFORE the phone's picker opens */
document.addEventListener("click", (e) => {
  const l = e.target.closest && e.target.closest("label[data-photo]");
  if (!l) return;
  if (l.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
  lastOpen = { owner: l.dataset.photo, kind: l.dataset.kind };
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...lastOpen, t: Date.now() })); } catch { /* */ }
  log("open", { owner: l.dataset.photo, kind: l.dataset.kind });
}, true);
/* keyboard: Enter or Space on a photo label opens its picker */
document.addEventListener("keydown", (e) => {
  const l = e.target.closest && e.target.closest("label[data-photo]");
  if (l && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); l.click(); }
});
/* after a reload (the phone closed Walɔ while its picker was open): use the file if the browser kept it, else say so */
function recover() {
  const m = readMark();
  if (!m) return;
  const inp = inputEl(m.kind);
  if (inp && inp.files && inp.files[0]) { log("recovered", { owner: m.owner, kind: m.kind }); changed(m.kind, m.owner); return; }
  clearMark(); LOST = m.owner; log("lost", { owner: m.owner, kind: m.kind });
}
recover();
window.addEventListener("pageshow", (e) => { if (e.persisted) for (const kind of Object.keys(INPUT)) changed(kind); });

/* ---------- markup: a label that opens the camera or the gallery ---------- */
/* kind "camera" | "gallery"; owner names the screen ("doctor", "start", "farm:<id>") */
export function photoLabel(kind, owner, inner, { cls = "", attrs = "", disabled = false } = {}) {
  return `<label for="${INPUT[kind]}" class="${cls}" data-photo="${owner}" data-kind="${kind}" role="button" tabindex="0" ${disabled ? 'aria-disabled="true"' : ""} ${attrs}>${inner}</label>`;
}
export const galleryButton = (owner, attrs = "") => photoLabel("gallery", owner, `${icon("images")}<span>Choose a photo from the phone</span>`, { cls: "linkbtn", attrs });
export const cameraButton = (owner, label, { kind = "primary", attrs = "" } = {}) => photoLabel("camera", owner, `${icon("camera")}<span>${label}</span>`, { cls: `btn ${kind}`, attrs });

/* ---------- shrink ---------- */
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), ms))]);
function resize(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", q);
      } catch (e) { URL.revokeObjectURL(url); rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
    img.src = url;
  });
}
/* -> { blob, mime, original } ; throws Error(MSG.unreadable) */
export async function preparePhoto(file, { allowOriginal = false, owner = "" } = {}) {
  const pd = CFG().photo, t0 = performance.now();
  try {
    if (!file.size) throw new Error("empty");
    const blob = await timeout(resize(file, pd.max_side_px, pd.jpeg_quality), pd.decode_timeout_ms);
    log("shrunk", { owner, ms: performance.now() - t0, size: file.size, out: blob.size });
    return { blob, mime: "image/jpeg", original: false };
  } catch (e) {
    const type = (file.type || (/\.hei[cf]$/i.test(file.name || "") ? "image/heic" : "")).toLowerCase();
    const ok = allowOriginal && file.size && pd.original_types.includes(type) && file.size <= pd.original_max_bytes;
    log("shrink_fail", { owner, type, size: file.size, ms: performance.now() - t0, msg: String(e && e.message), stage: ok ? "original" : "error" });
    if (ok) return { blob: file, mime: type, original: true };
    throw new Error(MSG.unreadable);
  }
}
export const toBase64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = rej; fr.readAsDataURL(blob); });
export const showable = (mime) => /^image\/(jpeg|png|webp|gif)$/.test(mime || "");
