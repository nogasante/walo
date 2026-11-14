/* Plant Doctor: the farmer shows (photo), says (Talk) or writes (Type) what is wrong; the AI (Gemini, on our server)
   answers from what it sees and reads (the server adds recent weather to its notes quietly; the screen makes no weather claim). With words only it may ask one short question first. Every answer says "AI answer". */
import { place, farm, focusCrop, setCrop } from "../store.js";
import { takePhotos, preparePhoto, toBase64, lostPhoto, showable, galleryButton, cameraButton, photoLabel } from "../photo.js";
import { crop, farmProgress, agroOf, CFG, R } from "../data.js";
import { answer, whyBody, btn, note, icon, cropImg, hero } from "../ui.js";
import { esc, fmt, dayMonth, fromIso, MONTHS_LONG } from "../util.js";
import { openCropPicker } from "./pickers.js";
import { online } from "../net.js";
import { isTwi, asrReady, status as twiStatus, startRecording, stopRecording, recording, transcribe, translate } from "../twi.js";

const VIEW = { leaf_closeup: "one sick leaf, close up", whole_plant: "the whole plant", field: "the field from the edge", leaf_underside: "the underside of a sick leaf", stem_or_root: "the stem near the ground" };
const CONF = { high: "Likely", med: "Maybe: the AI is not fully sure", low: "Not sure: the AI cannot tell well" };
const STEPS = { photo: ["Sending your photo", "Looking at the plant", "Writing the answer"], words: ["Sending your words", "Thinking about your plant", "Writing the answer"] };
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
/* Talk: in Twi, Khaya listening (record, then the server writes it down); in English, the browser's own speech recognition */
const canTalk = () => (isTwi() ? asrReady() : !!SR);

let S = { key: "" }, CUR = null; // CUR: the screen that is showing now (crop, field, re-render)
const fresh = (key) => ({ key, phase: "start", shots: [], words: "", ask: null, reply: "", res: null, err: "", step: 0, ctl: null, timers: [], listening: false, writing: false });

