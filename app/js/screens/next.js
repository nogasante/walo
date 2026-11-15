/* After this crop: the Field Shift answer. One recommendation, then the case for it in numbers a farmer can see:
   the usual rain each month from NASA, how much of a crop's water that rain covers on her soil, the hot days at
   flowering, what the crop leaves for livestock, and what a place's slope and cover say about erosion.

   Three controls, and none of them is a weight: what limits her this season (nothing / water / cash), what her soil
   is like in the hand, and which rain year she is planning for (less / usual / more). */
import { place, placeLabel, limit, setLimit, rainPlan, setRainPlan, soilChoice, setSoilChoice, farm } from "../store.js";
import { crop, farmPlace, farmProgress, monthName, soilFor, scoreCrop, agroOf, CFG } from "../data.js";
import { rotationOptions, LIMITS, RAIN_PLANS, SOILS, fitChip, PASS_AT } from "../rotation.js";
import { answer, whyBody, btn, note, hero, emptyState, icon, sheet, closeSheet, monthBars } from "../ui.js";
import { esc, fmt } from "../util.js";

export const title = (id) => { const c = crop(id); return c ? `After ${c.name.toLowerCase()}` : "After this crop"; };

let PLACE_NOW = null; // the place the cards were built for, so the Why? text uses the same one
const placeNow = () => PLACE_NOW || place();
const soilLabel = (id) => (SOILS.find((s) => s.id === id) || SOILS[1]).label.toLowerCase();
const limitOf = (id) => LIMITS.find((x) => x.id === id) || LIMITS[0];
const rainOf = (id) => RAIN_PLANS.find((x) => x.id === id) || RAIN_PLANS[1];

/* the water line: NASA rain against what this crop needs, after this soil has taken its share, as a bar */
function waterLine(o) {
  if (o.waterPct == null) return `<p class="wline small"><span>${icon("droplets")}Long season: Walo does not judge its water.</span></p>`;
  const tone = o.waterPct >= 80 ? "good" : o.waterPct >= 60 ? "wait" : "bad";
  const enough = o.waterPct >= 100;
  return `<div class="wline"><div class="wline-h"><span>${icon("cloud-rain")}${enough ? "The rain here covers all the water it needs" : `The rain covers ${o.waterPct}% of the water it needs`}</span><small>${fmt(o.peff)} mm of ${fmt(o.need)}</small></div>
    <div class="nbar ${tone}"><i style="width:${Math.max(4, Math.min(100, o.waterPct))}%"></i></div></div>`;
}
function heatLine(o) {
  if (!o.hot || o.hot < 3) return "";
  return `<p class="wline small"><span>${icon("thermometer-sun")}About ${o.hot} days above ${o.heatT} °C while it flowers</span></p>`;
}
function forageLine(o) {
  const f = o.r && o.r.forage;
  return f ? `<p class="wline small"><span>${icon("wheat")}Livestock: ${esc(f.line)}</span></p>` : "";
}
/* money is a note, not a ranking term, and the line says so instead of pretending otherwise */
function priceLine(o) {
  const sa = o.sa || {};
  if (sa.kind === "index") return `<p class="wline small"><span>${icon("tag")}${sa.store ? `Prices usually rise by ${monthName(sa.store.month)}: it can be stored.` : "Prices do not usually rise much after harvest."} Money is shown here, not counted in the order.</span></p>`;
  if (sa.kind === "spot") return `<p class="wline small"><span>${icon("tag")}Sold at ${esc(sa.spot.market)} market${sa.spot.km != null ? `, ${fmt(sa.spot.km)} km away` : ""}. Money is shown, not counted.</span></p>`;
  return `<p class="wline small"><span>${icon("tag")}No price record here yet, so money plays no part in this card.</span></p>`;
}
/* the brief asks each suggestion to say where the information runs out. This is that line, on the card itself. */
function gapLine(o) {
  return `<p class="wline small gap"><span>${icon("info")}${esc(o.gaps[0])}</span></p>`;
}

