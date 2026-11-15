/* After this crop: the Field Shift answer. One recommendation, the evidence for it, and a comparison she can read
   at a glance, not the same wall of cards behind a tap.

   On the screen: the answer, the NASA rain picture (ground facts in one line), one card for the recommended crop,
   then a list of the other crops where each is a single sentence, and one row to change what Walɔ goes by.
   The sheet behind that row asks one question at a time: rain, limit, soil, three taps, never nine options at once.
   Nothing in the reasoning was cut; it is the reading that got smaller. */
import { place, placeLabel, limit, setLimit, soilChoice, setSoilChoice, farm } from "../store.js";
import { crop, farmPlace, farmProgress, monthName, soilFor, scoreCrop, agroOf, rainPlanFor, CFG } from "../data.js";
import { rotationOptions, LIMITS, RAIN_PLANS, SOILS, fitChip, PASS_AT } from "../rotation.js";
import { answer, whyBody, btn, note, hero, emptyState, icon, sheet, closeSheet, monthBars } from "../ui.js";
import { esc, fmt } from "../util.js";

export const title = (id) => { const c = crop(id); return c ? `After ${c.name.toLowerCase()}` : "After this crop"; };

let PLACE_NOW = null;
const placeNow = () => PLACE_NOW || place();
const soilLabel = (id) => (SOILS.find((s) => s.id === id) || SOILS[1]).label.toLowerCase();
const limitOf = (id) => LIMITS.find((x) => x.id === id) || LIMITS[0];
const rainOf = (id) => RAIN_PLANS.find((x) => x.id === id) || RAIN_PLANS[1];
const coverWord = (h) => ((h.ndvi_peak || 0) >= 0.45 ? "thick" : (h.ndvi_peak || 0) >= 0.3 ? "patchy" : "thin");

/* the water line: NASA rain against what this crop needs, after this soil has taken its share */
function waterLine(o) {
  if (o.waterPct == null) return `<p class="wline small"><span>${icon("droplets")}Walɔ has no water balance for this crop yet.</span></p>`;
  const tone = o.waterPct >= 80 ? "good" : o.waterPct >= 60 ? "wait" : "bad";
  const enough = o.waterPct >= 100;
  return `<div class="wline"><div class="wline-h"><span>${icon("cloud-rain")}${enough ? "The rain covers all the water it needs" : `The rain covers ${o.waterPct}% of the water it needs`}</span><small>${fmt(o.peff)} of ${fmt(o.need)} mm</small></div>
    <div class="nbar ${tone}"><i style="width:${Math.max(4, Math.min(100, o.waterPct))}%"></i></div></div>`;
}
/* the one extra fact worth a line on the lead card: what the field gives back after harvest */
function sideFact(o) {
  const f = o.r && o.r.forage;
  if (f) return `<p class="wline small"><span>${icon("wheat")}${esc(f.line)}</span></p>`;
  if (o.hot >= 6) return `<p class="wline small"><span>${icon("thermometer-sun")}About ${o.hot} days above ${o.heatT} °C while it flowers</span></p>`;
  return "";
}

