/* Walo UI kit: the few components every screen is built from. Sizes and colours live in styles.css (tokens). */
import { icon } from "./icons.js";
import { esc } from "./util.js";
import { isTwi, sayTwi, stopTwi, translate } from "./twi.js";

export { icon };
export const STATUS = { // answer kind -> icon + tone
  now: ["circle-check", "good"], wait: ["clock", "wait"], later: ["clock", "wait"], water: ["droplets", "wait"], no: ["circle-x", "bad"],
  good: ["circle-check", "good"], bad: ["circle-x", "bad"], info: ["info", "info"],
};

/* ---------- speech: Twi by GhanaNLP Khaya (js/twi.js) when Twi is on, else the phone's own English voice ---------- */
const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
export function speaker(text) {
  if (!canSpeak && !isTwi()) return "";
  return `<button type="button" class="say" data-say="${esc(text)}" aria-label="Listen"${isTwi() ? " data-net" : ""}>${icon("volume-2")}<span>Listen</span></button>`;
}
export function stopSpeaking() { stopTwi(); if (canSpeak) speechSynthesis.cancel(); document.querySelectorAll(".say.on,.say.wait").forEach((b) => b.classList.remove("on", "wait")); }
function speakEnglish(btn) {
  if (!canSpeak) { btn.classList.remove("on", "wait"); return; }
  const u = new SpeechSynthesisUtterance(btn.dataset.say);
  u.lang = "en-GB"; u.rate = 0.92;
  u.onend = u.onerror = () => btn.classList.remove("on");
  btn.classList.add("on"); speechSynthesis.speak(u);
}
async function speak(btn) {
  if (btn.classList.contains("on") || btn.classList.contains("wait")) { stopSpeaking(); return; }
  stopSpeaking();
  if (!isTwi()) return speakEnglish(btn);
  btn.classList.add("wait");
  const ok = await sayTwi(btn.dataset.say, () => { btn.classList.remove("wait"); btn.classList.add("on"); });
  if (!btn.classList.contains("on") && !btn.classList.contains("wait")) return; // stopped
  btn.classList.remove("on", "wait");
  if (!ok) { toast("The Twi voice is not working now. Walo reads in English."); speakEnglish(btn); }
}
/* a short message at the bottom that goes away by itself */
export function toast(text) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("p"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = text; t.classList.add("show");
  if (isTwi()) translate([text]).then(([tw]) => { if (tw && t.textContent === text) t.textContent = tw; }); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 4200);
}

/* ---------- bottom sheet (native <dialog>: Esc, backdrop tap and swipe down close it) ---------- */
const SHEETS = new Map(); let sheetN = 0, opener = null;
export const resetSheets = () => { SHEETS.clear(); sheetN = 0; };
export function sheet(title, html, onOpen) { const id = `s${++sheetN}`; SHEETS.set(id, { title, html, onOpen }); return id; }
export function openSheet(idOrSheet, from) {
  const s = typeof idOrSheet === "string" ? SHEETS.get(idOrSheet) : idOrSheet, d = document.getElementById("sheet");
  if (!s || !d) return;
  stopSpeaking(); opener = from || null;
  document.getElementById("sheet-title").textContent = s.title;
  const old = d.querySelector(".sheet-body"), b = old.cloneNode(false); old.replaceWith(b); // fresh node: no listeners left from the last sheet
  b.innerHTML = s.html;
  d.classList.remove("closing"); d.style.transform = "";
  if (!d.open) d.showModal();
  if (s.onOpen) s.onOpen(b);
  wireSearch(b);
  document.dispatchEvent(new CustomEvent("sheet-open", { detail: b }));
}
/* the one way Walo says "there is nothing here": what is missing, why, and a way out of it */
export const emptyState = ({ ic = "info", title, sub = "", action = "", attrs = "" }) =>
  `<div class="nores"><span class="nores-ic">${icon(ic)}</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}${action ? `<button type="button" class="btn secondary" ${attrs}>${esc(action)}</button>` : ""}</div>`;

/* a search box over any list of towns, countries, crops or main-crop choices. It says what was typed,
   instead of a bare "no results", and offers to clear the box. */
