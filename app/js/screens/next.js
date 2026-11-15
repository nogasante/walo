/* After this crop: the Field Shift answer. One recommendation, the evidence behind it, and everything else folded
   away — because a farmer deciding what to plant should not have to read five cards and four controls to get there.

   On the screen: the answer, the NASA rain picture (with the ground facts in one line), the one recommended crop,
   and a single row to change what Walo goes by. The other crops are one tap away under "Compare"; the rain
   scenario, her limit and her soil are all inside that one row's sheet. */
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
/* NDVI is a number for us, a word for her */
const coverWord = (h) => ((h.ndvi_peak || 0) >= 0.45 ? "thick" : (h.ndvi_peak || 0) >= 0.3 ? "patchy" : "thin");

/* the water line: NASA rain against what this crop needs, after this soil has taken its share */
function waterLine(o) {
  if (o.waterPct == null) return `<p class="wline small"><span>${icon("droplets")}Walo has no water balance for this crop yet.</span></p>`;
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
/* money is a note, not a ranking term, and the line says so */
function priceLine(o) {
  const sa = o.sa || {};
  if (sa.kind === "index") return `<p class="wline small"><span>${icon("tag")}${sa.store ? `Prices usually rise by ${monthName(sa.store.month)}: it can be stored.` : "Prices do not usually rise much after harvest."}</span></p>`;
  if (sa.kind === "spot") return `<p class="wline small"><span>${icon("tag")}Sold at ${esc(sa.spot.market)} market${sa.spot.km != null ? `, ${fmt(sa.spot.km)} km away` : ""}.</span></p>`;
  return `<p class="wline small"><span>${icon("tag")}No price record here yet.</span></p>`;
}

function optionCard(o, pass, { lead = false } = {}) {
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
      `Soil benefit: ${o.soilPts > 0 ? `+${o.soilPts}` : o.soilPts} point${Math.abs(o.soilPts) === 1 ? "" : "s"} — a legume, ground cover, and whether it is the same family as the crop already there. These are counted, not weighted.`,
      o.hot ? `About ${o.hot} days above ${o.heatT} °C usually fall while it flowers.` : "",
      o.r && o.r.src ? `Crop traits: ${o.r.src} (guides listed in About). Rules of thumb, not measurements of your field.` : "Crop traits are extension rules of thumb; rain, heat and slope come from NASA POWER, MODIS and a DEM sample.",
      ...o.gaps.map((g) => `What Walo does not know: ${g}`),
    ].filter(Boolean),
  );
  return `<article class="nextcard${lead ? " lead" : ""}">
    <div class="nc-top">
      ${o.c.img ? `<img class="nc-img" src="${esc(o.c.img)}" alt="" loading="lazy" style="object-position:${esc(o.c.pos || "50% 50%")}">` : ""}
      <div class="nc-t"><b>${esc(o.same ? `${o.c.name} again` : o.c.name)}</b><small>${esc(role)}</small></div>
      <span class="chip ${chip.kind}">${chip.text}</span>
    </div>
    ${o.reasons[0] && !o.same && !lead ? `<p class="nc-why">${esc(o.reasons[0])}</p>` : ""}
    ${waterLine(o)}
    ${heatLine(o)}
    ${forageLine(o)}
    ${priceLine(o)}
    ${o.risks.length ? `<p class="nc-risk">${icon("triangle-alert")}<span>${esc(o.risks[0])}</span></p>` : ""}
    ${lead ? "" : `<p class="wline small gap"><span>${icon("info")}${esc(o.gaps[0])}</span></p>`}
    <div class="nc-acts">
      ${btn(o.same ? "Plant it again" : "Plant this", { href: `#/start/${esc(o.c.id)}`, ic: "sprout" })}
      <button type="button" class="btn secondary" data-sheet="${sheet(`Why ${o.c.name}?`, why)}">Why?</button>
    </div>
  </article>`;
}

/* the rain here, and in one line the ground under it: the whole environmental picture in a single card */
function nasaCard(p, h) {
  const ag = agroOf(p), months = (ag && ag.months) || [];
  if (!months.length) return "";
  const total = months.reduce((s, m) => s + (m.rain_mm || 0), 0), hi = Math.max(...months.map((m) => m.rain_mm || 0)) || 1;
  const word = h ? ({ low: "low", medium: "medium", high: "high" }[(h.erosion && h.erosion.band) || ""] || null) : null;
  return `<div class="nasa">
    <div class="nasa-h">${icon("satellite")}<b>Rain here, from NASA</b></div>
    ${monthBars(months.map((m) => ({ v: (m.rain_mm || 0) / hi, cls: m.lgp ? "g" : "r" })), { caption: `Usual rain each month · about ${fmt(total)} mm a year`, legend: [["g", "Wet months"], ["r", "Dry months"]] })}
    ${h ? `<p class="ground-line">${icon("map-pin")}Ground: ${h.slope_pct}% slope, ${coverWord(h)} cover${word ? `, erosion risk <b>${word}</b>` : ""}</p>` : ""}
    <p class="nasa-src">NASA POWER daily rain 1991–2025 at this point${h ? "; slope from a 3×3 elevation sample, cover from MODIS" : ""}. A screening for comparing towns, not a soil test.</p>
  </div>`;
}

/* every control in one sheet: the rain she is planning for, what limits her, and her soil */
function tuneSheet(p, soil, lim, rain) {
  const auto = soilFor(p);
  const html = `<div class="stack">
    <p class="pick-h">Rain this season</p>
    <div class="pick">${RAIN_PLANS.map((x) => `<button type="button" class="pickrow${x.id === rain ? " on" : ""}" data-scen="${x.id}">${icon("cloud-rain")}<span><b>${x.label}</b><small>${x.line}</small></span></button>`).join("")}</div>
    <p class="pick-h">What limits you this season?</p>
    <div class="pick">${LIMITS.map((x) => `<button type="button" class="pickrow${x.id === lim ? " on" : ""}" data-limit="${x.id}">${icon(x.ic)}<span><b>${x.label}</b><small>${x.line}</small></span></button>`).join("")}</div>
    <p class="pick-h">What is your soil like when you squeeze a handful?</p>
    <div class="pick">${SOILS.map((x) => `<button type="button" class="pickrow${x.id === soil ? " on" : ""}" data-soil="${x.id}">${icon("droplets")}<span><b>${x.label}</b><small>${x.feel}</small></span></button>`).join("")}</div>
    <p class="note-text">${esc(auto.note)} Walo starts from that and you can correct it any time.</p>
  </div>`;
  return { title: "Change what Walo goes by", html, onOpen: (b) => b.addEventListener("click", (e) => {
    const rs = e.target.closest("[data-scen]");
    if (rs) { setRainPlan(rs.dataset.scen); closeSheet(true); return; }
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
  const autoSoil = soilFor(p), soil = soilChoice() || autoSoil.id;
  const lim = limit(), rain = rainPlan(), pass = PASS_AT[lim] ?? PASS_AT.none;
  const { options, health, anyPass } = rotationOptions(after.id, p, { soil, limit: lim, rain });
  if (!options.length) return emptyState({ ic: "sprout", title: `No crops to follow ${after.name.toLowerCase()} here`, sub: "Walo has no other crop for this place yet.", action: "Try another place", href: "#/welcome" });
  const top = options[0], others = options.slice(1), tune = tuneSheet(p, soil, lim, rain), plan = rainOf(rain);
  const when = pr ? `Your ${after.name.toLowerCase()} comes off around ${monthName(pr.harvest.getMonth() + 1)}. ` : "";
  const headline = top.same ? `Keep ${after.name.toLowerCase()} in this field` : `Plant ${top.c.name.toLowerCase()} after your ${after.name.toLowerCase()}`;
  const sub = `${when}${top.reasons[0] || ""}${top.reasons[1] ? ` ${top.reasons[1]}` : ""}`;
  const why = whyBody(
    [
      "Walo does not add up a secret score. It asks three things in order: can the rain carry this crop (NASA rain through the FAO-56 water balance, after your soil has taken its share); what does it leave in the soil (a legume, ground cover, or the same family and its pests again); and does it break a pest cycle or continue one. Money is shown on each card and never counted in that order.",
      `Right now: ${plan.label.toLowerCase()} (${plan.line}), ${limitOf(lim).label.toLowerCase()}, ${soilLabel(soil)} ground. Change any of them and the order follows that same rule.`,
    ],
    [
      `NASA POWER daily rain and temperature 1991–2025 at ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°; FAO-56 stage lengths and crop coefficients; EcoCrop temperature limits.`,
      health ? `Ground: slope from a 3×3 elevation sample, cover from ${health.cover_src || "satellite data"}, erosion band from slope × rain × cover. It compares towns; it is not a soil test on your field.` : "",
      `Soil water holding: ${autoSoil.source || "zone soil"}${soilChoice() ? ", corrected by you" : ""}.`,
      "Crop rotation traits for nitrogen, cover and family come from the IITA and MoFA guides cited per crop; the price pattern from WFP and MoFA records, shown but not scored.",
    ].filter(Boolean),
  );
  return `${hero({ img: CFG().photos.home.img, pos: CFG().photos.home.pos, eyeIcon: "refresh-cw", eyebrow: `${esc(after.name)} · ${esc(placeLabel(p))}`, title: after.name === "Maize" ? "After the maize" : `After the ${after.name.toLowerCase()}` })}
  <div class="stack lift">
    ${answer({ kind: top.same || !anyPass ? "info" : "now", tone: top.same || !anyPass ? "info" : "good", ic: "refresh-cw", title: esc(headline), sub: esc(sub), why: { title: "How Walo chose", html: why }, say: `${headline}. ${sub}` })}
    ${nasaCard(p, health)}
    ${!anyPass ? note(`With ${plan.label.toLowerCase()}, no crop here is both carried by the rain and kinder to the soil. What is left is ordered below, and each card says what it costs.`, "triangle-alert") : ""}
    ${optionCard(top, pass, { lead: true })}
    ${others.length ? `<details class="more">
      <summary>${icon("chevron-down")}<span>Compare with ${others.length} other ${others.length === 1 ? "crop" : "crops"}, including ${esc(after.name.toLowerCase())} again</span></summary>
      <div class="more-body">${others.map((o) => optionCard(o, pass)).join("")}</div>
    </details>` : ""}
    <button type="button" class="tune" data-sheet="${sheet(tune.title, tune.html, tune.onOpen)}">
      ${icon("leaf")}<span><b>Change what Walo goes by</b><small>${esc(limitOf(lim).label)} · ${esc(soilLabel(soil))} ground · ${esc(plan.label.toLowerCase())}</small></span>${icon("chevron-right")}
    </button>
    <div class="fb" data-fb-crop="${esc(after.id)}">
      <p>Did this help you decide?</p>
      <div class="fb-btns"><button type="button" class="btn secondary" data-fb="yes">Yes</button><button type="button" class="btn secondary" data-fb="no">No</button></div>
    </div>
    ${note("Walo compares what each crop does to the soil and the rain. You decide what fits your farm, and a local extension officer can check what the data cannot see.", "info")}
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
