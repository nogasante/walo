/*
 * Walɔ Plant Doctor: POST /api/diagnose
 * In:  { mode: "doctor" | "stage", crop, crop_name, days_since_sowing, season_days, expected_stage, place, lat, lon,
 *        climatology: { month, rain_mm, tmax_c, hot_days } (bundled NASA POWER monthly, used if the live call fails),
 *        images: [{ role: "leaf" | "plant" | "field" | "diary", mime, data: "<base64>" }] (0-3; JPEG resized on the phone, or a small original incl. HEIC),
 *        words: "what the farmer said or typed" (optional), followup: { question, answer } (the one question the AI may ask) }
 *      At least one photo or some words.
 * Out: { ok, result: {...strict JSON from Gemini...}, weather: {...NASA POWER chips...}, model, ai_generated: true }
 * The Gemini key is read from process.env.GEMINI_API_KEY on the server only.
 */
"use strict";

const RULES = require("../data/rules.json"); // hot-day line shared with the app (data/rules.json heat.hot_day_c)
const HOT_C = RULES.heat.hot_day_c;
const { gemini: geminiCall } = require("./_gemini.js"); // model choice and fallbacks, shared with /api/help
const { takeAiHit } = require("./_budget.js"); // daily cap shared with /api/help (supabase/schema.sql)
const { inCountry, countryAt } = require("./_country.js"); // accepted coordinates and the country name come from data/countries.json
const BUDGET_MS = 38000; // all model attempts together; the phone gives up at 45 s (data/app.json plant_doctor.timeout_ms)
const MAX_IMAGES = 3, MAX_IMG_B64 = 3_400_000, MAX_TOTAL_B64 = 3_600_000, MAX_WORDS = 600; // one original photo up to ~2.4 MB; all under Vercel's 4.5 MB body limit
const MIMES = /^image\/(jpeg|png|webp|heic|heif)$/; // types Gemini reads
const RATE = { windowMs: 10 * 60 * 1000, perIp: 8, global: 120 }; // best effort, per warm instance
const hits = new Map(); let globalHits = [];

function rateLimited(ip) {
  const now = Date.now(), cut = now - RATE.windowMs;
  globalHits = globalHits.filter((t) => t > cut);
  const mine = (hits.get(ip) || []).filter((t) => t > cut);
  if (mine.length >= RATE.perIp || globalHits.length >= RATE.global) { hits.set(ip, mine); return Math.ceil((Math.min(...(mine.length ? mine : globalHits)) + RATE.windowMs - now) / 1000); }
  mine.push(now); globalHits.push(now); hits.set(ip, mine);
  if (hits.size > 5000) hits.clear();
  return 0;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const r1 = (x) => Math.round(x * 10) / 10;

async function nasaRecent(lat, lon) {
  // NASA POWER daily (AG community). Latest days often lag a few days and come back as -999: keep the last 14 valid days.
  const end = new Date(Date.now() - 864e5), start = new Date(end.getTime() - 24 * 864e5);
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX,RH2M,GWETROOT&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000); // short: the photo answer matters more than live weather
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("POWER " + r.status);
    const p = (await r.json()).properties.parameter;
    const days = Object.keys(p.PRECTOTCORR).sort().filter((d) => [p.PRECTOTCORR, p.T2M_MAX, p.RH2M].every((s) => s[d] != null && s[d] > -900)).slice(-14);
    if (days.length < 5) throw new Error("too few valid days");
    const v = (k) => days.map((d) => p[k][d]).filter((x) => x != null && x > -900);
    const rain = v("PRECTOTCORR"), tmax = v("T2M_MAX"), rh = v("RH2M"), gw = v("GWETROOT");
    const sum = (a) => a.reduce((s, x) => s + x, 0), avg = (a) => (a.length ? sum(a) / a.length : null);
    const fmtD = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    return {
      source: "nasa_power_daily", days: days.length, from: fmtD(days[0]), to: fmtD(days[days.length - 1]),
      rain_mm: r1(sum(rain)), rain_days: rain.filter((x) => x >= 1).length, wettest_day_mm: r1(Math.max(...rain)),
      tmax_avg_c: r1(avg(tmax)), tmax_peak_c: r1(Math.max(...tmax)), hot_days: tmax.filter((x) => x > HOT_C).length,
      rh_avg: Math.round(avg(rh)), soil_wetness: gw.length ? Math.round(gw[gw.length - 1] * 100) / 100 : null,
      url: url.replace(/&format=JSON$/, "&format=JSON"),
    };
  } finally { clearTimeout(t); }
}

