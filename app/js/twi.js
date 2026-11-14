/* Walo in Twi: machine translation, voice and listening by GhanaNLP Khaya, through our server (/api/twi).
   - Fixed labels come from data/i18n-tw.json (built once, machine-translated, needs a Twi speaker's check).
   - Everything else on screen (answers, AI answers) is translated when it shows, then kept on this phone.
   - Screens are written in English; this module swaps the words in the page, so English stays the one source.
   Nothing here is logged. */
import { CFG } from "./data.js";

const T = () => CFG().twi;
const LS = "walo.lang", LC = "walo.tw.cache";
let DICT = null, dictP = null, MEM = null, STATUS = null, statusP = null, obs = null;
const ORIG = new WeakMap(), LIVE = new Set(); // text node -> { en, tw }
const SKIP = "script,style,textarea,input,select,svg,[data-notw],.vh-input";

export const lang = () => { try { return localStorage.getItem(LS) === "tw" ? "tw" : "en"; } catch { return "en"; } };
export const isTwi = () => lang() === "tw";

/* ---------- capability (no call to Khaya) ---------- */
export function status() {
  if (STATUS) return Promise.resolve(STATUS);
  if (!statusP) statusP = fetch(`${T().endpoint}?action=status`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (STATUS = { translate: !!j.translate, tts: !!j.tts, asr: !!j.asr }));
  return statusP;
}
export const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));
export const asrReady = () => !!(STATUS && STATUS.asr) && canRecord();