/* everything Walɔ knows about one crop, in the sheet, this is where the detail is allowed to live */
function whyFor(o) {
  const fit = scoreCrop(o.c, placeNow()).fit || {}, sa = o.sa || {};
  return whyBody(
    [
      o.same ? `This is what grows in the field now, so it is the one to beat. ${(o.r && o.r.role) || ""}.` : (o.r && o.r.role ? `${o.r.role}.` : ""),
      ...o.reasons.slice(0, 3),
      o.r && o.r.forage ? `Livestock: ${o.r.forage.line}` : "",
    ].filter(Boolean),
    [
      o.need != null
        ? `Water, from NASA POWER rain for this season through the FAO-56 balance: it needs about ${fmt(o.need)} mm, the usual rain gives ${fmt(o.usualRain)} mm, and after this soil holds its share that is ${fmt(o.peff)} mm (${o.waterPct}% of the need). WRSI ${fit.wrsi ?? "not judged"}.`
        : "A long-season crop: Walɔ does not judge its water against one rainy season.",
      `Soil benefit: ${o.soilPts > 0 ? `+${o.soilPts}` : o.soilPts} point${Math.abs(o.soilPts) === 1 ? "" : "s"}, counted not weighted, a legume, ground cover, whether it is the same family, and whether the ground here can wash.`,
      o.hot ? `About ${o.hot} days above ${o.heatT} °C usually fall while it flowers.` : "",
      sa.kind === "index" ? (sa.store ? `Prices usually rise by ${monthName(sa.store.month)}, so it can be stored. Shown here, never counted in the order.` : "Prices do not usually rise much after harvest. Shown here, never counted in the order.")
        : sa.kind === "spot" ? `Sold at ${sa.spot.market} market${sa.spot.km != null ? `, ${fmt(sa.spot.km)} km away` : ""}. Shown here, never counted.` : "No price record here, so money plays no part.",
      o.r && o.r.src ? `Crop traits: ${o.r.src} (guides listed in About). Rules of thumb, not measurements of your field.` : "Crop traits are extension rules of thumb; rain, heat and slope come from NASA POWER, MODIS and a DEM sample.",
      ...o.gaps.map((g) => `What Walɔ does not know: ${g}`),
    ].filter(Boolean),
  );
}