function optionCard(o, pass) {
  const role = (o.r && o.r.role) || "";
  const chip = fitChip(o, pass);
  const p = placeNow(), fit = scoreCrop(o.c, p).fit || {};
  const why = whyBody(
    [
      o.same ? `This is what grows in the field now, so it is the one to beat. ${role}.` : role ? `${role}.` : "",
      ...o.reasons.slice(0, 3),
    ].filter(Boolean),
    [
      o.need != null
        ? `Water, from NASA POWER rain for this season through the FAO-56 balance: it needs about ${fmt(o.need)} mm, the usual rain gives ${fmt(o.usualRain)} mm, and after this soil holds its share that is ${fmt(o.peff)} mm (${o.waterPct}% of the need). WRSI ${fit.wrsi ?? "not judged"}.`
        : "A long-season crop: Walo does not judge its water against one rainy season.",
      `Soil benefit: ${o.soilPts > 0 ? `+${o.soilPts}` : o.soilPts} point${Math.abs(o.soilPts) === 1 ? "" : "s"}, counted from what it leaves behind — a legume, ground cover, and whether it is the same family as the crop already there.`,
      o.hot ? `About ${o.hot} days above ${o.heatT} °C usually fall while it flowers.` : "",
      o.r && o.r.src ? `Crop traits: ${o.r.src} (guides listed in About). Rules of thumb, not measurements of your field.` : "Crop traits are extension rules of thumb; rain, heat and slope come from NASA POWER, MODIS and a DEM sample.",
      ...o.gaps.map((g) => `What Walo does not know: ${g}`),
    ].filter(Boolean),
  );
  return `<article class="nextcard">
    <div class="nc-top">
      ${o.c.img ? `<img class="nc-img" src="${esc(o.c.img)}" alt="" loading="lazy" style="object-position:${esc(o.c.pos || "50% 50%")}">` : ""}
      <div class="nc-t"><b>${esc(o.same ? `${o.c.name} again` : o.c.name)}</b><small>${esc(role)}</small></div>
      <span class="chip ${chip.kind}">${chip.text}</span>
    </div>
    ${o.reasons[0] && !o.same ? `<p class="nc-why">${esc(o.reasons[0])}</p>` : ""}
    ${waterLine(o)}
    ${heatLine(o)}
    ${forageLine(o)}
    ${priceLine(o)}
    ${gapLine(o)}
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
    ${monthBars(months.map((m) => ({ v: (m.rain_mm || 0) / hi, cls: m.lgp ? "g" : "r" })), { caption: `Usual rain each month · about ${fmt(total)} mm a year`, legend: [["g", "Wet months"], ["r", "Dry months"]] })}
    <p class="nasa-src">NASA POWER daily rain 1991–2025 at this point. Every bar on the crops below is measured against it.</p>
  </div>`;
}

/* what the ground itself looks like: slope, cover, erosion — the part of the answer that is about the place */
function groundCard(h, soil) {
  if (!h) return "";
  const band = (h.erosion && h.erosion.band) || "unknown";
  const word = { low: "Low", medium: "Medium", high: "High" }[band] || "Not known";
  const om = { low: "Low", medium: "Medium", high: "High" }[(h.om && h.om.band) || ""] || "Not known";
  return `<div class="nasa ground">
    <div class="nasa-h">${icon("map-pin")}<b>The ground here</b></div>
    <div class="grow2"><span>Erosion risk</span><b class="chip ${band === "high" ? "bad" : band === "medium" ? "wait" : "good"}">${word}</b></div>
    <div class="grow2"><span>Organic matter likely</span><b>${om}</b></div>
    <div class="grow2"><span>Slope</span><b>${h.slope_pct}%</b></div>
    <div class="grow2"><span>Usual cover</span><b>${coverWord(h)}</b></div>
    <p class="nasa-src">${esc(h.note || "")} Slope is a 3×3 DEM sample around the town, cover is ${esc((h.cover_src || "").toLowerCase() || "satellite cover")}. A screening for comparing towns, not a soil test: your own field may differ, and a local extension officer can say how.</p>
  </div>`;
}

