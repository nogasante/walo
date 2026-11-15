/* How this place is changing: the "shift" the challenge is named after, at her own point. Two periods of the same
   NASA POWER daily record (1991-2014 and 2015-2025), the same onset rule the rest of Walo uses, and the plan
   question that follows from it. Nothing here is a forecast; the Why? says exactly what it is and is not. */
import { place, placeLabel, mainCrop } from "../store.js";
import { shiftFor, crop, CFG } from "../data.js";
import { answer, whyBody, btn, note, hero, facts, emptyState } from "../ui.js";
import { esc, fmt } from "../util.js";

export const title = () => "How this place is changing";
const P = (s) => s.periods;

export function render() {
  const p = place(), s = shiftFor(p);
  if (!s) {
    return `<div class="stack">${emptyState({ ic: "satellite", title: `No long rain record for ${placeLabel(p)} yet`, sub: "Walo compares 1991–2014 with 2015–2025 at each town; this one is not built yet.", action: "See what to plant here", href: "#/now" })}</div>`;
  }
  const [e0, e1] = P(s).early, [r0, r1] = P(s).recent;
  const d = s.dOnset || 0, rp = s.rainPct, dh = s.dHot;
  const moved = Math.abs(d) >= 3 || Math.abs(rp || 0) >= 5 || Math.abs(dh || 0) >= 2;
  const headline = !moved
    ? `The season here has barely moved since ${e1}`
    : Math.abs(d) >= 3
      ? `Rain starts ${Math.abs(d)} days ${d > 0 ? "later" : "earlier"} than in ${e0}–${e1}`
      : rp <= -5 ? `The season has about ${Math.abs(rp)}% less rain than in ${e0}–${e1}`
        : `About ${Math.abs(dh)} ${dh > 0 ? "more" : "fewer"} very hot days in the season than in ${e0}–${e1}`;
  const sub = moved
    ? `Usual rain in the season is ${fmt(s.recent.season_rain)} mm now against ${fmt(s.early.season_rain)} mm, and ${fmt(s.recent.hot_days)} days above 35 °C against ${fmt(s.early.hot_days)}.`
    : "Walo compared the same 35 years of NASA rain and heat for this point in two halves.";
  const why = whyBody(
    [
      `Walo took the same NASA POWER daily record for this point and split it: ${e0}–${e1} and ${r0}–${r1}. For each year it found the day the main rains started, using the same rule it uses for planting advice (a day with rain, then 20 mm over three days, and no long dry spell after).`,
      "The figures are usual values for each period, not a trend line and not a forecast. NASA POWER gives a grid cell of roughly 50 km, so this is your area, not your field.",
    ],
    [
      `Years in each period: about ${e1 - e0 + 1} and ${r1 - r0 + 1} (2015 onward is shorter, so it is noisier).`,
      `Onset: median day of year ${fmt(s.early.onset_doy)} → ${fmt(s.recent.onset_doy)}; rain in the season window ${fmt(s.early.season_rain)} mm → ${fmt(s.recent.season_rain)} mm; days above 35 °C ${fmt(s.early.hot_days)} → ${fmt(s.recent.hot_days)}.`,
      `Season window used at this point: ${esc((s.window || []).join(" to "))} (data/countries.json).`,
      esc(s.note || ""),
    ].filter(Boolean),
  );
  const mine = mainCrop();
  const plan = moved
    ? d >= 3
      ? `A fixed date from the old season is now too early. Sow when this year's rain actually starts, not by the old calendar.`
      : d <= -3
        ? `The rains come earlier, so a fixed late date can miss the first good rain. Sow when the rain starts.`
        : rp <= -5
          ? "With less rain in the season, a shorter-season variety or one that needs less water is the safer choice."
          : "With more very hot days, sow so that flowering misses the hottest weeks, and keep the soil covered."
    : "The dates Walo gives already come from the last 35 years, so the planting advice is in step with this record.";
  return `${hero({ img: CFG().photos.plant_here.img, pos: CFG().photos.plant_here.pos, eyeIcon: "satellite", eyebrow: `${esc(placeLabel(p))} · ${e0}–${r1}`, title: "How this place is changing" })}
  <div class="stack lift">
    ${answer({ kind: moved ? "info" : "good", tone: moved ? "info" : "good", ic: "satellite", title: esc(headline), sub: esc(sub), why: { title: "How this was worked out", html: why }, say: `${headline}. ${sub}` })}
    ${facts([
      { ic: "cloud-rain", tone: "info", text: `${d > 0 ? "+" : ""}${d} days to the first rain` },
      { ic: "droplets", tone: rp != null && rp < 0 ? "wait" : "good", text: `${rp > 0 ? "+" : ""}${rp}% season rain` },
      { ic: "thermometer-sun", tone: dh > 0 ? "wait" : "good", text: `${dh > 0 ? "+" : ""}${dh} hot days` },
    ])}
    <div class="card stack"><b class="fix-h">What this means for planting</b><p class="a-sub">${esc(plan)}</p></div>
    ${mine ? btn(`When to plant ${crop(mine).name.toLowerCase()}`, { href: `#/crop/${esc(mine)}`, ic: "calendar-days" }) : btn("What to plant here", { href: "#/now", ic: "sprout" })}
    ${mine ? btn("What to plant after harvest", { href: `#/next/${esc(mine)}`, kind: "secondary", ic: "refresh-cw" }) : ""}
    ${note("Two periods, not a promise: the last eleven years are still few. Walo shows what the record says and you weigh it with what you see.", "info")}
  </div>`;
}
