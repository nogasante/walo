/* Crop rotation: what to put in the field after this crop, and why. This is the Field Shift question.
   There is no hidden weighted score. A crop gets through in a fixed, explainable order:

     1. Can the rain carry it?  NASA POWER rain for its season, through the FAO-56 water balance, scaled by how this
        soil holds water and by the season she is planning for (less / usual / more rain). A crop the rain cannot
        carry is still shown, at the bottom, labelled "needs water" — never silently deleted.
     2. What does it do to the soil?  Counted in plain points, not fractions: a legume adds nitrogen (+2), a crop that
        covers the ground adds up to +2, cover counts for more where the ground can wash (+1), and where organic
        matter looks low a legume or a full cover counts once more (+1). The same family as the crop already in the
        field costs 3, because its pests and its nutrients come back. Nothing here is multiplied by a weight.
     3. Does it break a cycle or continue one?  Following a cereal with another family is stated as a reason; following
        it with the same family is stated as a risk.
     4. Money is shown, never counted.  The usual price pattern is a note on the card. Only her own "cash is tight"
        limit uses it, and then only to put quicker crops first among those the rain already passes.

   The traits come from extension guides (cited per crop in data/crops.json and listed in About); the rain, heat and
   slope come from NASA POWER, MODIS NDVI and a DEM sample; the price pattern from WFP/MoFA. Nothing here measured
   her field, and every card says what is missing. */
import { crop, cropsHere, scoreCrop, sellAdvice, isTree, monthName, soilHealthFor, cropDays } from "./data.js";

/* what limits her this season. "none" is the default because the challenge is about the environment, not about
   picking a favourite: the soil and the rain decide unless she says otherwise. */
export const LIMITS = [
  { id: "none", label: "Nothing special", ic: "sprout", line: "Let the rain and the soil decide" },
  { id: "water", label: "Water is short", ic: "droplets", line: "Only crops the rain can carry" },
  { id: "cash", label: "Cash is tight", ic: "tag", line: "Quickest to harvest first" },
];
/* the season she is planning for: three positions, no invented forecast. factor scales the usual rain. */
export const RAIN_PLANS = [
  { id: "less", label: "Less rain", factor: 0.8, line: "one year in five is this dry" },
  { id: "usual", label: "Usual rain", factor: 1, line: "the long-run average" },
  { id: "more", label: "More rain", factor: 1.2, line: "one year in five is this wet" },
];
/* what her soil does with water: sandy lets it through, clay holds it */
export const SOILS = [
  { id: "sandy", label: "Sandy", holds: 0.9, plain: "water runs through it fast", feel: "Gritty. Squeezed in your hand it falls apart." },
  { id: "loam", label: "Loamy", holds: 1, plain: "holds water well", feel: "Dark and crumbly. It holds together when squeezed, then breaks." },
  { id: "clay", label: "Clay", holds: 1.08, plain: "holds water and stays put", feel: "Sticky and heavy. It stays in a ball when squeezed." },
];
const soilOf = (id) => SOILS.find((s) => s.id === id) || SOILS[1];
const rainOf = (id) => RAIN_PLANS.find((r) => r.id === id) || RAIN_PLANS[1];
const FAMILY = { cereal: "cereal", legume: "legume", root: "root crop", vegetable: "vegetable", tree: "tree" };
export const familyWord = (f) => FAMILY[f] || "crop";

const PASS = { none: 60, water: 80, cash: 60 }; // the share of its water need the rain must cover to lead the list

/* how the rain stands against one crop's need, for this soil and this plan */
function waterFor(c, after, p, soil, rainFactor) {
  const sc = scoreCrop(c, p), fit = sc.fit;
  const need = fit && fit.need_mm ? Math.round(fit.need_mm) : null;
  const usual = fit && fit.peff_mm != null ? Math.round(fit.peff_mm) : null;
  if (need == null || usual == null) return { need, usual, rain: null, pct: null, deficit: 0, usable: null, water: sc.water };
  const rain = Math.round(usual * rainFactor);              // the same NASA rain, for a wetter or drier year
  const usable = Math.round(rain * soilOf(soil).holds);     // and what this soil lets the crop have of it
  return {
    need, usual, rain, usable, water: sc.water, fit,
    pct: Math.round((usable / need) * 100),
    deficit: Math.max(0, need - usable),
  };
}

/* soil benefit in points she could count on her fingers, with the reasons that produced them */
function soilPoints(c, after, health) {
  const r = c.rotation, ar = (after && after.rotation) || {};
  const same = ar.family && ar.family === r.family;
  const erosion = health && health.erosion && health.erosion.band === "high";
  const omLow = health && health.om && health.om.band === "low";
  const why = [];
  let pts = 0;
  if (r.n_fix) { pts += 2; why.push("It is a legume, so it puts nitrogen back into the soil."); }
  if (r.cover >= 3) { pts += 2; why.push("It keeps the ground covered, so rain cannot wash the soil away."); }
  else if (r.cover === 2) { pts += 1; why.push("It leaves some stems and leaves on the field to hold the soil."); }
  if (erosion && r.cover >= 2) { pts += 1; why.push("The ground here can wash, so cover counts for more."); }
  if (omLow && (r.n_fix || r.cover === 3)) { pts += 1; why.push("Organic matter looks low here, so what it leaves behind matters more."); }
  if (same) { pts -= 3; }
  else if (ar.family === "cereal" && r.family !== "cereal") why.push(`It is a ${familyWord(r.family)} after a cereal, which breaks the cereal's pest cycle.`);
  if (ar.n_fix && r.family === "cereal") { pts += 1; why.push("It follows a legume, so some nitrogen is already in the soil."); }
  return { pts, why, same, erosion, omLow };
}