/* the recommended crop: photo, chip, the water bar, one fact, two buttons. That is the whole card. */
function leadCard(o, pass) {
  const chip = fitChip(o, pass);
  return `<article class="nextcard lead">
    <div class="nc-top">
      ${o.c.img ? `<img class="nc-img" src="${esc(o.c.img)}" alt="" loading="lazy" style="object-position:${esc(o.c.pos || "50% 50%")}">` : ""}
      <div class="nc-t"><b>${esc(o.c.name)}</b><small>${esc((o.r && o.r.role) || "")}</small></div>
      <span class="chip ${chip.kind}">${chip.text}</span>
    </div>
    ${waterLine(o)}
    ${sideFact(o)}
    <div class="nc-acts">
      ${btn("Plant this", { href: `#/start/${esc(o.c.id)}`, ic: "sprout" })}
      <button type="button" class="btn secondary" data-sheet="${sheet(`Why ${o.c.name}?`, whyFor(o))}">Why?</button>
    </div>
  </article>`;
}

/* the alternatives: one row each, one sentence each. Tap a row for the full case. */
function compareRows(list, pass) {
  return list.map((o) => {
    const chip = fitChip(o, pass);
    return `<button type="button" class="cmprow" data-sheet="${sheet(`Why ${o.c.name}?`, whyFor(o))}">
      <span class="cmp-t"><b>${esc(o.same ? `${o.c.name} again` : o.c.name)}</b><small>${esc(o.oneLine)}</small></span>
      <span class="chip ${chip.kind}">${chip.text}</span>${icon("chevron-right")}
    </button>`;
  }).join("");
}

/* the rain here, and in one line the ground under it: the environmental picture in a single card */
function nasaCard(p, h, plan) {
  const ag = agroOf(p), months = (ag && ag.months) || [];
  if (!months.length) return "";
  const total = months.reduce((s, m) => s + (m.rain_mm || 0), 0), hi = Math.max(...months.map((m) => m.rain_mm || 0)) || 1;
  const word = h ? ({ low: "low", medium: "medium", high: "high" }[(h.erosion && h.erosion.band) || ""] || null) : null;
  return `<div class="nasa">
    <div class="nasa-h">${icon("satellite")}<b>Rain here, from NASA</b></div>
    ${monthBars(months.map((m) => ({ v: (m.rain_mm || 0) / hi, cls: m.lgp ? "g" : "r" })), { caption: `Wet months in green · about ${fmt(total)} mm a year`, legend: [] })}
    <p class="ground-line">${icon("refresh-cw")}${esc(plan.note)}</p>
    ${h ? `<p class="ground-line">${icon("map-pin")}Ground: ${h.slope_pct}% slope, ${coverWord(h)} cover${word ? `, erosion risk <b>${word}</b>` : ""}</p>` : ""}
    <p class="nasa-src">NASA POWER, 1991-2025${h ? " · slope from a 3×3 elevation sample · cover from MODIS" : ""}</p>
  </div>`;
}

/* one question at a time, three questions, then it closes and the screen has changed. Nothing is applied until
   she finishes, so a half-finished sheet never leaves the screen in a state she did not ask for. */
function tuneSheet(p, soil, lim) {
  const auto = soilFor(p);
  let i = 0;
  const pick = { limit: lim, soil };
  const steps = [
    { q: "Your soil, in your hand", sub: `${auto.note} Walɔ already assumes that; change it only if you know better.`, attr: "data-soil", value: pick.soil, rows: SOILS.map((x) => ({ id: x.id, ic: "droplets", label: x.label, line: x.feel })) },
    { q: "Anything limiting you this season?", sub: "Optional. Walɔ has already planned the rain from your town's record.", attr: "data-limit", value: pick.limit, rows: LIMITS.map((x) => ({ id: x.id, ic: x.ic, label: x.label, line: x.line })) },
  ];
  const html = (k) => {
    const st = steps[k];
    return `<div class="stack">
      <p class="step-n">Question ${k + 1} of ${steps.length}</p>
      <p class="pick-h">${esc(st.q)}</p>
      ${st.sub ? `<p class="note-text">${esc(st.sub)}</p>` : ""}
      <div class="pick">${st.rows.map((x) => `<button type="button" class="pickrow${x.id === st.value ? " on" : ""}" ${st.attr}="${x.id}">${icon(x.ic)}<span><b>${esc(x.label)}</b><small>${esc(x.line)}</small></span></button>`).join("")}</div>
    </div>`;
  };
  return {
    title: "Your soil, and your season",
    html: html(0),
    onOpen: (b) => b.addEventListener("click", (e) => {
      const r = e.target.closest("[data-soil],[data-limit]");
      if (!r) return;
      if (r.dataset.soil) pick.soil = r.dataset.soil;
      else pick.limit = r.dataset.limit;
      if (i + 1 < steps.length) { i++; b.innerHTML = html(i); return; }
      setSoilChoice(pick.soil); setLimit(pick.limit);
      closeSheet(true);
    }),
  };
}

export function render(id, fid) {
  const after = crop(id);
  const f = fid ? farm(fid) : null;
  if (!after) return emptyState({ ic: "sprout", title: "Pick the crop in the field first", sub: "Walɔ needs to know what is growing to say what should follow it.", action: "My fields", href: "#/farm" });
  if (!after.rotation) return emptyState({ ic: "sprout", title: `Walɔ has no rotation notes for ${after.name.toLowerCase()}`, sub: "That crop is not in the rotation guides yet, so Walɔ will not guess what follows it.", action: "My fields", href: "#/farm" });
  const p = f ? farmPlace(f) : place();
  PLACE_NOW = p;
  const pr = f ? farmProgress(f) : null;
  const autoSoil = soilFor(p), soil = soilChoice() || autoSoil.id;
  const lim = limit(), derived = rainPlanFor(p), rain = derived.id, pass = PASS_AT[lim] ?? PASS_AT.none;
  const { options, health, anyPass } = rotationOptions(after.id, p, { soil, limit: lim, rain });
  if (!options.length) return emptyState({ ic: "sprout", title: `No crops to follow ${after.name.toLowerCase()} here`, sub: "Walɔ has no other crop for this place yet.", action: "Try another place", href: "#/welcome" });
  const top = options[0], others = options.slice(1), tune = tuneSheet(p, soil, lim), plan = rainOf(rain);
  const when = pr ? `Your ${after.name.toLowerCase()} comes off around ${monthName(pr.harvest.getMonth() + 1)}. ` : "";
  const headline = top.same ? `Keep ${after.name.toLowerCase()} in this field` : `Plant ${top.c.name.toLowerCase()} after your ${after.name.toLowerCase()}`;
  const sub = `${when}${top.reasons[0] || ""}${top.reasons[1] ? ` ${top.reasons[1]}` : ""}`;
  const why = whyBody(
    [
      "Walɔ does not add up a secret score. It asks three things in order: can the rain carry this crop (NASA rain through the FAO-56 water balance, after your soil has taken its share); what does it leave in the soil (a legume, ground cover, or the same family and its pests again); and does it break a pest cycle or continue one. Money is shown and never counted.",
      `Rain planned: ${plan.label.toLowerCase()}, ${derived.note} Soil: ${soilLabel(soil)}. ${limitOf(lim).label}.`,
    ],
    [
      `NASA POWER daily rain and temperature 1991-2025 at ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°; FAO-56 stage lengths and crop coefficients; EcoCrop temperature limits.`,
      health ? `Ground: slope from a 3×3 elevation sample, cover from ${health.cover_src || "satellite data"}, erosion band from slope × rain × cover. It compares towns; it is not a soil test on your field.` : "",
      `Soil water holding: ${autoSoil.source || "zone soil"}${soilChoice() ? ", corrected by you" : ""}.`,
      "Crop rotation traits for nitrogen, cover and family come from the IITA and MoFA guides cited per crop; the price pattern from WFP and MoFA records, shown but not scored.",
    ].filter(Boolean),
  );
  return `${hero({ img: CFG().photos.home.img, pos: CFG().photos.home.pos, eyeIcon: "refresh-cw", eyebrow: `${esc(after.name)} · ${esc(placeLabel(p))}`, title: after.name === "Maize" ? "After the maize" : `After the ${after.name.toLowerCase()}` })}
  <div class="stack lift">
    ${answer({ kind: top.same || !anyPass ? "info" : "now", tone: top.same || !anyPass ? "info" : "good", ic: "refresh-cw", title: esc(headline), sub: esc(sub), why: { title: "How Walɔ chose", html: why }, say: `${headline}. ${sub}` })}
    ${nasaCard(p, health, derived)}
    ${!anyPass ? note(`With ${plan.label.toLowerCase()}, no crop here is both carried by the rain and kinder to the soil. What is left is below, and each row says what it costs.`, "triangle-alert") : ""}
    ${leadCard(top, pass)}
    ${others.length ? `<div class="cmp"><p class="cmp-h">What else could follow it</p>${compareRows(others, pass)}</div>` : ""}
    <button type="button" class="tune" data-sheet="${sheet(tune.title, tune.html, tune.onOpen)}">
      ${icon("leaf")}<span><b>Your soil, and your season</b><small>${esc(soilLabel(soil))} ground${lim === "none" ? "" : ` · ${esc(limitOf(lim).label.toLowerCase())}`}</small></span>${icon("chevron-right")}
    </button>
    <div class="fb" data-fb-crop="${esc(after.id)}">
      <p>Did this help you decide?</p>
      <div class="fb-btns"><button type="button" class="btn secondary" data-fb="yes">Yes</button><button type="button" class="btn secondary" data-fb="no">No</button></div>
    </div>
    ${f ? btn("Back to the field", { href: `#/farm/${esc(f.id)}`, kind: "secondary", ic: "sprout" }) : ""}
  </div>`;
}

export function mount(root) {
  root.addEventListener("click", (e) => {
    const fb = e.target.closest("[data-fb]");
    if (!fb) return;
    const box = fb.closest("[data-fb-crop]"), vote = fb.dataset.fb;
    try { fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ev: "rot_help", owner: "next", kind: vote, type: box ? box.dataset.fbCrop : "" }) }).catch(() => {}); } catch { /* offline is fine */ }
    if (box) box.innerHTML = `<p class="fb-done">${icon("circle-check")}<span>Thank you. Walɔ counts these to know if the advice is useful.</span></p>`;
  });
}
