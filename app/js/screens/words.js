/* Plain words for answers, shared by the screens (and read aloud). */
import { online } from "../net.js";
import { R, agroOf, CFG, zoneName } from "../data.js";
import { weekday, dayMonth, doyText, MONTHS_LONG, fmt, esc } from "../util.js";
import { monthBars } from "../ui.js";

export function statusLine(st) {
  switch (st.kind) {
    case "now": return st.rainDate ? `Plant after the rain on ${weekday(st.rainDate)}` : "Plant now, after a good rain";
    case "wait": return "Wait: rain not here yet";
    case "water": return "Only if you can water";
    case "later": return `Plant in ${MONTHS_LONG[st.month - 1]}`;
    default: return "No good month here";
  }
}
/* short "when" under a small crop tile, by group */
export function whenShort(x, g) {
  if (g.key === "no") return "Grows poorly here";
  if (x.st.kind === "later") return MONTHS_LONG[x.st.month - 1];
  return { now: "Now", water: "With water", wait: "When rain comes" }[x.st.kind] || "";
}
export const onsetRule = () => { const O = R().onset; return `at least ${O.rain_mm} mm of rain within ${O.rain_days} days, with no dry spell longer than ${O.dry_spell_max_days} days in the next ${O.check_days} (Sivakumar 1988)`; };
/* details lines about the rains and the forecast, for Why? sheets */
export function rainDetails(p, st) {
  const ag = agroOf(p), out = [];
  ["major", "minor"].forEach((s) => { const o = ag.onset[s]; if (o && o.median != null) out.push(`${s === "major" ? "Main" : "Second"} rains usually start ${doyText(o.median)} (2 years in 10 by ${doyText(o.p20)}, 8 in 10 by ${doyText(o.p80)}). NASA POWER daily rain ${ag.years.join("-")}.`); });
  out.push(`Planting rain = ${onsetRule()}.`);
  if (st && st.fo) out.push(`${esc(CFG().forecast.label)} forecast, next ${st.fo.days} days: ${fmt(st.fo.total)} mm${st.fo.date ? `; ${st.fo.mm} mm in ${R().onset.rain_days} days from ${dayMonth(st.fo.date)}` : ", no planting rain"}.`);
  else out.push(online() ? "No forecast right now, so Walɔ used the usual start of the rains." : "Using usual weather (no forecast offline).");
  if (p.zone) out.push(`FAO agro-ecological zone: ${esc(zoneName(p.zone))}.`);
  if (p.kind === "gps") out.push(`NASA POWER for your location (${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}), ${CFG().periods.live.join("-")}.`);
  return out;
}
export const yearsOf = (p) => { const y = agroOf(p).years; return y[1] - y[0] + 1; };
/* rain by month as small bars. Without a crop: green = growing-season month (rain at least half of what dries off, FAO AEZ), red = dry.
   With a crop's planting months: green = a planting month, grey = other months. */
export function rainStrip(p, sow = null) {
  const ms = agroOf(p).months, max = Math.max(...ms.map((m) => m.rain_mm)) || 1;
  const bars = ms.map((m, i) => ({ v: m.rain_mm / max, cls: sow ? (sow.includes(i + 1) ? "g" : "n") : m.lgp ? "g" : "r" }));
  return monthBars(bars, sow
    ? { caption: "Usual rain", legend: [["g", "Planting months"], ["cur", "This month"]] }
    : { caption: "Usual rain", legend: [["g", "Wet months"], ["r", "Dry months"], ["cur", "This month"]] });
}
