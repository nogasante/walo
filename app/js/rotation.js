/* Crop rotation: what to put in the field after this crop, and why. This is the Field Shift question.
   Every number comes from what Walo already holds: NASA POWER rain and the FAO-56 water balance (scoreCrop),
   the crop traits in data/crops.json (rotation: family, n_fix, cover, water), the usual price pattern (sellAdvice),
   and her own priority. The traits are extension rules of thumb, never measured here, and the Why? says so. */
import { crop, cropsHere, scoreCrop, sellAdvice, isTree } from "./data.js";

export const PRIORITIES = [
  { id: "soil", label: "Soil", ic: "sprout", line: "Leave the soil better" },
  { id: "water", label: "Water", ic: "droplets", line: "Use less water" },
  { id: "money", label: "Money", ic: "tag", line: "Earn more from it" },
];
/* what her soil does with water: sandy lets it through, clay holds it and washes less */
export const SOILS = [
  { id: "sandy", label: "Sandy", holds: 0.9, washes: 1.15, plain: "water runs through it fast" },
  { id: "loam", label: "Loam", holds: 1, washes: 1, plain: "holds water well" },
  { id: "clay", label: "Clay", holds: 1.08, washes: 0.85, plain: "holds water and resists washing away" },
];
const W = {
  soil: { water: 0.2, soil: 0.45, money: 0.15, risk: 0.2 },
  water: { water: 0.5, soil: 0.2, money: 0.1, risk: 0.2 },
  money: { water: 0.2, soil: 0.2, money: 0.45, risk: 0.15 },
};
const clamp = (v) => Math.max(0, Math.min(1, v));
const soilOf = (id) => SOILS.find((s) => s.id === id) || SOILS[1];
const FAMILY = { cereal: "cereal", legume: "legume", root: "root crop", vegetable: "vegetable", tree: "tree" };
export const familyWord = (f) => FAMILY[f] || "crop";
/* the same crop is always offered, so "maize again" is compared with the alternatives and not hidden */
export function rotationOptions(afterId, p, { soil = "loam", priority = "soil", limit = 4 } = {}) {
  const after = crop(afterId);
  if (!after) return { after: null, options: [] };
  const ar = after.rotation || { family: "other", n_fix: false, cover: 2, water: 2 };
  const w = W[priority] || W.soil, so = soilOf(soil);
  const list = cropsHere(p).filter((c) => !isTree(c) && c.rotation && c.id !== afterId);
  const score1 = (c) => {
    const r = c.rotation, sc = scoreCrop(c, p), fit = sc.fit;
    const need = fit && fit.need_mm, def = (fit && fit.deficit_mm) || 0;
    const deficit = need ? clamp(def / need) : 0;
    // water: the share of its season need the usual rain covers, allowing for how this soil holds water
    const water = sc.water ? clamp(1 - deficit * (0.55 + 0.45 * (r.water / 3)) * (2 - so.holds)) : 0.6;
    const hot = fit && fit.hot_days != null ? fit.hot_days : 0;
    const risk = clamp(1 - hot / 20); // very hot days at flowering
    const same = r.family && ar.family === r.family;
    let soilScore = 0.5 + (r.n_fix ? 0.2 : 0) + (r.cover - 2) * 0.09;
    if (same) soilScore -= ar.family === "cereal" ? 0.28 : 0.18; // family pests and the same nutrients come back
    if (ar.n_fix && r.family === "cereal") soilScore += 0.12; // it follows a legume, so some nitrogen is already there
    soilScore = clamp(soilScore * so.washes);
    const sa = sellAdvice(c.id, p);
    const money = sa.kind === "index" ? (sa.store ? 0.9 : 0.72) : sa.kind === "spot" ? 0.55 : 0.35;
    const total = w.water * water + w.soil * soilScore + w.money * money + w.risk * risk;
    const reasons = [], risks = [];
    if (r.n_fix) reasons.push(`Puts nitrogen back in the soil after the ${after.name.toLowerCase()}.`);
    if (r.cover >= 3) reasons.push("Covers the ground, so rain does not wash the soil away.");
    else if (r.cover === 2) reasons.push("Leaves some stems and leaves on the field to hold the soil.");
    if (ar.n_fix && r.family === "cereal") reasons.push(`Follows a legume, which leaves nitrogen for it.`);
    if (sc.water && water >= 0.7) reasons.push("The usual rain here covers most of the water it needs.");
    if (sa.kind === "index") reasons.push(sa.store ? `Prices usually rise by ${sa.store.month ? "a later month" : "after harvest"}: it can be stored and sold later.` : "There is a usual price pattern for it near you.");
    if (deficit > 0.2) risks.push(`The usual rain here leaves it about ${Math.round(def)} mm short in the season.`);
    if (hot >= 6) risks.push(`About ${Math.round(hot)} days above ${fit.heat.t} °C usually come while it flowers.`);
    if (sa.kind === "guess") risks.push("Walo has no price pattern for it here yet.");
    return {
      c, r, pct: Math.round(total * 100), water, soilScore, money, risk, deficit, hot,
      reasons: reasons.slice(0, 3), risks: risks.slice(0, 2), same: false, sa,
    };
  };
  const all = list.map(score1);
  // "maize again": scored on its own traits, with the same-family penalty, so it can win if it truly is best
  const again = (() => {
    const sc = scoreCrop(after, p), fit = sc.fit, need = fit && fit.need_mm, def = (fit && fit.deficit_mm) || 0;
    const deficit = need ? clamp(def / need) : 0;
    const water = sc.water ? clamp(1 - deficit * (0.55 + 0.45 * (ar.water / 3)) * (2 - so.holds)) : 0.6;
    const hot = fit && fit.hot_days != null ? fit.hot_days : 0;
    const risk = clamp(1 - hot / 20);
    const soilScore = clamp((0.5 + (ar.n_fix ? 0.2 : 0) + (ar.cover - 2) * 0.09 - (ar.family === "cereal" ? 0.28 : 0.18)) * so.washes);
    const sa = sellAdvice(after.id, p);
    const money = sa.kind === "index" ? (sa.store ? 0.9 : 0.72) : sa.kind === "spot" ? 0.55 : 0.35;
    const total = w.water * water + w.soil * soilScore + w.money * money + w.risk * risk;
    const risks = [`Same crop every season: the same pests, weeds and nutrients come back, and the soil is worked the same way.`];
    if (deficit > 0.2) risks.push(`The usual rain leaves it about ${Math.round(def)} mm short.`);
    return { c: after, r: ar, pct: Math.round(total * 100), water, soilScore, money, risk, deficit, hot, reasons: [ar.role || "The crop you know."], risks, same: true, sa };
  })();
  const options = all.sort((a, b) => b.pct - a.pct).slice(0, limit);
  if (!options.some((o) => o.c.id === afterId)) options.push(again);
  return { after, options, priority, soil };
}
/* plain words for a score, so the chip never shows a bare percentage */
export const scoreChip = (pct) => (pct >= 70 ? { kind: "good", text: "Good fit" } : pct >= 50 ? { kind: "wait", text: "Can work" } : { kind: "bad", text: "Risky" });
