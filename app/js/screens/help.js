/* Get help: an AI helper first (Gemini on our server, /api/help, knows Walo and this farmer's place, main crop and fields),
   a person second: when the AI is unsure or the farmer asks for a person, Call and WhatsApp to the team's help line
   (data/app.json support.phone; empty = no person option yet). Talk or type; Listen; Twi when it is on. Nothing is kept on the server. */
import { place, placeLabel, farms, mainCrop } from "../store.js";
import { crop, farmProgress, CFG } from "../data.js";
import { btn, note, icon, speaker } from "../ui.js";
import { esc, roughDate } from "../util.js";
import { online } from "../net.js";
import { isTwi, asrReady, status as twiStatus, startRecording, stopRecording, recording, transcribe, translate } from "../twi.js";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const canTalk = () => (isTwi() ? asrReady() : !!SR);
let S = { msgs: [], draft: "", busy: false, err: "", person: false, listening: false, writing: false, from: "" };
const SC = () => CFG().support;
const hasLine = () => !!(SC().phone || SC().whatsapp);

export const title = () => "Get help";
function context(from) {
  const p = place(), m = mainCrop();
  return {
    place: placeLabel(p) + (p.region ? `, ${p.region}` : ""), main_crop: m ? crop(m).name : "", screen: from || "home",
    fields: farms().slice(0, 6).map((f) => { const pr = farmProgress(f); return { crop: crop(f.crop).name, stage: pr.d < 0 ? "not planted yet" : pr.frac >= 1 ? "ready to harvest" : pr.stages[pr.si].name, harvest: roughDate(pr.harvest) }; }),
  };
}
/* the message a person on the help line gets first (WhatsApp), so the farmer does not have to explain again */
function summary() {
  const c = context(S.from), last = [...S.msgs].reverse().find((m) => m.role === "farmer");
  return [`Walo help request`, `Place: ${c.place}`, c.main_crop ? `Main crop: ${c.main_crop}` : "", c.fields.length ? `Fields: ${c.fields.map((f) => `${f.crop} (${f.stage})`).join(", ")}` : "",
    last ? `Question: ${last.text}${last.en && last.en !== last.text ? ` (English: ${last.en})` : ""}` : ""].filter(Boolean).join("\n");
}
const digits = (x) => String(x || "").replace(/\D/g, "");
function personBox() {
  if (!hasLine()) return note("A help line with a real person is coming soon.", "headset");
  const tel = digits(SC().phone), wa = digits(SC().whatsapp || SC().phone);
  return `<div class="card stack person"><p class="doc-q">${icon("headset")} Talk to a person from the Walo team</p>
    <div class="row2">${tel ? btn("Call", { href: `tel:+${tel}`, ic: "phone" }) : ""}${wa ? btn("WhatsApp", { href: `https://wa.me/${wa}?text=${encodeURIComponent(summary())}`, ic: "message-circle", kind: "secondary", attrs: 'target="_blank" rel="noopener" data-net' }) : ""}</div>
    <small class="muted">WhatsApp opens with a short note about your question, so you do not have to explain again.</small></div>`;
}
function bubble(m) {
  if (m.role === "farmer") return `<div class="msg me" data-notw><p>${esc(m.text)}</p></div>`;
  const go = m.go && CFG() && m.go !== "none" ? GO()[m.go] : null;
  return `<div class="msg ai"><span class="msg-who">${icon("sparkles")}AI answer</span><p>${esc(m.text)}</p>
    <div class="msg-act">${speaker(m.text)}${go ? `<a class="linkbtn" href="${go[1]}">${esc(go[0])}${icon("chevron-right")}</a>` : ""}</div></div>`;
}
let HELP = null;
const GO = () => (HELP ? HELP.go : {});
export function render(from) {
  if (from !== undefined) S.from = from;
  if (!HELP) fetch("data/help.json").then((r) => r.json()).then((j) => { HELP = j; document.dispatchEvent(new Event("walo-refresh")); }).catch(() => {});
  const lastAi = [...S.msgs].reverse().find((m) => m.role === "walo");
  const showPerson = S.person || (lastAi && (lastAi.unsure || lastAi.wants_person));
  return `<div class="stack help">
    ${S.msgs.length ? "" : `<div class="card help-intro"><span class="tile-ic talk">${icon("message-circle-question")}</span><div><h1 class="a-title">Ask Walo anything</h1><p class="a-sub">Talk or type your question about your farm or the app. An AI answers first and can be wrong.${hasLine() ? " A person from the team can help too." : ""}</p></div></div>`}
    ${online() ? "" : note("Get help needs internet. You are offline now.", "wifi-off")}
    <div class="chat" aria-live="polite">${S.msgs.map(bubble).join("")}${S.busy ? `<p class="busy">${icon("loader-circle", "spin")}<span>Thinking…</span></p>` : ""}</div>
    ${S.err ? `<p class="alert">${icon("triangle-alert")}<span>${esc(S.err)}</span></p>` : ""}
    ${showPerson ? personBox() : ""}
    <div class="card stack">
      <label class="field"><span>Your question</span><textarea id="help-words" data-notw rows="2" maxlength="${CFG().plant_doctor.max_words_chars}" placeholder="For example: when should I sell my maize?">${esc(S.draft)}</textarea></label>
      ${S.writing ? `<p class="busy">${icon("loader-circle", "spin")}<span>Writing down your words…</span></p>`
        : canTalk() ? `<button type="button" class="micbtn${S.listening ? " on" : ""}" id="help-mic" data-net>${icon(S.listening ? "square" : "mic")}<span>${S.listening ? "Listening… tap to stop" : isTwi() ? "Tap and talk in Twi" : "Tap and talk"}</span></button>` : ""}
      ${btn("Send", { ic: "send", attrs: `id="help-send" data-net ${S.busy || S.writing ? "disabled" : ""}` })}
    </div>
    ${showPerson || !hasLine() ? "" : `<button type="button" class="linkbtn center" id="help-person">${icon("headset")}<span>Talk to a person</span></button>`}
    ${S.msgs.length ? `<button type="button" class="linkbtn center" id="help-clear">${icon("refresh-cw")}<span>Start again</span></button>` : ""}
  </div>`;
}
const redraw = () => { if (location.hash.startsWith("#/help")) document.dispatchEvent(new Event("walo-refresh")); };
async function send() {
  const text = S.draft.trim(); if (!text) { S.err = "Say or type your question first."; return redraw(); }
  if (!online()) { S.err = "Get help needs internet. You are offline now."; return redraw(); }
  const wantsPerson = SC().person_words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
  let en = text;
  if (isTwi()) { const [t] = await translate([text], "en"); if (t) en = `${t} (the farmer's own words in Twi: ${text})`; }
  S.msgs.push({ role: "farmer", text, en }); S.draft = ""; S.err = ""; S.busy = true;
  if (wantsPerson) S.person = true;
  redraw();
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), SC().timeout_ms);
  try {
    const r = await fetch(SC().endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ messages: S.msgs.slice(-SC().max_messages).map((m) => ({ role: m.role, text: m.role === "farmer" ? m.en : m.text })), ctx: context(S.from) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "The helper could not answer right now. Try again in a minute.");
    S.msgs.push({ role: "walo", text: j.answer, unsure: j.unsure, wants_person: j.wants_person, go: j.go });
  } catch (e) { S.err = e.name === "AbortError" ? "That took too long. Try again." : e.message; }
  clearTimeout(tm); S.busy = false; redraw();
}
/* Talk: Twi through Khaya (record, then it is written down), English through the browser */
let rec = null;
function listen() {
  if (isTwi()) {
    startRecording(() => finishTwi()).then(() => { S.listening = true; S.err = ""; redraw(); })
      .catch((e) => { S.err = e && e.name === "NotAllowedError" ? "Walo cannot use the microphone. Allow it in the browser settings, or type instead." : "No microphone found. Type instead."; redraw(); });
    return;
  }
  const me = new SR(), base = S.draft.trim(); rec = me; me.lang = CFG().plant_doctor.speech_langs[0]; me.interimResults = true;
  me.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; S.draft = [base, t.trim()].filter(Boolean).join(" "); const ta = document.getElementById("help-words"); if (ta) ta.value = S.draft; };
  me.onerror = (e) => { if (e.error !== "aborted") S.err = e.error === "not-allowed" ? "Walo cannot use the microphone. Allow it in the browser settings, or type instead." : "Talking did not work. Type instead."; };
  me.onend = () => { rec = null; S.listening = false; redraw(); };
  try { me.start(); S.listening = true; S.err = ""; } catch { S.err = "Talking did not work. Type instead."; }
  redraw();
}
async function finishTwi() {
  const blob = await stopRecording(); S.listening = false; if (!blob) return redraw();
  S.writing = true; redraw();
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), CFG().twi.asr_timeout_ms);
  try { const t = await transcribe(blob, ctl.signal); S.draft = [S.draft.trim(), t].filter(Boolean).join(" "); }
  catch (e) { S.err = e.name === "AbortError" ? "That took too long. Try again, or type." : e.message; }
  clearTimeout(tm); S.writing = false; redraw();
}
function stopListen() { if (rec) { try { rec.stop(); } catch { /* */ } } if (recording()) finishTwi(); }

export function mount(root, from, b, rerender) {
  if (isTwi() && !asrReady()) twiStatus().then(() => { if (asrReady()) rerender(); });
  const ta = root.querySelector("#help-words"); if (ta) ta.addEventListener("input", () => { S.draft = ta.value; });
  const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener("click", fn); };
  on("#help-send", () => { if (ta) S.draft = ta.value; stopListen(); send(); });
  on("#help-mic", () => { if (ta) S.draft = ta.value; if (S.listening) stopListen(); else listen(); });
  on("#help-person", () => { S.person = true; rerender(); });
  on("#help-clear", () => { S = { ...S, msgs: [], draft: "", err: "", person: false }; rerender(); });
}
