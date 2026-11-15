/* Get help: an AI helper first (Gemini on our server, /api/help, knows Walo and this farmer's place, main crop and fields),
   a person second: when the AI is unsure or the farmer asks for a person, Call and WhatsApp to the team's help line
   (data/app.json support.phone; empty = no person option yet). Talk or type; Listen; or a hands-free voice chat (English: the browser listens, the helper answers, the phone speaks it, then listens again).
   Nothing is kept on the server. */
import { place, placeLabel, farms, mainCrop } from "../store.js";
import { crop, farmProgress, CFG, D } from "../data.js";
import { btn, note, icon, speaker } from "../ui.js";
import { esc, roughDate } from "../util.js";
import { online } from "../net.js";
import { isTwi, asrReady, status as twiStatus, startRecording, stopRecording, recording, transcribe, translate } from "../twi.js";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const canTalk = () => (isTwi() ? asrReady() : !!SR);
const canVoice = () => !!SR && !isTwi() && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
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
  const go = m.go && m.go !== "none" ? D.help.go[m.go] : null;
  return `<div class="msg ai"><span class="msg-who">${icon("sparkles")}AI answer</span><p>${esc(m.text)}</p>
    <div class="msg-act">${speaker(m.text)}${go ? `<a class="linkbtn" href="${go[1]}">${esc(go[0])}${icon("chevron-right")}</a>` : ""}</div></div>`;
}
export function render(from) {
  if (from !== undefined) S.from = from;
  const cropName = mainCrop() ? crop(mainCrop()).name.toLowerCase() : "maize"; // the example should be her crop, not maize by default
  const lastAi = [...S.msgs].reverse().find((m) => m.role === "walo");
  const showPerson = S.person || (lastAi && (lastAi.unsure || lastAi.wants_person));
  return `<div class="stack help">
    ${S.msgs.length ? "" : `<div class="card help-intro"><span class="tile-ic talk">${icon("message-circle-question")}</span><div><h1 class="a-title">Ask Walo anything</h1><p class="a-sub">Talk or type your question about your farm or the app. An AI answers first and can be wrong.${hasLine() ? " A person from the team can help too." : ""}</p></div></div>`}
    ${online() ? "" : note("Get help needs internet. You are offline now.", "wifi-off")}
    <div class="chat" aria-live="polite">${S.msgs.map(bubble).join("")}${S.busy && !VC.on ? `<p class="busy">${icon("loader-circle", "spin")}<span>Thinking…</span></p>` : ""}</div>
    ${S.err ? `<p class="alert">${icon("triangle-alert")}<span>${esc(S.err)}</span></p>` : ""}
    ${showPerson ? personBox() : ""}
    ${VC.on ? voicePanel() : `${canVoice() ? `<button type="button" class="vc-start" id="vc-start" data-net><span class="vc-ic">${icon("mic")}</span><span class="vc-t"><b>Voice chat</b><small>Talk with Walo, no reading. It answers out loud.</small></span></button>` : ""}
    <div class="card stack">
      <label class="field"><span>Your question</span><textarea id="help-words" data-notw rows="2" maxlength="${CFG().plant_doctor.max_words_chars}" placeholder="For example: when should I sell my ${esc(cropName)}?">${esc(S.draft)}</textarea></label>
      ${S.writing ? `<p class="busy">${icon("loader-circle", "spin")}<span>Writing down your words…</span></p>`
        : canTalk() ? `<button type="button" class="micbtn${S.listening ? " on" : ""}" id="help-mic" data-net>${icon(S.listening ? "square" : "mic")}<span>${S.listening ? "Listening… tap to stop" : isTwi() ? "Tap and talk in Twi" : "Tap and talk"}</span></button>` : ""}
      ${btn("Send", { ic: "send", attrs: `id="help-send" data-net ${S.busy || S.writing ? "disabled" : ""}` })}
    </div>`}
    ${showPerson || !hasLine() ? "" : `<button type="button" class="linkbtn center" id="help-person">${icon("headset")}<span>Talk to a person</span></button>`}
    ${S.msgs.length ? `<button type="button" class="linkbtn center" id="help-clear">${icon("refresh-cw")}<span>Start again</span></button>` : ""}
  </div>`;
}
/* ---------- hands-free voice chat ---------- */
const VC = { on: false, phase: "", silent: 0, turns: 0, rec: null, timer: 0 };
const VC_STATE = { listening: ["mic", "Listening…", "Say your question"], thinking: ["loader-circle", "Thinking…", "Walo is finding the answer"], speaking: ["volume-2", "Speaking…", "Walo is answering"], tap: ["mic", "Tap to talk", "Tap the big button, then speak"] };
export const voiceOn = () => VC.on;
function voicePanel() {
  const [ic, t, sub] = VC_STATE[VC.phase] || VC_STATE.listening, tap = VC.phase === "tap";
  return `<div class="card vc ${VC.phase}" aria-live="polite">
    <button type="button" class="vc-orb" id="vc-orb" ${tap ? "" : "disabled"} aria-label="${t}">${icon(ic, VC.phase === "thinking" ? "spin" : "")}</button>
    <p class="vc-state"><b>${t}</b><small>${sub}</small></p>
    ${btn("Stop voice chat", { kind: "secondary", ic: "square", attrs: 'id="vc-stop"' })}
  </div>`;
}
function vcStop(msg = "") {
  if (!VC.on && !msg) return;
  VC.on = false; VC.phase = ""; clearTimeout(VC.timer);
  if (VC.rec) { const r = VC.rec; VC.rec = null; try { r.abort(); } catch { /* */ } }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (msg) S.err = msg;
  redraw();
}
/* one listening turn; auto=true when Walo starts it by itself (iOS may refuse that and needs a tap) */
function vcListen(auto) {
  if (!VC.on) return;
  if (!online()) return vcStop("Voice chat needs internet. You are offline now.");
  const me = new SR(); VC.rec = me; me.lang = CFG().plant_doctor.speech_langs[0]; me.interimResults = false; me.continuous = false; me.maxAlternatives = 1;
  let said = "", err = "";
  me.onresult = (e) => { said = ""; for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript; };
  me.onerror = (e) => { err = e.error || "error"; };
  me.onend = () => {
    if (VC.rec !== me) return; // stopped or replaced
    VC.rec = null; if (!VC.on) return;
    if ((err === "not-allowed" || err === "service-not-allowed") && auto && VC.turns > 0) { VC.phase = "tap"; return redraw(); } // auto-start refused: wait for a tap
    if (err === "not-allowed" || err === "service-not-allowed") return vcStop("Walo cannot use the microphone. Allow it in the browser settings, or type instead.");
    if (err === "network") return vcStop("Voice chat needs internet. Try again, or type.");
    if (err && err !== "no-speech" && err !== "aborted") return vcStop("Voice chat did not work. Tap and talk, or type instead.");
    said = said.trim();
    if (!said) {
      VC.silent++;
      if (VC.silent >= CFG().support.voice.silent_turns) return vcStop("I did not hear you, so I stopped listening. Tap Voice chat when you want to talk again.");
      return vcListen(true);
    }
    VC.silent = 0; VC.turns++; vcAsk(said);
  };
  try { me.start(); VC.phase = "listening"; S.err = ""; redraw(); }
  catch { VC.rec = null; if (auto && VC.turns > 0) { VC.phase = "tap"; redraw(); } else vcStop("Voice chat did not work. Tap and talk, or type instead."); }
}
async function vcAsk(text) {
  VC.phase = "thinking"; S.draft = text; redraw();
  const before = S.msgs.length;
  await send();
  if (!VC.on) return;
  const ans = S.msgs.slice(before).find((m) => m.role === "walo");
  if (!ans) return vcSpeak(S.err || "Sorry, I could not answer just now.", () => vcStop(S.err));
  const lastAi = ans, person = S.person || lastAi.unsure || lastAi.wants_person;
  const offer = person ? (hasLine() ? " A person from the Walo team can help you. Tap Call or WhatsApp below." : " A help line with a real person is coming soon.") : "";
  vcSpeak(ans.text + offer, () => vcListen(true));
}
/* speak, and only then listen again (never both at once, so Walo does not hear itself) */
function vcSpeak(text, next) {
  if (!VC.on) return;
  VC.phase = "speaking"; redraw();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "en-GB"; u.rate = 0.95;
  let done = false; const go = () => { if (done) return; done = true; clearTimeout(VC.timer); if (VC.on) setTimeout(next, CFG().support.voice.gap_ms); };
  u.onend = go; u.onerror = go;
  VC.timer = setTimeout(go, CFG().support.voice.max_speak_ms_per_char * text.length + 4000); // some phones never fire onend
  speechSynthesis.speak(u);
}
function vcStart() {
  if (!online()) return;
  stopListen(); if ("speechSynthesis" in window) speechSynthesis.cancel();
  Object.assign(VC, { on: true, phase: "listening", silent: 0, turns: 0 }); S.err = "";
  vcListen(false); // inside the tap, so the browser allows the microphone
}
window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/help")) vcStop(); });
addEventListener("offline", () => { if (VC.on) vcStop("Voice chat needs internet. You are offline now."); });
document.addEventListener("visibilitychange", () => { if (document.hidden && VC.on) vcStop(); });

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
  on("#help-clear", () => { vcStop(); S = { ...S, msgs: [], draft: "", err: "", person: false }; rerender(); });
  if (VC.on) { const p = root.querySelector(".vc"); if (p && p.scrollIntoView) p.scrollIntoView({ block: "nearest" }); }
  on("#vc-start", vcStart);
  on("#vc-stop", () => vcStop());
  on("#vc-orb", () => { if (VC.on && VC.phase === "tap") vcListen(false); });
}