export function wireSearch(root) {
  const inp = root.querySelector("[data-filter]");
  if (!inp) return;
  const box = root.querySelector("[data-none]");
  const what = root.querySelector("[data-town]") ? "town" : root.querySelector("[data-country], .ccard") ? "country" : "crop";
  const items = () => root.querySelectorAll("[data-town],[data-country],[data-crop],[data-main],.ccard");
  const run = () => {
    const q = inp.value.trim(), lq = q.toLowerCase();
    let shown = 0;
    items().forEach((el) => {
      const hit = !lq || el.textContent.toLowerCase().includes(lq);
      el.hidden = !hit;
      if (hit) shown++;
    });
    // a match inside a folded group would stay out of sight, so a search opens every group it hits
    root.querySelectorAll("details").forEach((d) => { if (q && [...d.querySelectorAll("[data-crop],[data-town],[data-main]")].some((el) => !el.hidden)) d.open = true; });
    if (!box) return;
    if (!q || shown) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = emptyState({ ic: "search", title: `No ${what} matches "${q}"`, sub: "Try a shorter word, or clear the search.", action: "Clear search", attrs: "data-clear" });
  };
  inp.addEventListener("input", run);
  root.addEventListener("click", (e) => {
    if (!e.target.closest("[data-clear]")) return;
    e.preventDefault();
    inp.value = "";
    run();
    inp.focus();
  });
}
export function closeSheet(now = false) {
  const d = document.getElementById("sheet"); if (!d || !d.open) return;
  stopSpeaking();
  const done = () => { d.classList.remove("closing"); d.style.transform = ""; if (d.open) d.close(); if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); opener = null; };
  if (now || matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
  d.classList.add("closing"); setTimeout(done, 180);
}
export function wire() {
  const d = document.getElementById("sheet");
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(); });
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest(".sheet-x")) closeSheet(); });
  let y0 = null, dy = 0; const grip = d.querySelector(".sheet-top");
  grip.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; dy = 0; d.style.transition = "none"; }, { passive: true });
  grip.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); d.style.transform = `translateY(${dy}px)`; }, { passive: true });
  grip.addEventListener("touchend", () => { d.style.transition = ""; if (dy > 80) closeSheet(); else d.style.transform = ""; y0 = null; });
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-say]"); if (s) { e.stopPropagation(); e.preventDefault(); speak(s); return; }
    const b = e.target.closest("[data-sheet]"); if (b) { e.preventDefault(); openSheet(b.dataset.sheet, b); }
  });
}

/* ---------- building blocks ---------- */
const CREDIT_ICON = { "AI answer": "sparkles", "Price data": "tag", "On this phone": "info" };
/* the answer: one icon, one plain line, an optional second line. Tap = the "Why?" sheet.
   No credit line by default: the sources live in About and in the Why? details. Pass credit only
   when the label is the point (Plant Doctor's "AI answer"). */
export function answer({ kind = "info", icon: ic, badge = "", title, sub = "", extra = "", credit = "", why = null, say = "", tone }) {
  const [i, t] = STATUS[kind] || STATUS.info, sid = why ? sheet(why.title || "Why?", why.html) : null;
  // The card stays tappable for sighted users (data-sheet), but it is deliberately NOT a button: the
  // "Why?" control below is a real <button>, so TalkBack and VoiceOver get one focusable control
  // instead of a button nested inside a role="button" card.
  return `<article class="answer ${tone || t}" ${sid ? `data-sheet="${sid}"` : ""}>
    <div class="a-top">${badge || `<span class="a-ic">${icon(ic || i)}</span>`}${say ? speaker(say) : ""}</div>
    <h1 class="a-title">${title}</h1>
    ${sub ? `<p class="a-sub">${sub}</p>` : ""}
    ${extra}
    ${sid || credit ? `<p class="a-foot">${credit ? `<span class="credit">${icon(CREDIT_ICON[credit] || "satellite")}${esc(credit)}</span>` : ""}${sid ? `<button type="button" class="why-link" data-sheet="${sid}">Why?${icon("chevron-right")}</button>` : ""}</p>` : ""}
  </article>`;
}
/* inside a Why? sheet: 1-3 plain sentences, then numbers and sources folded under Details */
export const whyBody = (plain, details = []) => `<div class="why">${plain.map((p) => `<p>${p}</p>`).join("")}
  ${details.length ? `<details class="details"><summary>Details${icon("chevron-down")}</summary><ul>${details.map((x) => `<li>${x}</li>`).join("")}</ul></details>` : ""}</div>`;
export const btn = (label, { href, ic, kind = "primary", attrs = "", type = "button" } = {}) => href
  ? `<a class="btn ${kind}" href="${href}" ${attrs}>${ic ? icon(ic) : ""}<span>${label}</span></a>`
  : `<button type="${type}" class="btn ${kind}" ${attrs}>${ic ? icon(ic) : ""}<span>${label}</span></button>`;
