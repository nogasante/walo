/*
 * Walo Twi: GhanaNLP Khaya (machine translation, speech and speech recognition), behind our server so the key never reaches the phone.
 *   GET  /api/twi?action=status                  -> { ok, translate, tts, asr }  (no call to Khaya)
 *   POST /api/twi?action=translate {texts:[..], to:"tw"|"en"} -> { ok, out:[..] }   en-tw (or tw-en for what the farmer said)
 *   GET  /api/twi?action=tts&text=<Twi>         -> audio/wav (cached by the CDN: the same words never cost twice)
 *   POST /api/twi?action=asr {audio:"<base64 16 kHz mono WAV>"} -> { ok, text }
 * The key is read from process.env.KHAYA_API_KEY. Nothing the farmer types or says is logged.
 * Twi from here is machine output and needs a Twi speaker's check (see AI_USE.md).
 */
"use strict";

const BASE = "https://translation-api.ghananlp.org";
const ON = require("../data/app.json").languages.enabled.includes("tw"); // English only for now: the whole route answers 404 until "tw" is enabled
const KEY = () => process.env.KHAYA_API_KEY || "";
const LIM = { texts: 40, chars: 500, total: 8000, tts_chars: 400, audio_b64: 1_400_000 }; // ~30 s of 16 kHz mono WAV; under Vercel's 4.5 MB body limit
const TIMEOUT = { translate: 15000, tts: 25000, asr: 55000 };
const SPEAKER = "female"; // Khaya TTS v1 speakers: male_low, male_high, female
const RATE = { windowMs: 10 * 60 * 1000, translate: 600, tts: 60, asr: 12 }; // per IP, per warm instance, best effort
const hits = new Map();
const cache = new Map(); // translation cache, per warm instance
const CACHE_MAX = 4000;
let restUntil = 0; // Khaya said "out of quota": stop calling it for a while (per warm instance)

function limited(ip, kind) {
  const now = Date.now(), k = kind + "|" + ip, a = (hits.get(k) || []).filter((t) => t > now - RATE.windowMs);
  if (a.length >= RATE[kind]) { hits.set(k, a); return true; }
  a.push(now); hits.set(k, a); if (hits.size > 5000) hits.clear();
  return false;
}
async function call(path, opts, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(BASE + path, { ...opts, signal: ctl.signal, headers: { "Ocp-Apim-Subscription-Key": KEY(), ...(opts.headers || {}) } });
    if (r.status === 403 || r.status === 429) restUntil = Date.now() + Math.min(3600, Math.max(60, +r.headers.get("retry-after") || 600)) * 1000;
    return r;
  } finally { clearTimeout(t); }
}
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
async function translateOne(text, pair) {
  const k = pair + "|" + text;
  if (cache.has(k)) return cache.get(k);
  const r = await call("/v2/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ in: text, lang: pair }) }, TIMEOUT.translate);
  if (!r.ok) { const e = new Error("translate " + r.status); e.status = r.status; throw e; }
  let out = await r.json();
  out = clean(typeof out === "string" ? out : out && (out.out || out.translation || out.text));
  if (!out) throw new Error("empty");
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(k, out);
  return out;
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]); } }));
  return out;
}
async function readJson(req, max) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > max) { const e = new Error("too big"); e.status = 413; throw e; } }
  return JSON.parse(raw || "{}");
}
const send = (res, code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj)); };
const quotaMsg = (s) => (s === 429 || s === 403 ? "Twi is resting now (too many requests). Try again later." : "Twi did not work. Try again.");

module.exports = async (req, res) => {
  if (!ON) { res.statusCode = 404; res.setHeader("Cache-Control", "no-store"); return res.end(); }
  const url = new URL(req.url, "http://x"), action = url.searchParams.get("action") || "";
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (action === "status") return send(res, 200, { ok: true, translate: !!KEY(), tts: !!KEY(), asr: !!KEY() });
  if (!KEY()) return send(res, 503, { ok: false, error: "Twi is not set up on this server." });
  if (Date.now() < restUntil) return send(res, 503, { ok: false, resting: true, error: quotaMsg(429) });
  try {
    if (action === "translate") {
      if (req.method !== "POST") return send(res, 405, { ok: false });
      if (limited(ip, "translate")) return send(res, 429, { ok: false, error: quotaMsg(429) });
      const j = await readJson(req, 64000), to = j.to === "en" ? "en" : "tw", pair = to === "en" ? "tw-en" : "en-tw";
      const texts = Array.isArray(j.texts) ? j.texts.slice(0, LIM.texts).map((t) => clean(t).slice(0, LIM.chars)) : [];
      if (!texts.length || texts.join("").length > LIM.total) return send(res, 400, { ok: false, error: "Nothing to translate." });
      let fail = 0;
      const out = await pool(texts, 6, async (t) => { if (!/\p{L}/u.test(t)) return t; try { return await translateOne(t, pair); } catch (e) { fail = e.status || fail || 502; return null; } });
      if (out.every((x, i) => x === null && /\p{L}/u.test(texts[i]))) return send(res, 502, { ok: false, resting: fail === 403 || fail === 429, error: quotaMsg(fail) });
      return send(res, 200, { ok: true, out });
    }
    if (action === "tts") {
      if (req.method !== "GET") return send(res, 405, { ok: false });
      const text = clean(url.searchParams.get("text")).slice(0, LIM.tts_chars);
      if (!/\p{L}/u.test(text)) return send(res, 400, { ok: false, error: "Nothing to say." });
      if (limited(ip, "tts")) return send(res, 429, { ok: false, error: quotaMsg(429) });
      const r = await call("/tts/v1/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: "tw", speaker_id: SPEAKER }) }, TIMEOUT.tts);
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !/^audio\//.test(type)) return send(res, 502, { ok: false, error: quotaMsg(r.status) });
      const buf = Buffer.from(await r.arrayBuffer());
      res.statusCode = 200; res.setHeader("Content-Type", type); res.setHeader("Content-Length", buf.length);
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable"); // same words, same audio
      return res.end(buf);
    }
    if (action === "asr") {
      if (req.method !== "POST") return send(res, 405, { ok: false });
      if (limited(ip, "asr")) return send(res, 429, { ok: false, error: quotaMsg(429) });
      const j = await readJson(req, LIM.audio_b64 + 1000), b64 = typeof j.audio === "string" ? j.audio : "";
      if (!b64 || b64.length > LIM.audio_b64) return send(res, 413, { ok: false, error: "Talk a little shorter (up to 30 seconds)." });
      const wav = Buffer.from(b64, "base64");
      if (wav.slice(0, 4).toString() !== "RIFF" || wav.slice(8, 12).toString() !== "WAVE") return send(res, 400, { ok: false, error: "Walo could not read that recording." });
      const r = await call("/asr/v3/transcribe?language=twi", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav }, TIMEOUT.asr);
      if (!r.ok) return send(res, 502, { ok: false, error: quotaMsg(r.status) });
      const out = await r.json().catch(() => null), text = clean(typeof out === "string" ? out : out && out.text);
      return send(res, 200, { ok: true, text });
    }
    return send(res, 400, { ok: false, error: "Unknown action." });
  } catch (e) {
    if (e.status === 413) return send(res, 413, { ok: false, error: "Too long." });
    return send(res, e.name === "AbortError" ? 504 : 502, { ok: false, error: e.name === "AbortError" ? "Twi took too long. Try again." : "Twi did not work. Try again." });
  }
};
