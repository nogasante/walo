/* After this crop: the Field Shift answer. One recommendation, then the case for it in NASA numbers a farmer can see
   (the usual rain each month, how much of a crop's water the rain covers, the hot days at flowering) and the usual
   price pattern. Two plain choices move the ranking — what she wants from the next crop and how her soil behaves —
   and both open under one row instead of sitting in her face as jargon. */
import { place, placeLabel, priority, setPriority, soilChoice, setSoilChoice, farm } from "../store.js";
import { crop, farmPlace, farmProgress, monthName, soilFor, scoreCrop, agroOf, CFG } from "../data.js";
import { rotationOptions, PRIORITIES, SOILS, scoreChip } from "../rotation.js";
import { answer, whyBody, btn, note, hero, emptyState, icon, sheet, closeSheet, monthBars } from "../ui.js";
import { esc, fmt } from "../util.js";

export const title = (id) => { const c = crop(id); return c ? `After ${c.name.toLowerCase()}` : "After this crop" };

let PLACE_NOW = null; // the place the cards were built for, so the Why? text uses the same one
const placeNow = () => PLACE_NOW || place();
const soilLabel = (id) => (SOILS.find((s) => s.id === id) || SOILS[1]).label.toLowerCase();

/* the water line: NASA rain against what this crop needs, as a bar she can read without a number */
function waterLine(o) {
  const tone = o.waterPct >= 80 ? "good" : o.waterPct >= 55 ? "wait" : "bad";
  if (o.need == null) return `<p class="wline"><span>Water</span><small>Long season: Walo does not judge its water.</small></p>`;
  const enough = o.waterPct >= 100;
  return `<div class="wline"><div class="wline-h"><span>${icon("cloud-rain")}${enough ? "Rain here covers all the water it needs" : `Rain covers ${o.waterPct}% of the water it needs`}</span><small>${fmt(o.peff)} mm of ${fmt(o.need)}</small></div>
    <div class="nbar ${tone}"><i style="width:${Math.max(4, Math.min(100, o.waterPct))}%"></i></div></div>`;
}
function heatLine(o) {
  if (!o.hot || o.hot < 3) return "";
  return `<p class="wline small"><span>${icon("thermometer-sun")}About ${Math.round(o.hot)} days above ${o.heatT} °C while it flowers</span></p>`;
}
function priceLine(o) {
  const sa = o.sa || {};
  if (sa.kind === "index") return `<p class="wline small"><span>${icon("tag")}${sa.store ? `Prices usually rise by ${monthName(sa.store.month)}: it can be stored.` : "Prices do not usually rise much after harvest."}</span></p>`;
  if (sa.kind === "spot") return `<p class="wline small"><span>${icon("tag")}Sold at ${esc(sa.spot.market)} market${sa.spot.km != null ? `, ${fmt(sa.spot.km)} km away` : ""}.</span></p>`;
  return `<p class="wline small"><span>${icon("tag")}No price pattern here yet.</span></p>`;
}