/* NDVI is a number for us, a word for her: how much of the ground is usually covered */
const coverWord = (h) => {
  const v = h.ndvi_peak || 0;
  return v >= 0.45 ? "thick" : v >= 0.3 ? "patchy" : "thin";
};
/* which rain year she is planning for. The scenario only rescales the rain the ranking already uses. */
function scenarioRow(rain) {
  return `<div class="scen">
    <p class="scen-h">${icon("cloud-rain")}Plan for this season</p>
    <div class="scen-row">${RAIN_PLANS.map((r) => `<button type="button" class="scen-b${r.id === rain ? " on" : ""}" data-scen="${r.id}"><b>${r.label}</b><small>${r.line}</small></button>`).join("")}</div>
  </div>`;
}

/* the choices in one sheet, said the way she would say them, so nothing on the screen is a bare label */
function tuneSheet(p, soil, lim) {
  const auto = soilFor(p);
  const html = `<div class="stack">
    <p class="pick-h">What limits you this season?</p>
    <div class="pick">${LIMITS.map((x) => `<button type="button" class="pickrow${x.id === lim ? " on" : ""}" data-limit="${x.id}">${icon(x.ic)}<span><b>${x.label}</b><small>${x.line}</small></span></button>`).join("")}</div>
    <p class="pick-h">What is your soil like when you squeeze a handful?</p>
    <div class="pick">${SOILS.map((x) => `<button type="button" class="pickrow${x.id === soil ? " on" : ""}" data-soil="${x.id}">${icon("droplets")}<span><b>${x.label}</b><small>${x.feel}</small></span></button>`).join("")}</div>
    <p class="note-text">${esc(auto.note)} Walo starts from that and you can correct it any time.</p>
  </div>`;
  return { title: "Change what Walo goes by", html, onOpen: (b) => b.addEventListener("click", (e) => {
    const li = e.target.closest("[data-limit]");
    if (li) { setLimit(li.dataset.limit); closeSheet(true); return; }
    const so = e.target.closest("[data-soil]");
    if (so) { setSoilChoice(so.dataset.soil); closeSheet(true); }
  }) };
}