export const cropImg = (c, cls = "") => (c.img ? `<img class="${cls}" src="${c.img}" alt="" loading="lazy" decoding="async" style="object-position:${c.pos || "50% 50%"}">` : `<span class="${cls} noimg">${icon("sprout")}</span>`);
export const note = (text, ic = "info") => `<p class="note">${icon(ic)}<span>${text}</span></p>`;
export const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
/* a tappable row: picture or icon, a line, a small second line, a status icon */
export function row({ href, attrs = "", img = "", ic = "", title, sub = "", status = "", disabled = false }) {
  const tag = href ? "a" : "button", h = href ? `href="${href}"` : `type="button"`;
  return `<${tag} class="row${disabled ? " off" : ""}" ${h} ${attrs} ${disabled ? 'aria-disabled="true" tabindex="-1"' : ""}>
    ${img || (ic ? `<span class="row-ic">${icon(ic)}</span>` : "")}
    <span class="row-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span>
    ${status ? `<span class="row-s ${(STATUS[status] || STATUS.info)[1]}">${icon((STATUS[status] || STATUS.info)[0])}</span>` : icon("chevron-right", "row-go")}
  </${tag}>`;
}

/* ---------- pictures that carry meaning (no decoration-only art) ---------- */
/* photo band at the top of a screen: the photo is the label (field, crop, market); the answer card overlaps its foot */
export function hero({ img, pos = "50% 50%", eyebrow = "", eyeIcon = "map-pin", title, extra = "" }) {
  return `<header class="hero">${img ? `<img src="${esc(img)}" alt="" decoding="async" style="object-position:${pos}">` : ""}
    <div class="hero-t">${eyebrow ? `<p class="eyebrow">${eyeIcon ? icon(eyeIcon) : ""}<span>${eyebrow}</span></p>` : ""}<h2 class="hero-h">${title}</h2></div>${extra}</header>`;
}
const ML = "JFMAMJJASOND";
/* twelve small bars, one per month; the current month's letter is highlighted.
   bars: [{v (0..1), cls}] ; caption and legend are plain words */
export function monthBars(bars, { caption = "", legend = [] } = {}) {
  const cur = new Date().getMonth();
  return `<figure class="mbars" aria-label="${esc(caption)}">
    <div class="mb-row">${bars.map((b, i) => `<span class="mb${i === cur ? " cur" : ""}"><i class="${b.cls || ""}" style="height:${Math.round(6 + Math.max(0, Math.min(1, b.v)) * 46)}px"></i><em data-notw>${ML[i]}</em></span>`).join("")}</div>
    ${caption || legend.length ? `<figcaption>${caption ? `<span>${caption}</span>` : ""}${legend.map(([cls, t]) => `<span class="lg"><i class="${cls}"></i>${t}</span>`).join("")}</figcaption>` : ""}
  </figure>`;
}
/* small facts with coloured icon tiles */
export const facts = (items) => `<div class="facts">${items.filter(Boolean).map((f) => `<span class="fact ${f.tone || ""}"><i>${icon(f.ic)}</i>${f.text}</span>`).join("")}</div>`;
export const chip = (kind, text) => `<span class="chip ${(STATUS[kind] || STATUS.info)[1]}">${text}</span>`;
/* progress ring: how far the field is from planting to harvest; the stage icon sits in the middle */
export function ring(frac, ic, label = "") {
  const f = Math.max(0, Math.min(1, frac || 0)), r = 20, c = 2 * Math.PI * r;
  return `<span class="ring" role="img" aria-label="${esc(label || `${Math.round(f * 100)}% of the way to harvest`)}"><svg class="rg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="${r}" class="ring-bg"/><circle cx="24" cy="24" r="${r}" class="ring-fg" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 24 24)"/></svg>${icon(ic)}</span>`;
}
/* a photo tile for a crop: photo, name, a coloured status chip */
/* crop groups (data.js cropGroups) as small coloured headers with icon + count, each with its tiles; "collapsed" groups fold */
export function groupedCrops(groups, tile, grid = "tgrid") {
  return groups.map((g) => {
    const head = `<span class="grp-ic">${icon(g.icon)}</span><span class="grp-t">${esc(g.title)}</span><span class="grp-n">${g.items.length}</span>`;
    const body = `<div class="${grid}">${g.items.map((x) => tile(x, g)).join("")}</div>`;
    return g.collapsed ? `<details class="grp ${g.tone}"><summary class="grp-h">${head}${icon("chevron-down")}</summary>${body}</details>`
      : `<section class="grp ${g.tone}"><h2 class="grp-h">${head}</h2>${body}</section>`;
  }).join("");
}
export const cropTile = ({ href, c, kind, text }) => `<a class="ctile" href="${href}">${cropImg(c, "ctile-img")}<span class="ctile-t"><b>${esc(c.name)}</b>${chip(kind, esc(text))}</span></a>`;