function optionCard(o, soil) {
  const role = (o.r && o.r.role) || "";
  const sc = scoreChip(o.pct);
  const fit = scoreCrop(o.c, placeNow()).fit || {};
  const why = whyBody(
    [o.same ? `This is what you grow now, so it is the one to beat. ${role}.` : `${role}.`].concat(o.reasons.slice(0, 2)),
    [
      o.r ? `After harvest it leaves ${o.r.cover} of 3 for ground cover, uses ${o.r.water} of 3 for water, and is a ${o.r.family}${o.r.n_fix ? " that fixes nitrogen" : ""}.` : "",
      `NASA POWER rain for the usual season here, through the FAO-56 water balance: needs about ${fmt(o.need)} mm, effective rain ${fmt(o.peff)} mm, WRSI ${fit.wrsi ?? "not judged"} (${o.waterPct}% of its need covered).`,
      o.hot ? `About ${Math.round(o.hot)} days above ${o.heatT} °C usually fall while it flowers.` : "",
      `Score ${o.pct} of 100 (water ${Math.round(o.water * 100)}, soil ${Math.round(o.soilScore * 100)}, money ${Math.round(o.money * 100)}, heat ${Math.round(o.risk * 100)}), weighted for "${PRIORITIES.find((x) => x.id === priority()).label.toLowerCase()}" on a ${soil} soil.`,
      o.r && o.r.src ? `Crop traits: ${o.r.src} (the guides listed per crop in About). They are rules of thumb, not measurements of your field.` : "Crop traits are extension rules of thumb; rain and heat come from NASA POWER.",
    ].filter(Boolean),
  );
  return `<article class="nextcard">
    <div class="nc-top">
      ${o.c.img ? `<img class="nc-img" src="${esc(o.c.img)}" alt="" loading="lazy" style="object-position:${esc(o.c.pos || "50% 50%")}">` : ""}
      <div class="nc-t"><b>${esc(o.same ? `${o.c.name} again` : o.c.name)}</b><small>${esc(role)}</small></div>
      <span class="chip ${sc.kind}">${sc.text}</span>
    </div>
    ${o.reasons[0] ? `<p class="nc-why">${esc(o.reasons[0])}</p>` : ""}
    ${waterLine(o)}
    ${heatLine(o)}
    ${priceLine(o)}
    ${o.risks.length ? `<p class="nc-risk">${icon("triangle-alert")}<span>${esc(o.risks[0])}</span></p>` : ""}
    <div class="nc-acts">
      ${btn(o.same ? "Plant it again" : "Plant this", { href: `#/start/${esc(o.c.id)}`, ic: "sprout" })}
      <button type="button" class="btn secondary" data-sheet="${sheet(`Why ${o.c.name}?`, why)}">Why?</button>
    </div>
  </article>`;
}

/* the rain here, as the picture the whole screen is built on: NASA's usual month by month and the year's total */
function nasaCard(p) {
  const ag = agroOf(p), months = (ag && ag.months) || [];
  if (!months.length) return "";
  const total = months.reduce((s, m) => s + (m.rain_mm || 0), 0), hi = Math.max(...months.map((m) => m.rain_mm || 0)) || 1;
  return `<div class="nasa">
    <div class="nasa-h">${icon("satellite")}<b>Rain here, from NASA</b></div>
    ${monthBars(months.map((m) => ({ v: (m.rain_mm || 0) / hi, cls: "" })), { caption: `Usual rain each month · about ${fmt(total)} mm a year` })}
    <p class="nasa-src">NASA POWER daily rain 1991–2025 at this point. Every bar on the crops below is measured against it.</p>
  </div>`;
}

/* both choices in one sheet, said the way she would say them, so nothing on the screen is a bare label */
function tuneSheet(p, soil) {
  const auto = soilFor(p);
  const html = `<div class="stack">
    <p class="pick-h">What matters most from the next crop?</p>
    <div class="pick">${PRIORITIES.map((x) => `<button type="button" class="pickrow${x.id === priority() ? " on" : ""}" data-prio="${x.id}">${icon(x.ic)}<span><b>${x.label}</b><small>${x.line}</small></span></button>`).join("")}</div>
    <p class="pick-h">What is your soil like when you squeeze a handful?</p>
    <div class="pick">${SOILS.map((x) => `<button type="button" class="pickrow${x.id === soil ? " on" : ""}" data-soil="${x.id}">${icon("droplets")}<span><b>${x.label}</b><small>${x.feel}</small></span></button>`).join("")}</div>
    <p class="note-text">${esc(auto.note)}</p>
  </div>`;
  return { title: "Change what Walo weighs", html, onOpen: (b) => b.addEventListener("click", (e) => {
    const pr = e.target.closest("[data-prio]");
    if (pr) { setPriority(pr.dataset.prio); closeSheet(true); return; }
    const so = e.target.closest("[data-soil]");
    if (so) { setSoilChoice(so.dataset.soil); closeSheet(true); }
  }) };
}

export function render(id, fid) {
  const after = crop(id);
  const f = fid ? farm(fid) : null;
  if (!after) return emptyState({ ic: "sprout", title: "Pick the crop in the field first", sub: "Walo needs to know what is growing to say what should follow it.", action: "My fields", href: "#/farm" });
  const p = f ? farmPlace(f) : place();
  PLACE_NOW = p;
  const pr = f ? farmProgress(f) : null;
  const autoSoil = soilFor(p), soil = soilChoice() || autoSoil.id; // her tap wins, otherwise the zone's usual soil
  const prio = priority();
  const { options } = rotationOptions(after.id, p, { soil, priority: prio });
  if (!options.length) return emptyState({ ic: "sprout", title: `No crops to follow ${after.name.toLowerCase()} here`, sub: "Walo has no other crop for this place yet.", action: "Try another place", href: "#/welcome" });
  const top = options[0], tune = tuneSheet(p, soil);
  const when = pr ? `Your ${after.name.toLowerCase()} comes off around ${monthName(pr.harvest.getMonth() + 1)}. ` : "";
  const headline = top.same ? `Keep ${after.name.toLowerCase()} in this field` : `Plant ${top.c.name.toLowerCase()} after your ${after.name.toLowerCase()}`;
  const sub = `${when}${top.reasons[0] || ""}${top.reasons[1] ? ` ${top.reasons[1]}` : ""}`;
  const why = whyBody(
    [
      "Walo puts each crop next to the rain your place usually gets, the water that crop needs (FAO-56), the heat while it flowers, what it leaves in the soil, and how its price usually moves.",
      `Right now it is weighing "${PRIORITIES.find((x) => x.id === prio).line.toLowerCase()}", on ${soilLabel(soil)} ground. Change either at the bottom and the order changes.`,
    ],
    [
      `NASA POWER daily rain and temperature 1991–2025 at ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°; FAO-56 stage lengths and crop coefficients; EcoCrop temperature limits; the usual price pattern from WFP/MoFA records.`,
      `Soil: ${autoSoil.source || ""}`,
      "Crop rotation traits are extension rules of thumb from the IITA and MoFA guides cited per crop, not measurements from your field.",
    ].filter(Boolean),
  );
  return `${hero({ img: CFG().photos.home.img, pos: CFG().photos.home.pos, eyeIcon: "refresh-cw", eyebrow: `${esc(after.name)} · ${esc(placeLabel(p))}`, title: after.name === "Maize" ? "After the maize" : `After the ${after.name.toLowerCase()}` })}
  <div class="stack lift">
    ${answer({ kind: top.same ? "info" : "now", tone: top.same ? "info" : "good", ic: "refresh-cw", title: esc(headline), sub: esc(sub), why: { title: "How Walo chose", html: why }, say: `${headline}. ${sub}` })}
    ${nasaCard(p)}
    ${options.map((o) => optionCard(o, soil)).join("")}
    <button type="button" class="tune" data-sheet="${sheet(tune.title, tune.html, tune.onOpen)}">
      ${icon("leaf")}<span><b>Change what Walo weighs</b><small>${esc(PRIORITIES.find((x) => x.id === prio).label)} · ${esc(soilLabel(soil))} ground here</small></span>${icon("chevron-right")}
    </button>
    <div class="fb" data-fb-crop="${esc(after.id)}">
      <p>Did this help you decide?</p>
      <div class="fb-btns"><button type="button" class="btn secondary" data-fb="yes">Yes</button><button type="button" class="btn secondary" data-fb="no">No</button></div>
    </div>
    ${note("Walo compares what each crop does to the soil and the rain. You decide what fits your farm.", "info")}
    ${f ? btn("Back to the field", { href: `#/farm/${esc(f.id)}`, kind: "secondary", ic: "sprout" }) : ""}
  </div>`;
}

export function mount(root) {
  root.addEventListener("click", (e) => {
    const fb = e.target.closest("[data-fb]");
    if (!fb) return;
    // an honest count of whether the answer helped: no name, no place, no field, just crop and verdict
    const box = fb.closest("[data-fb-crop]"), vote = fb.dataset.fb;
    try { fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ev: "rot_help", owner: "next", kind: vote, type: box ? box.dataset.fbCrop : "" }) }).catch(() => {}); } catch { /* offline is fine */ }
    if (box) box.innerHTML = `<p class="fb-done">${icon("circle-check")}<span>Thank you. Walo counts these to know if the advice is useful.</span></p>`;
  });
}