export const title = () => "Plant Doctor";
function ctx(id, farmId) {
  const f = farmId ? farm(farmId) : null, pr = f ? farmProgress(f) : null, p = pr ? pr.p : place(), c = crop(id);
  return { f, pr, p, c };
}
const thumbs = () => (S.shots.length ? `<div class="shot-strip">${S.shots.map((s) => (s.url ? `<img src="${s.url}" alt="Your photo" onerror="this.style.visibility='hidden'">` : `<span class="shot-ph">${icon("image")}</span>`)).join("")}</div>` : "");
const said = () => [S.words, S.ask && S.reply ? `${S.ask}: ${S.reply}` : ""].filter(Boolean);
const warn = `<p class="alert">${icon("triangle-alert")}<span>AI answer, can be wrong. Check with someone you trust before spending money.</span></p>`;
const errBox = () => (S.err ? `<p class="alert">${icon("triangle-alert")}<span>${esc(S.err)}</span></p>` : "");
function wordsBox(label, val, ph) {
  return `<div class="card stack">
    <label class="field"><span>${label}</span><textarea id="doc-words" data-notw rows="3" maxlength="${CFG().plant_doctor.max_words_chars}" placeholder="${ph}">${esc(val)}</textarea></label>
    ${S.writing ? `<p class="busy">${icon("loader-circle", "spin")}<span>Writing down your words…</span></p>`
      : canTalk() ? `<button type="button" class="micbtn${S.listening ? " on" : ""}" id="doc-mic" data-net aria-label="${S.listening ? "Stop listening" : "Talk"}">${icon(S.listening ? "square" : "mic")}<span>${S.listening ? "Listening… tap to stop" : isTwi() ? "Tap and talk in Twi" : "Tap and talk"}</span></button>` : note("Talking does not work in this browser. Type instead.", "keyboard")}
    ${btn("Check my plant", { ic: "send", attrs: 'id="doc-send" data-net' })}
  </div>`;
}
export function render(id, farmId) {
  id = crop(id) ? id : focusCrop(); setCrop(id);
  const { f, pr, p, c } = ctx(id, farmId), key = `${id}|${farmId || ""}|${p.id}`;
  if (S.key !== key) { stop(); S = fresh(key); S.err = lostPhoto("doctor"); }
  const chip = f ? "" : `<button type="button" class="cropchip" id="change-crop">${cropImg(c, "chip-img")}<span>Another crop</span>${icon("chevron-down")}</button>`;
  let body;
  if (S.phase === "reading") {
    body = `<div class="card stack">${thumbs()}<p class="busy">${icon("loader-circle", "spin")}<span>Looking at your photo…</span></p></div>`;
  } else if (S.phase === "loading") {
    const steps = STEPS[S.shots.length ? "photo" : "words"];
    body = `<div class="card stack">${thumbs()}${said().length ? `<p class="said" data-notw>${icon("message-circle-question")}<span>“${esc(said().join(" · "))}”</span></p>` : ""}
      <ol class="progress" aria-live="polite">${steps.map((t, i) => `<li class="${i < S.step ? "done" : i === S.step ? "now" : ""}">${icon(i < S.step ? "circle-check" : i === S.step ? "loader-circle" : "clock", i === S.step ? "spin" : "")}<span>${t}</span></li>`).join("")}</ol>
      ${btn("Cancel", { kind: "secondary", ic: "x", attrs: 'id="doc-cancel"' })}</div>`;
  } else if (S.phase === "ask") {
    body = `${answer({ kind: "wait", icon: "message-circle-question", tone: "wait", title: esc(S.ask), sub: "One question, so the answer fits your plant.", say: S.ask, credit: "AI answer" })}
      ${errBox()}${wordsBox("Your answer", S.reply, "Say or type your answer")}
      ${cameraButton("doctor", "Take a photo instead", { kind: "secondary", attrs: "data-net" })}`;
  } else if (S.phase === "words") {
    body = `${errBox()}${thumbs()}${wordsBox("What do you see on your plant?", S.words, `For example: holes in the leaves and small worms inside`)}
      ${S.shots.length ? "" : cameraButton("doctor", "Add a photo too", { kind: "secondary", attrs: "data-net" })}
      ${btn("Back", { kind: "secondary", ic: "chevron-left", attrs: 'id="doc-back"' })}`;
  } else if (S.phase === "result") {
    const r = S.res.result, hasPhoto = S.shots.length > 0;
    if (hasPhoto && (!r.image_quality_ok || !r.crop_matches)) {
      const msg = !r.image_quality_ok ? r.retake_instructions || "Move closer so one leaf fills the photo, in daylight, and hold still." : `Take a photo of your ${c.name.toLowerCase()} plant.`;
      body = `${answer({ kind: "wait", icon: "camera", title: !r.image_quality_ok ? "Need a clearer photo" : `This does not look like ${esc(c.name.toLowerCase())}`, sub: esc(msg), say: msg, credit: "AI answer" })}
        ${cameraButton("doctor", "Take photo again", { attrs: "data-net" })}${btn("New check", { kind: "secondary", ic: "refresh-cw", attrs: 'id="doc-new"' })}`;
    } else {
      const more = r.need_more !== "none" && S.shots.length < 3 && r.confidence !== "high";
      const say = `${r.likely_issue}. ${CONF[r.confidence]}. Today: ${r.today_action}. This is an AI answer and can be wrong.`;
      body = `${answer({ kind: r.issue_type === "healthy" ? "now" : "info", icon: r.issue_type === "healthy" ? "circle-check" : "stethoscope", tone: r.issue_type === "healthy" ? "good" : "wait", title: esc(r.likely_issue), sub: CONF[r.confidence], why: { title: "Why this answer", html: whyHtml(r, S.res, p, pr) }, say, credit: "AI answer" })}
        ${r.today_action ? `<div class="task">${icon("circle-check")}<div><small>Today</small><b>${esc(r.today_action)}</b></div></div>` : ""}
        ${warn}
        ${more ? `<div class="ask">${icon("camera")}<div><b>To be surer, ${hasPhoto ? "add" : "take"} a photo of ${VIEW[r.need_more] || "another part of the plant"}.</b>${r.next_photo_tip ? `<small>${esc(r.next_photo_tip)}</small>` : ""}</div></div>${cameraButton("doctor", hasPhoto ? "Add photo" : "Take photo", { attrs: "data-net" })}` : ""}
        ${btn("New check", { kind: more ? "secondary" : "primary", ic: "refresh-cw", attrs: 'id="doc-new"' })}`;
    }
  } else {
    body = `${errBox()}
      <div class="card stack"><p class="doc-q">Show or tell what is wrong with your ${esc(c.name.toLowerCase())}</p>
      <div class="choices${canTalk() ? "" : " two"}">
        ${photoLabel("camera", "doctor", `<span class="tile-ic photo">${icon("camera")}</span><b>Take photo</b><small>Of the sick leaf</small>`, { cls: "choice", attrs: "data-net" })}
        ${canTalk() ? `<button type="button" class="choice" id="doc-talk" data-net><span class="tile-ic talk">${icon("mic")}</span><b>Talk</b><small>Say what you see</small></button>` : ""}
        <button type="button" class="choice" id="doc-type"><span class="tile-ic type">${icon("keyboard")}</span><b>Type</b><small>Write what you see</small></button>
      </div>
      ${canTalk() ? "" : note("Talking does not work in this browser. Type instead.", "keyboard")}
      ${galleryButton("doctor", "data-net")}</div>
      ${note("Your photo and words are sent once for the check and not kept.")}
      ${warn}`;
  }
  if (!online() && !["loading", "reading"].includes(S.phase)) body = `<p class="alert">${icon("wifi-off")}<span>Plant Doctor needs internet. You are offline now.</span></p>${body}`;
  return `${hero({ img: c.img, pos: c.pos || "50% 50%", eyeIcon: "stethoscope", eyebrow: f ? `${esc(f.name)} · ${esc(c.name)}` : esc(c.name), title: "Plant Doctor" })}
  <div class="stack lift">${body}${["loading", "reading"].includes(S.phase) ? "" : chip}</div>`;
}
function whyHtml(r, res, p, pr) {
    return whyBody([esc(r.why)].filter(Boolean), [
    said().length ? `You said: <span data-notw>“${said().map(esc).join(" · ")}”</span>` : "",
    r.signs_seen.length ? `Signs ${S.shots.length ? "in the photo" : "you described"}: ${r.signs_seen.map(esc).join("; ")}.` : "",
    r.other_possibilities.length ? `Also possible: ${r.other_possibilities.map(esc).join("; ")}.` : "",
    r.watch_next ? `Watch next: ${esc(r.watch_next)}` : "",
    pr && pr.d >= 0 ? `Stage seen: ${esc(r.growth_stage_observed || "unclear")}; expected on day ${pr.d}: ${esc(pr.stages[pr.si].name)}. ${esc(r.harvest_note || "")}` : "",
    `AI answer by Google ${esc(res.model)} from your ${[S.shots.length ? "photo(s)" : "", said().length ? "words" : ""].filter(Boolean).join(" and ")}. It can be wrong.`,
  ].filter(Boolean));
}
function stop() { if (S.ctl) S.ctl.abort(); (S.timers || []).forEach(clearTimeout); if (recording()) stopRecording(); stopListening(); } // leaving: a Twi recording is dropped, not sent
const redraw = () => { if (CUR && location.hash.startsWith("#/doctor")) CUR.rerender(); };