/* one option, with everything the card shows and everything it admits it does not know */
function buildOption(c, after, p, { soil, rainFactor, health, pass = 60, same = false }) {
  const r = c.rotation;
  const w = waterFor(c, after, p, soil, rainFactor);
  const sp = soilPoints(c, after, health);
  const hot = w.fit && w.fit.hot_days != null ? Math.round(w.fit.hot_days) : 0;
  const heatT = (w.fit && w.fit.heat && w.fit.heat.t) || 35;
  const sa = sellAdvice(c.id, p);
  const days = Math.round(cropDays(c));
  const reasons = same ? ["The crop you already know, in a field set up for it."] : sp.why.slice(0, 3);
  const risks = [];
  if (same) risks.push("The same crop every season brings the same pests, weeds and hungry soil back, and the ground is worked the same way.");
  if (w.pct != null && w.pct < pass) risks.push(`The rain here covers ${w.pct}% of its water: the rest has to come from watering or a wetter year.`);
  const gaps = [
    "The crop traits are rules of thumb from extension guides, not a soil test on your field.",
    "Rain is a NASA POWER grid of about 50 km, not a gauge in your field.",
    sa.kind === "index" ? `The price pattern is from ${(sa.years && sa.years[sa.years.length - 1]) || "the last recorded years"}, before this season.` : "No price pattern here, so money is not part of this card.",
  ];
  // one sentence a person can read at a glance: the good thing, then the cost, said as one thought
  const good = [], cost = [];
  if (w.pct != null) (w.pct >= 80 ? good : cost).push(w.pct >= 80 ? "the rain carries it" : `the rain covers ${w.pct}% of its water`);
  if (r.n_fix) good.push("it adds nitrogen");
  else if (r.cover >= 3) good.push("it covers the ground");
  else if (r.cover === 1) cost.push("it leaves the ground bare");
  if (same) cost.push("it is the same family as now, so its pests come back");
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const oneLine = good.length && cost.length ? `${cap(good[0])}, but ${cost[0]}.`
    : good.length ? `${cap(good.join(" and "))}.`
    : cost.length ? `${cap(cost.join(", and "))}.` : "No clear benefit or cost for your soil.";
  return {
    c, r, same, sa, days, hot, heatT, oneLine,
    need: w.need, peff: w.usable, usualRain: w.usual, rainPct: w.pct,
    deficit: w.deficit, waterPct: w.pct,
    soilPts: sp.pts, erosion: sp.erosion, omLow: sp.omLow,
    reasons, risks: risks.slice(0, 2), gaps: gaps.slice(0, 2),
  };
}

/* the options for a field, ordered by the fixed rule above and nothing else */
export function rotationOptions(afterId, p, { soil = "loam", limit = "none", rain = "usual", max = 4 } = {}) {
  const after = crop(afterId);
  if (!after) return { after: null, options: [], health: null };
  const health = soilHealthFor(p);
  const rainFactor = rainOf(rain).factor;
  const pass = PASS[limit] || PASS.none;
  const opts = { soil, rainFactor, health, pass };
  const list = cropsHere(p).filter((c) => !isTree(c) && c.rotation && c.id !== afterId).map((c) => buildOption(c, after, p, opts));
  // "the crop you already know" is always on the list, so the alternative is compared with what she grows now
  const again = buildOption(after, after, p, { ...opts, same: true });
  again.reasons = ["The crop you already know, in a field set up for it."];
  again.risks = ["The same crop every season brings the same pests, weeds and hungry soil back.", ...again.risks].slice(0, 2);

  // 0 = the rain can carry it, 1 = Walo does not judge its water (a long season), 2 = it needs water. A crop
  // without a water verdict never leads a water-short season just because nothing was measured.
  const wRank = (o) => (o.waterPct == null ? (limit === "water" ? 2 : 1) : o.waterPct < pass ? 2 : 0);
  const order = (a, b) =>
    wRank(a) - wRank(b) ||                            // the rain can carry it, or it cannot
    b.soilPts - a.soilPts ||                          // then what it does to the soil
    (limit === "cash" ? a.days - b.days : 0) ||       // only her "cash is tight" limit looks at speed
    (b.waterPct || 0) - (a.waterPct || 0) ||          // then the drier the better
    a.c.name.localeCompare(b.c.name);

  const all = list.sort(order);
  const chosen = all.filter((o) => o.c.id !== afterId).slice(0, max);
  chosen.push(again);
  // "the crop you already know" is the baseline, never the recommendation: it is always last, so a field is never
  // told to repeat itself just because the rain happens to suit the crop that is already there.
  chosen.sort((a, b) => Number(a.same) - Number(b.same) || order(a, b));
  return { after, options: chosen, health, rainFactor, limit, soil, anyPass: chosen.some((o) => !o.same && o.waterPct != null && o.waterPct >= pass) };
}

/* the chip says one true thing about the soil, never a verdict on the whole crop: "Best for soil" read as "best
   overall", which the water line under it might contradict. Water gets its own chip only when it fails. */
export function fitChip(o, pass = 60) {
  if (o.waterPct != null && o.waterPct < pass) return { kind: "bad", text: "Needs water" };
  if (o.soilPts >= 4) return { kind: "good", text: "Adds most to soil" };
  if (o.soilPts >= 2) return { kind: "good", text: "Adds to soil" };
  if (o.soilPts >= 0) return { kind: "wait", text: "Little back" };
  return { kind: "bad", text: "Takes from soil" };
}
export const PASS_AT = PASS;