export function render(id, fid) {
  const after = crop(id);
  const f = fid ? farm(fid) : null;
  if (!after) return emptyState({ ic: "sprout", title: "Pick the crop in the field first", sub: "Walo needs to know what is growing to say what should follow it.", action: "My fields", href: "#/farm" });
  if (!after.rotation) return emptyState({ ic: "sprout", title: `Walo has no rotation notes for ${after.name.toLowerCase()}`, sub: "That crop is not in the rotation guides yet, so Walo will not guess what follows it.", action: "My fields", href: "#/farm" });
  const p = f ? farmPlace(f) : place();
  PLACE_NOW = p;
  const pr = f ? farmProgress(f) : null;
  const autoSoil = soilFor(p), soil = soilChoice() || autoSoil.id; // her tap wins, otherwise the zone's usual soil
  const lim = limit(), rain = rainPlan(), pass = PASS_AT[lim] ?? PASS_AT.none;
  const { options, health } = rotationOptions(after.id, p, { soil, limit: lim, rain });
  if (!options.length) return emptyState({ ic: "sprout", title: `No crops to follow ${after.name.toLowerCase()} here`, sub: "Walo has no other crop for this place yet.", action: "Try another place", href: "#/welcome" });
  const top = options[0], tune = tuneSheet(p, soil, lim), plan = rainOf(rain);
  const when = pr ? `Your ${after.name.toLowerCase()} comes off around ${monthName(pr.harvest.getMonth() + 1)}. ` : "";
  const headline = top.same ? `Keep ${after.name.toLowerCase()} in this field` : `Plant ${top.c.name.toLowerCase()} after your ${after.name.toLowerCase()}`;
  const sub = `${when}${top.reasons[0] || ""}${top.reasons[1] ? ` ${top.reasons[1]}` : ""}`;
  const why = whyBody(
    [
      "Walo does not add up a secret score. It asks three things in order: can the rain carry this crop (NASA rain through the FAO-56 water balance, after your soil has taken its share); what does it leave in the soil (a legume, ground cover, or the same family and its pests again); and does it break a pest cycle or continue one. Money is shown on every card and never counted in that order.",
      `Right now: ${plan.label.toLowerCase()} (${plan.line}), ${limitOf(lim).label.toLowerCase()}, ${soilLabel(soil)} ground. Change any of them and the list reorders by that same rule, not by a different one.`,
    ],
    [
      `NASA POWER daily rain and temperature 1991–2025 at ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°; FAO-56 stage lengths and crop coefficients; EcoCrop temperature limits.`,
      health ? `Ground: slope from a 3×3 DEM sample, cover from ${(health.cover_src || "").toLowerCase()}, rain from NASA POWER. Bands compare towns; they are not a soil test.` : "",
      `Soil water holding: ${autoSoil.source || "zone soil"}${soilChoice() ? ", corrected by you" : ""}.`,
      "Crop rotation traits for nitrogen, cover and family come from the IITA and MoFA guides cited per crop; the price pattern from WFP and MoFA records, shown but not scored.",
    ].filter(Boolean),
  );
  return `${hero({ img: CFG().photos.home.img, pos: CFG().photos.home.pos, eyeIcon: "refresh-cw", eyebrow: `${esc(after.name)} · ${esc(placeLabel(p))}`, title: after.name === "Maize" ? "After the maize" : `After the ${after.name.toLowerCase()}` })}
  <div class="stack lift">
    ${answer({ kind: top.same ? "info" : "now", tone: top.same ? "info" : "good", ic: "refresh-cw", title: esc(headline), sub: esc(sub), why: { title: "How Walo chose", html: why }, say: `${headline}. ${sub}` })}
    ${nasaCard(p)}
    ${scenarioRow(rain)}
    ${groundCard(health, soil)}
    ${top.waterPct != null && top.waterPct < 60 ? note(`With ${plan.label.toLowerCase()}, even the best crop here covers only ${top.waterPct}% of its water from rain. That is a season for a short crop, mulch, or watering — not for the thirstiest one.`, "alert") : ""}
    ${options.map((o) => optionCard(o, pass)).join("")}
    <button type="button" class="tune" data-sheet="${sheet(tune.title, tune.html, tune.onOpen)}">
      ${icon("leaf")}<span><b>Change what Walo goes by</b><small>${esc(limitOf(lim).label)} · ${esc(soilLabel(soil))} ground here</small></span>${icon("chevron-right")}
    </button>
    <div class="fb" data-fb-crop="${esc(after.id)}">
      <p>Did this help you decide?</p>
      <div class="fb-btns"><button type="button" class="btn secondary" data-fb="yes">Yes</button><button type="button" class="btn secondary" data-fb="no">No</button></div>
    </div>
    ${note("Walo compares what each crop does to the soil and the rain. You decide what fits your farm, and a local extension officer can check what the data cannot see.", "info")}
    ${f ? btn("Back to the field", { href: `#/farm/${esc(f.id)}`, kind: "secondary", ic: "sprout" }) : ""}
  </div>`;
}

export function mount(root, a, b, rerender) {
  root.addEventListener("click", (e) => {
    const sc = e.target.closest("[data-scen]");
    if (sc) { setRainPlan(sc.dataset.scen); if (rerender) rerender(); return; }
    const fb = e.target.closest("[data-fb]");
    if (!fb) return;
    // an honest count of whether the answer helped: no name, no place, no field, just crop and verdict
    const box = fb.closest("[data-fb-crop]"), vote = fb.dataset.fb;
    try { fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ev: "rot_help", owner: "next", kind: vote, type: box ? box.dataset.fbCrop : "" }) }).catch(() => {}); } catch { /* offline is fine */ }
    if (box) box.innerHTML = `<p class="fb-done">${icon("circle-check")}<span>Thank you. Walo counts these to know if the advice is useful.</span></p>`;
  });
}