/* ---------- send to /api/diagnose ---------- */
async function run() {
  const { id, farmId } = CUR, { pr, p, c } = ctx(id, farmId), pd = CFG().plant_doctor, m = new Date().getMonth(), cl = agroOf(p).months[m];
  if (!navigator.onLine) { S.phase = S.shots.length ? "start" : "words"; S.err = "You are offline. Plant Doctor needs internet."; redraw(); return; }
  const words = S.words.trim().slice(0, pd.max_words_chars), reply = S.reply.trim().slice(0, pd.max_words_chars);
  let wordsEn = words, replyEn = reply;
  if (isTwi() && (words || reply)) { // the AI reads English best: send Khaya's English with the farmer's own Twi words
    const [w, r2] = await translate([words || " ", reply || " "], "en");
    if (words) wordsEn = w ? `${w} (the farmer's own words in Twi: ${words})` : words;
    if (reply) replyEn = r2 ? `${r2} (in Twi: ${reply})` : reply;
  }
  const body = {
    mode: "doctor", crop: c.id, crop_name: c.name, place: p.kind === "gps" ? "the farmer's location, Ghana" : `${p.name}, ${p.region}`, lat: p.lat, lon: p.lon,
    days_since_sowing: pr && pr.d >= 0 ? pr.d : null, season_days: pr ? pr.days : c.days_typical || null, expected_stage: pr && pr.si >= 0 ? pr.stages[pr.si].name : "unknown",
    climatology: { month: MONTHS_LONG[m], rain_mm: cl.rain_mm, tmax_c: cl.tmax_c, hot_days: cl.hot ? cl.hot[R().heat.hot_day_c] : null },
    images: S.shots.map((s) => ({ role: s.role, mime: s.mime, data: s.data })),
    words: wordsEn.slice(0, 2 * pd.max_words_chars),
    followup: S.ask ? { question: S.ask, answer: replyEn.slice(0, 2 * pd.max_words_chars) } : null,
  };
  S.phase = "loading"; S.err = ""; S.step = 0; S.ctl = new AbortController();
  S.timers = pd.stages_ms.slice(1).map((ms, i) => setTimeout(() => { if (S.phase === "loading") { S.step = i + 1; redraw(); } }, ms));
  S.timers.push(setTimeout(() => S.ctl && S.ctl.abort(), pd.timeout_ms));
  redraw();
  const back = () => { S.phase = S.shots.length || !(S.words || S.ask) ? "start" : S.ask ? "ask" : "words"; };
  try {
    const r = await fetch(pd.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: S.ctl.signal });
    const j = await r.json().catch(() => ({ ok: false, error: r.status === 413 ? "That photo is too big. Take it again, or choose a smaller photo." : "Plant Doctor did not answer well. Try again." }));
    if (!r.ok || !j.ok) throw new Error(j.error || "Plant Doctor is busy. Try again.");
    const q = j.result.ask_question;
    if (q && !S.ask && !S.shots.length) { S.ask = q; S.reply = ""; S.phase = "ask"; }
    else {
      S.res = j; S.phase = "result";
      if (S.shots.length && (!j.result.image_quality_ok || !j.result.crop_matches)) S.shots = []; // start again with a better photo
    }
  } catch (e) {
    back();
    S.err = e.name === "AbortError" ? (S.cancelled ? "" : "That took too long. Try again.") : e.message || "Could not reach Plant Doctor. Try again.";
    if (S.phase === "start") S.shots = [];
  }
  (S.timers || []).forEach(clearTimeout); S.ctl = null; S.cancelled = false;
  redraw();
}