/* ---------- words: dictionary, then this phone's cache, then the server ---------- */
function mem() {
  if (!MEM) { try { MEM = JSON.parse(localStorage.getItem(LC) || "{}"); } catch { MEM = {}; } }
  return MEM;
}
let saveT = 0;
function remember(k, v) {
  const m = mem(); m[k] = v;
  const keys = Object.keys(m); if (keys.length > T().cache_max) keys.slice(0, keys.length - T().cache_max).forEach((x) => delete m[x]);
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LC, JSON.stringify(m)); } catch { /* full: keep in memory */ } }, 400);
}
function dict() {
  if (!dictP) dictP = fetch(T().dict).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (DICT = j.strings || {}));
  return dictP;
}
const known = (s, to) => (to === "tw" ? (DICT && DICT[s]) || mem()["tw|" + s] : mem()["en|" + s]);
const inflight = new Map();
let restUntil = 0; // the server said Twi is resting (Khaya quota): keep English for a while, tell the farmer once
function resting(j) {
  if (!j || j.ok) return;
  restUntil = Date.now() + T().rest_ms;
  document.dispatchEvent(new CustomEvent("walo-twi-limit", { detail: j.error || "" }));
}
export async function translate(texts, to = "tw") {
  if (to === "tw") await dict();
  const out = texts.map((s) => known(s, to) || null), miss = Date.now() < restUntil || !navigator.onLine ? [] : [...new Set(texts.filter((s, i) => !out[i] && /\p{L}/u.test(s)))];
  for (let i = 0; i < miss.length; i += T().batch) {
    const part = miss.slice(i, i + T().batch), key = to + "|" + part.join("\u0001");
    if (!inflight.has(key)) inflight.set(key, fetch(`${T().endpoint}?action=translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: part, to }) })
      .then((r) => r.json()).catch(() => ({ ok: false })).finally(() => inflight.delete(key)));
    const j = await inflight.get(key);
    if (j.ok) part.forEach((s, k) => { if (j.out[k]) remember(to + "|" + s, j.out[k]); });
    else { resting(j); break; }
  }
  return texts.map((s, i) => out[i] || known(s, to) || null);
}

/* ---------- the page: swap English text for Twi as it appears ---------- */
const wanted = (n) => n.parentElement && !n.parentElement.closest(SKIP) && /\p{L}/u.test(n.data);
function collect(root, list) {
  if (root.nodeType === 3) { if (wanted(root)) list.push(root); return; }
  if (root.nodeType !== 1 || root.matches(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (wanted(n)) list.push(n);
  root.querySelectorAll("[placeholder]").forEach((el) => { if (!el.closest("[data-notw]")) list.push(el); });
}
const core = (s) => s.trim();
function put(n, tw) {
  if (n.nodeType === 3) { const o = ORIG.get(n); const lead = o.raw.match(/^\s*/)[0], tail = o.raw.match(/\s*$/)[0]; o.tw = lead + tw + tail; n.data = o.tw; }
  else { const o = ORIG.get(n); o.tw = tw; n.setAttribute("placeholder", tw); }
}
let pending = [], flushT = 0;
async function flush() {
  const nodes = pending.filter((n) => n.isConnected); pending = [];
  if (!nodes.length || !isTwi()) return;
  nodes.forEach((n) => { if (!ORIG.has(n) || (n.nodeType === 3 ? n.data !== ORIG.get(n).tw : n.getAttribute("placeholder") !== ORIG.get(n).tw)) ORIG.set(n, { raw: n.nodeType === 3 ? n.data : n.getAttribute("placeholder"), tw: null }); LIVE.add(n); });
  const keys = nodes.map((n) => core(ORIG.get(n).raw));
  const tw = await translate(keys, "tw");
  if (!isTwi()) return;
  nodes.forEach((n, i) => { if (tw[i] && n.isConnected) put(n, tw[i]); });
  for (const n of LIVE) if (!n.isConnected) LIVE.delete(n);
}
function queue(list) { pending.push(...list); clearTimeout(flushT); flushT = setTimeout(flush, 20); }
function onMut(muts) {
  const list = [];
  for (const m of muts) {
    if (m.type === "characterData") { const o = ORIG.get(m.target); if (!o || m.target.data !== o.tw) collect(m.target, list); }
    else m.addedNodes.forEach((n) => collect(n, list));
  }
  if (list.length) queue(list);
}
function startDom() {
  if (obs) return;
  obs = new MutationObserver(onMut);
  [document.querySelector(".app"), document.getElementById("sheet")].filter(Boolean).forEach((r) => { obs.observe(r, { childList: true, subtree: true, characterData: true }); const l = []; collect(r, l); queue(l); });
}
function stopDom() {
  if (obs) { obs.disconnect(); obs = null; }
  for (const n of LIVE) { const o = ORIG.get(n); if (o && n.isConnected) { if (n.nodeType === 3) n.data = o.raw; else n.setAttribute("placeholder", o.raw); } }
  LIVE.clear();
}
export function setLang(l) {
  try { localStorage.setItem(LS, l); } catch { /* */ }
  apply();
  document.dispatchEvent(new Event("walo-refresh"));
}
export function apply() {
  document.documentElement.lang = isTwi() ? "tw" : "en";
  if (isTwi()) { status(); dict(); startDom(); } else stopDom();
}

/* ---------- Listen in Twi: Khaya voice; the audio is kept on this phone so the same words play offline ---------- */
let audio = null, playing = 0;
export function stopTwi() { playing++; if (audio) { audio.pause(); audio = null; } }
function chunks(s, max) {
  const parts = s.match(/[^.!?]+[.!?]*/g) || [s], out = [];
  parts.forEach((p) => { p = p.trim(); if (!p) return; const last = out[out.length - 1]; if (last && (last + " " + p).length <= max) out[out.length - 1] = last + " " + p; else out.push(p.slice(0, max)); });
  return out;
}
async function clip(text) {
  const url = `${T().endpoint}?action=tts&text=${encodeURIComponent(text)}`;
  const box = "caches" in window ? await caches.open(T().audio_cache).catch(() => null) : null;
  let r = box ? await box.match(url) : null;
  if (!r) {
    r = await fetch(url);
    if (!r.ok || !/^audio\//.test(r.headers.get("content-type") || "")) throw new Error("tts");
    if (box) box.put(url, r.clone()).catch(() => {});
  }
  return URL.createObjectURL(await r.blob());
}
/* resolves true when the Twi voice played to the end (or was stopped), false if it could not play */
export async function sayTwi(english, onStart) {
  const me = ++playing;
  const st = await status(); if (!st.tts) return false;
  const [tw] = await translate([english.trim()], "tw"); if (!tw || me !== playing) return me !== playing;
  const parts = chunks(tw, T().tts_chars);
  try {
    let next = clip(parts[0]);
    for (let i = 0; i < parts.length; i++) {
      const src = await next; if (me !== playing) return true;
      if (i + 1 < parts.length) next = clip(parts[i + 1]);
      if (i === 0 && onStart) onStart();
      await new Promise((ok, bad) => { audio = new Audio(src); audio.onended = () => { URL.revokeObjectURL(src); ok(); }; audio.onerror = bad; audio.play().catch(bad); });
    }
    return true;
  } catch { return me !== playing; }
}

/* ---------- Talk in Twi: record, make a small 16 kHz mono WAV on the phone, Khaya writes it down ---------- */
let rec = null;
export const recording = () => !!rec;
export async function startRecording(onAuto) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const mr = new MediaRecorder(stream), bits = [];
  mr.ondataavailable = (e) => { if (e.data && e.data.size) bits.push(e.data); };
  const done = new Promise((ok) => { mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); ok(new Blob(bits, { type: mr.mimeType || "audio/webm" })); }; });
  const auto = setTimeout(() => { if (rec && rec.mr === mr) onAuto && onAuto(); }, T().asr_max_s * 1000);
  rec = { mr, done, auto }; mr.start();
}
export async function stopRecording() {
  if (!rec) return null;
  const { mr, done, auto } = rec; rec = null; clearTimeout(auto);
  if (mr.state !== "inactive") mr.stop();
  return done;
}
async function toWav(blob) {
  const AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
  const buf = await new Promise((ok, bad) => { blob.arrayBuffer().then((ab) => { const p = ac.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(bad); }, bad); });
  ac.close && ac.close();
  const rate = 16000, len = Math.ceil(buf.duration * rate), off = new OfflineAudioContext(1, Math.max(1, len), rate);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0), out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const s = (o, t) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); out.setUint32(4, 36 + pcm.length * 2, true); s(8, "WAVE"); s(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); s(36, "data"); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return { wav: new Blob([out], { type: "audio/wav" }), seconds: buf.duration };
}
const b64 = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = bad; r.readAsDataURL(blob); });
/* the recording -> Twi words (throws an Error with a plain message) */
export async function transcribe(blob, signal) {
  let w;
  try { w = await toWav(blob); } catch { throw new Error("Walo could not read that recording. Try again, or type."); }
  if (w.seconds < 0.6) throw new Error("Walo did not hear anything. Tap the microphone and talk.");
  const r = await fetch(`${T().endpoint}?action=asr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: await b64(w.wav) }), signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || "Twi listening did not work. Try again, or type.");
  if (!j.text) throw new Error("Walo did not hear anything. Tap the microphone and talk.");
  return j.text;
}