function climFallback(c) {
  if (!c || typeof c !== "object") return null;
  const n = (x) => (typeof x === "number" && isFinite(x) ? x : null);
  return { source: "nasa_power_climatology", month: String(c.month || "").slice(0, 12), rain_mm_month: n(c.rain_mm), tmax_avg_c: n(c.tmax_c), hot_days_month: n(c.hot_days), soil_wetness: null, period: String(c.period || "").slice(0, 20) };
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    ask_question: { type: "STRING", description: "only when there is no photo and the farmer's words are too unclear to name a likely cause: ONE short, plain question; else empty" },
    image_quality_ok: { type: "BOOLEAN", description: "false if the photos are too blurry, dark, far or off-subject to judge the plant; true when there is no photo" },
    retake_instructions: { type: "STRING", description: "if image_quality_ok is false: one short, exact instruction for a better photo; else empty" },
    crop_matches: { type: "BOOLEAN", description: "false if the photo clearly shows a different crop than the one named" },
    looks_like: { type: "ARRAY", items: { type: "STRING" }, description: "when crop_matches is false: 1-2 plain crop names the photo actually looks like, e.g. ['garden egg','pepper']; empty otherwise" },
    likely_issue: { type: "STRING", description: "short name, e.g. 'Fall armyworm', 'Northern leaf blight', 'Drought stress', 'Looks healthy'" },
    issue_type: { type: "STRING", enum: ["pest", "disease", "nutrient", "water_stress", "heat_stress", "weeds", "healthy", "unclear"] },
    confidence: { type: "STRING", enum: ["low", "med", "high"] },
    why: { type: "STRING", description: "1-2 plain sentences: which signs in the photos or words point to this cause" },
    today_action: { type: "STRING", description: "ONE plain, safe, low-cost step the farmer can do today" },
    growth_stage_observed: { type: "STRING" },
    growth_stage_expected: { type: "STRING" },
    stage_match: { type: "STRING", enum: ["on_track", "behind", "ahead", "unclear"] },
    harvest_readiness: { type: "STRING", enum: ["not_yet", "soon", "ready", "past", "unclear"] },
    harvest_note: { type: "STRING", description: "one short line on harvest timing from the photo + days since sowing" },
    signs_seen: { type: "ARRAY", items: { type: "STRING" }, description: "up to 4 short visible symptoms" },
    other_possibilities: { type: "ARRAY", items: { type: "STRING" }, description: "up to 2 other causes to rule out" },
    watch_next: { type: "STRING", description: "what to check in the next 3-7 days" },
    need_more: { type: "STRING", enum: ["none", "leaf_closeup", "whole_plant", "field", "leaf_underside", "stem_or_root"], description: "one more photo that would clearly raise confidence, or none" },
    next_photo_tip: { type: "STRING", description: "if need_more is not none: one short instruction for that photo; else empty" },
  },
  required: ["ask_question", "image_quality_ok", "retake_instructions", "crop_matches", "looks_like", "likely_issue", "issue_type", "confidence", "why", "today_action", "growth_stage_observed", "growth_stage_expected", "stage_match", "harvest_readiness", "harvest_note", "signs_seen", "other_possibilities", "watch_next", "need_more", "next_photo_tip"],
  propertyOrdering: ["ask_question", "image_quality_ok", "retake_instructions", "crop_matches", "looks_like", "likely_issue", "issue_type", "confidence", "why", "today_action", "growth_stage_observed", "growth_stage_expected", "stage_match", "harvest_readiness", "harvest_note", "signs_seen", "other_possibilities", "watch_next", "need_more", "next_photo_tip"],
};