/* ---------- photos (js/photo.js: the one photo path) ---------- */
async function gotPhoto(file) {
  if (!CUR) return;
  const role = S.phase === "result" && S.res && S.res.result.need_more !== "none" ? ({ leaf_closeup: "leaf", whole_plant: "plant", field: "field" }[S.res.result.need_more] || "leaf") : "leaf";
  if (S.phase === "ask" || S.phase === "words") { const t = document.getElementById("doc-words"); if (t) { if (S.phase === "ask") S.reply = t.value; else S.words = t.value; } }
  if (S.phase === "result" && S.res && (!S.res.result.image_quality_ok || !S.res.result.crop_matches)) S.shots = [];
  const shot = { role, url: URL.createObjectURL(file), mime: "image/jpeg", data: "" };
  S.shots.push(shot); S.phase = "reading"; S.err = ""; redraw(); // show the photo at once
  try {
    const pr = await preparePhoto(file, { allowOriginal: true, owner: "doctor" }); // the AI can read a small original HEIC
    URL.revokeObjectURL(shot.url); shot.url = showable(pr.mime) ? URL.createObjectURL(pr.blob) : ""; shot.mime = pr.mime; shot.data = await toBase64(pr.blob);
  } catch (e) {
    S.shots = S.shots.filter((s) => s !== shot); S.phase = S.ask ? "ask" : S.words ? "words" : "start";
    S.err = e.message; redraw(); return;
  }
  run();
}

/* ---------- Talk: the browser's speech recognition (English); the words land in the text box and can be fixed ---------- */
let rec = null;
function stopListening() { if (rec) { try { rec.stop(); } catch { /* */ } } if (recording()) finishTwi(); }
function listen(langIdx = 0) {
  if (isTwi()) { listenTwi(); return; }
  if (!SR) return;
  const langs = CFG().plant_doctor.speech_langs, ta = () => document.getElementById("doc-words");
  const base = ta() ? ta().value.trim() : "";
  const me = new SR(); rec = me; me.lang = langs[langIdx] || "en-US"; me.interimResults = true; me.continuous = false; me.maxAlternatives = 1;
  let final = "", got = false, failed = false;
  me.onresult = (e) => {
    let interim = ""; final = ""; got = true;
    for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (final += e.results[i][0].transcript) : (interim += e.results[i][0].transcript));
    const t = ta(); if (t) t.value = [base, (final + interim).trim()].filter(Boolean).join(" ");
  };
  me.onerror = (e) => {
    failed = true;
    if (e.error === "language-not-supported" && langIdx + 1 < langs.length) { rec = null; listen(langIdx + 1); return; }
    S.err = { "not-allowed": "Walo cannot use the microphone. Allow it in the browser settings, or type instead.", "service-not-allowed": "Talking does not work in this browser. Type instead.", "no-speech": "Walo did not hear anything. Tap the microphone and talk.", network: "Talking needs internet. Type instead.", "audio-capture": "No microphone found. Type instead." }[e.error] || (e.error === "aborted" ? "" : "Talking did not work. Type instead.");
  };
  me.onend = () => {
    if (rec !== me) return; // switched to the next language
    rec = null; S.listening = false;
    if (!got && !failed) S.err = "Walo did not hear anything. Tap the microphone and talk, or type.";
    const t = ta(); if (t) { if (S.phase === "ask") S.reply = t.value; else S.words = t.value; }
    redraw();
  };
  try { me.start(); S.listening = true; S.err = ""; redraw(); } catch { rec = null; S.listening = false; S.err = "Talking did not work. Type instead."; redraw(); }
}

/* Talk in Twi (js/twi.js): record up to data/app.json twi.asr_max_s, then Khaya writes the words into the box */
const keepText = (t) => { if (S.phase === "ask") S.reply = t; else S.words = t; };
async function listenTwi() {
  try { await startRecording(() => finishTwi()); S.listening = true; S.err = ""; }
  catch (e) { S.listening = false; S.err = e && e.name === "NotAllowedError" ? "Walo cannot use the microphone. Allow it in the browser settings, or type instead." : "No microphone found. Type instead."; }
  redraw();
}
async function finishTwi() {
  const t = document.getElementById("doc-words"); if (t) keepText(t.value);
  const blob = await stopRecording(); S.listening = false; if (!blob) { redraw(); return; }
  S.writing = true; redraw();
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), CFG().twi.asr_timeout_ms);
  try {
    const said = await transcribe(blob, ctl.signal), base = (S.phase === "ask" ? S.reply : S.words).trim();
    keepText([base, said].filter(Boolean).join(" "));
  } catch (e) { S.err = e.name === "AbortError" ? "That took too long. Try again, or type." : e.message; }
  clearTimeout(tm); S.writing = false; redraw();
}

export function mount(root, id, farmId, rerender) {
  id = crop(id) ? id : focusCrop(); CUR = { id, farmId, rerender };
  if (isTwi() && !asrReady()) twiStatus().then(() => { if (asrReady() && CUR && CUR.rerender === rerender) rerender(); }); // show Talk once the server says Twi listening works
  const keep = () => { const t = root.querySelector("#doc-words"); if (t) { if (S.phase === "ask") S.reply = t.value; else S.words = t.value; } };
  const cc = root.querySelector("#change-crop");
  if (cc) cc.addEventListener("click", (e) => openCropPicker("doctor", e.currentTarget, (cid) => { location.hash = `#/doctor/${cid}`; }));
  root.querySelectorAll("label[data-photo]").forEach((b) => b.addEventListener("click", () => { keep(); stopListening(); S.err = ""; }));
  takePhotos("doctor", (file) => gotPhoto(file));
  const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener("click", fn); };
  on("#doc-talk", () => { S.phase = "words"; S.err = ""; rerender(); listen(); });
  on("#doc-type", () => { S.phase = "words"; S.err = ""; rerender(); const t = document.getElementById("doc-words"); if (t) t.focus(); });
  on("#doc-mic", () => { keep(); if (S.listening) stopListening(); else listen(); });
  if (S.writing) { const t = root.querySelector("#doc-send"); if (t) t.disabled = true; }
  on("#doc-back", () => { keep(); stopListening(); S.phase = "start"; S.err = ""; S.shots = []; rerender(); });
  on("#doc-send", () => {
    keep(); stopListening();
    const v = (S.phase === "ask" ? S.reply : S.words).trim();
    if (!v && !S.shots.length) { S.err = S.phase === "ask" ? "Say or type your answer first." : "Say or type what you see on the plant first."; rerender(); return; }
    run();
  });
  const ta = root.querySelector("#doc-words");
  if (ta) ta.addEventListener("input", keep);
  on("#doc-cancel", () => { S.cancelled = true; if (S.ctl) S.ctl.abort(); });
  on("#doc-new", () => { stop(); S = fresh(S.key); rerender(); });
}