const ROLE_TEXT = { leaf: "Photo: close-up of a leaf", plant: "Photo: the whole plant", field: "Photo: wide view of the field", diary: "Photo: from the farmer's diary" };

function prompt(b, wx, nImg) {
  const w = wx.source === "nasa_power_daily"
    ? `NASA POWER daily at this farm, ${wx.from} to ${wx.to} (${wx.days} days): rain ${wx.rain_mm} mm on ${wx.rain_days} days (wettest day ${wx.wettest_day_mm} mm); max temperature avg ${wx.tmax_avg_c} °C, peak ${wx.tmax_peak_c} °C, ${wx.hot_days} days above ${HOT_C} °C; relative humidity avg ${wx.rh_avg}%; root-zone soil wetness ${wx.soil_wetness} (0 = dry, 1 = saturated).`
    : wx.source === "nasa_power_climatology"
      ? `Live NASA data was unavailable. NASA POWER long-term average for ${wx.month} here: ${wx.rain_mm_month} mm rain in the month, avg max ${wx.tmax_avg_c} °C, ${wx.hot_days_month} days above ${HOT_C} °C, Treat this as the usual weather, not this year's.`
      : "No weather data available.";
  const said = b.words ? `The farmer says (spoken or typed, may have spelling or speech-to-text mistakes): "${b.words}"` : "";
  const fu = b.followup ? `You asked: "${b.followup.question}". The farmer answered: "${b.followup.answer || "(no answer)"}". Do not ask another question now; give your best answer.` : "";
  const input = nImg && b.words ? "Look at the photos, read what the farmer says" : nImg ? "Look at the photos" : "There is NO photo. Read what the farmer says";
  return `You are Walɔ's Plant Doctor, helping a smallholder farmer in ${countryAt(b.lat, b.lon).name}. ${input}, then answer in the JSON schema. The weather below is background only: it cannot show a disease by itself.
${said}
${fu}
Crop (as told by the farmer): ${b.crop_name}. Place: ${b.place} (${b.lat.toFixed(2)}, ${b.lon.toFixed(2)}).
${b.days_since_sowing != null ? `Days since sowing: ${b.days_since_sowing} of a typical ${b.season_days}-day season. Expected stage now: ${b.expected_stage}.` : "Sowing date unknown."}
${w}
${b.mode === "stage" ? "Main task: compare the growth stage in the photo with the expected stage, and say if the crop is on track and how close it is to harvest. Still flag any obvious pest, disease or stress." : "Main task: find the most likely problem (pest, disease, nutrient, water or heat stress), or say it looks healthy."}
Rules:
${nImg ? "" : `- No photo: set image_quality_ok=true, crop_matches=true, retake_instructions="". Judge from the words; use confidence "low" or "med" unless the words are very specific. ${b.followup ? "ask_question must be empty." : "If the words are too unclear to name any likely cause, set ask_question to ONE short plain question (e.g. \"Are the holes in the leaves, or is the leaf turning yellow?\") and keep the other fields short; otherwise ask_question is empty."} If a photo would clearly help, set need_more to the view to photograph.`}
${nImg ? "- ask_question must be empty (there is a photo)." : ""}
- Crop check: the farmer says this is ${b.crop_name}. If a photo clearly shows a different crop, set crop_matches=false and put in looks_like the 1-2 plain crop names you can actually see (e.g. ["garden egg","pepper"]), using names farmers here use and only crops that grow in this country. Never guess a crop you cannot see: if you are unsure, keep crop_matches=true. When crop_matches is true, looks_like must be empty.
- First judge photo quality (only if there is a photo). If blur, darkness, distance, glare or the subject makes a judgement unreliable, set image_quality_ok=false and give ONE exact retake instruction (e.g. "Move closer so one leaf fills the photo, in daylight, and hold still"). Then keep other fields short with "unclear" where needed.
- Only use what you can see in the photos or what the farmer says. Do not invent symptoms. If unsure, use confidence "low" and say what would confirm it.
- "why" names the signs that point to the cause. Base the answer on the signs, never on the weather alone. Mention the weather only if it clearly supports what is seen (e.g. "it has been very dry"), in a few plain words with no numbers.
- today_action: one plain, safe, low-cost step (e.g. hand-pick and crush larvae, remove badly infected leaves, mulch, water at the base in the evening). Do not name brand chemicals or doses. If a pesticide is truly needed, say "ask the agro-shop for a product approved for <pest> on <crop> and follow the label".
- likely_issue: 2-4 plain words a farmer knows (e.g. "Fall armyworm", "Leaf blight", "Too little water", "Looks healthy").
- If one more photo (a different view from those sent) would clearly change or confirm the answer, set need_more to that view and next_photo_tip to one exact instruction; otherwise need_more = "none". Ask for more only when confidence is not high.
- Always give your best answer yourself. Never tell the farmer to ask an extension officer, an expert or someone else for the diagnosis.
- Use short, simple English (a farmer will hear it read aloud).`;
}

function clean(o) {
  const s = (x, n = 300) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  const e = (x, ok, d) => (ok.includes(x) ? x : d);
  const a = (x, k, n) => (Array.isArray(x) ? x.map((y) => s(y, n)).filter(Boolean).slice(0, k) : []);
  return {
    ask_question: s(o.ask_question, 160),
    image_quality_ok: o.image_quality_ok !== false, retake_instructions: s(o.retake_instructions, 240), crop_matches: o.crop_matches !== false,
    looks_like: o.crop_matches === false ? a(o.looks_like, 2, 40) : [],
    likely_issue: s(o.likely_issue, 80) || "Unclear", issue_type: e(o.issue_type, SCHEMA.properties.issue_type.enum, "unclear"),
    confidence: e(o.confidence, ["low", "med", "high"], "low"), why: s(o.why, 420), today_action: s(o.today_action, 240),
    growth_stage_observed: s(o.growth_stage_observed, 80), growth_stage_expected: s(o.growth_stage_expected, 80),
    stage_match: e(o.stage_match, ["on_track", "behind", "ahead", "unclear"], "unclear"), harvest_readiness: e(o.harvest_readiness, ["not_yet", "soon", "ready", "past", "unclear"], "unclear"),
    harvest_note: s(o.harvest_note, 200), signs_seen: a(o.signs_seen, 4, 100), other_possibilities: a(o.other_possibilities, 2, 100), watch_next: s(o.watch_next, 200),
    need_more: e(o.need_more, SCHEMA.properties.need_more.enum, "none"), next_photo_tip: s(o.next_photo_tip, 200),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "Use POST" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(503, { ok: false, error: "Plant Doctor is not set up on the server." });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const wait = rateLimited(ip);
  if (wait) { res.setHeader("Retry-After", String(wait)); return send(429, { ok: false, error: `Too many checks. Try again in ${Math.ceil(wait / 60)} min.` }); }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== "object") return send(400, { ok: false, error: "Send JSON" });
  const imgs = Array.isArray(b.images) ? b.images.slice(0, MAX_IMAGES + 1) : [];
  const words = typeof b.words === "string" ? b.words.replace(/\s+/g, " ").trim().slice(0, MAX_WORDS) : "";
  const followup = b.followup && typeof b.followup.question === "string" ? { question: b.followup.question.trim().slice(0, 160), answer: String(b.followup.answer || "").replace(/\s+/g, " ").trim().slice(0, MAX_WORDS) } : null;
  if (imgs.length > MAX_IMAGES) return send(400, { ok: false, error: "Send up to 3 photos" });
  if (!imgs.length && !words && !(followup && followup.answer)) return send(400, { ok: false, error: "Take a photo, or say what you see on the plant." });
  let total = 0;
  for (const im of imgs) {
    if (!im || typeof im.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(im.data.slice(0, 200))) return send(400, { ok: false, error: "Bad photo data" });
    if (im.data.length > MAX_IMG_B64) return send(413, { ok: false, error: "That photo is too big. Take it again, or choose a smaller photo." });
    total += im.data.length;
  }
  if (total > MAX_TOTAL_B64) return send(413, { ok: false, error: "The photos are too big together. Start a new check." });
  // no photo or words are logged: only counts, sizes and types, so failures on real phones can be traced
  console.log(JSON.stringify({ ev: "diagnose", photos: imgs.length, kb: Math.round(total * 0.75 / 1024), types: imgs.map((im) => im.mime || "?"), words: words.length, followup: !!followup }));
  const lat = Number(b.lat), lon = Number(b.lon);
  if (!inCountry(lat, lon)) return send(400, { ok: false, error: "Location outside the area Walɔ covers" });
  // Daily cap across every server instance (supabase/schema.sql -> walo_ai_hit). Null means the SQL is not
  // applied yet, or Supabase is down: the per-IP limit above still applies and Walɔ keeps answering.
  const budget = await takeAiHit();
  if (budget && !budget.allowed) {
    console.log(JSON.stringify({ ev: "diagnose_budget", used: budget.used, cap: budget.cap }));
    res.setHeader("Retry-After", "3600");
    return send(429, { ok: false, error: "Walɔ has done a lot of checks today. Try again tomorrow." });
  }
  const body = {
    mode: b.mode === "stage" ? "stage" : "doctor", lat, lon,
    crop_name: String(b.crop_name || b.crop || "crop").slice(0, 40), place: String(b.place || countryAt(lat, lon).name).slice(0, 60),
    days_since_sowing: Number.isFinite(+b.days_since_sowing) && b.days_since_sowing !== null ? Math.round(+b.days_since_sowing) : null,
    season_days: Number.isFinite(+b.season_days) ? Math.round(+b.season_days) : null, expected_stage: String(b.expected_stage || "unknown").slice(0, 40),
    words, followup,
  };

  let weather;
  try { weather = await nasaRecent(lat, lon); } catch (e) { weather = climFallback(b.climatology) || { source: "none" }; weather.note = "Live NASA POWER daily data was slow or unavailable; used the usual weather for this month."; }

  const parts = [{ text: prompt(body, weather, imgs.length) }];
  imgs.forEach((im, i) => { parts.push({ text: ROLE_TEXT[im.role] || `Photo ${i + 1}` }); parts.push({ inline_data: { mime_type: MIMES.test(im.mime || "") ? im.mime : "image/jpeg", data: im.data } }); });

  try {
    const g = await geminiCall(key, parts, { schema: SCHEMA, budgetMs: BUDGET_MS }), result = clean(g.data);
    if (imgs.length || followup) result.ask_question = ""; // at most one question, and only without a photo
    if (!imgs.length) { result.image_quality_ok = true; result.crop_matches = true; result.looks_like = []; }
    const { url, ...wx } = weather;
    return send(200, { ok: true, ai_generated: true, model: g.model, result, weather: { ...wx, source_url: url || null }, checked_at: new Date().toISOString() });
  } catch (e) {
    console.error("diagnose failed:", e && e.message);
    const { url, ...wx } = weather;
    return send(502, { ok: false, error: "The AI could not answer right now. Try again in a minute.", weather: wx, tried: (e && e.tried) || [] });
  }
};
