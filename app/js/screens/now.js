/* Plant now: one answer for this place this week, then the crops in order. */
import { online } from "../net.js";
import { place, placeLabel } from "../store.js";
import { cropGroups, forecastFor, fcOnset, agroOf, CFG } from "../data.js";
import { answer, whyBody, note, icon, hero, cropTile, groupedCrops, btn } from "../ui.js";
import { esc, weekday, MONTHS_LONG } from "../util.js";
import { statusLine, rainDetails, yearsOf, rainStrip } from "./words.js";

export const title = () => "What to plant now";
export function render() {
  const p = place(), groups = cropGroups(p), list = groups.filter((g) => g.key !== "no").flatMap((g) => g.items), fo = fcOnset(forecastFor(p));
  const now = list.filter((x) => x.st.kind === "now"), wait = list.filter((x) => x.st.kind === "wait"), water = list.filter((x) => x.st.kind === "water"), later = list.find((x) => x.st.kind === "later");
  // "Dry season" is a statement about this place's season, so it comes from the place's own growing period
  // (rain >= the FAO-56 share of ET0 this month), never from one crop's water balance.
  const drySeason = !agroOf(p).months[new Date().getMonth()].lgp;
  const nextLine = later ? ` Next: ${esc(later.c.name)} in ${MONTHS_LONG[later.st.month - 1]}.` : "";
  let a;
  if (now.length) a = { kind: "now", title: fo && fo.date ? `Plant after the rain on ${weekday(fo.date)}` : "Good time to plant", sub: fo && fo.date ? "Rain is coming. These crops are good to plant." : "Plant after a good rain." };
  else if (wait.length) a = { kind: "wait", title: "Wait: rain not here yet", sub: "No planting rain in the next 10 days. Plant when it comes." };
  else if (water.length) a = drySeason
    ? { kind: "water", title: "Dry season now", sub: `Only plant if you can water.${nextLine}` }
    : { kind: "water", title: "Plant only if you can water", sub: `Rain is falling, but not enough for these crops yet. Water them if you can.${nextLine}` };
  else a = { kind: "later", title: "Not planting time", sub: later ? `Next: ${esc(later.c.name)} in ${MONTHS_LONG[later.st.month - 1]}` : "" };
  const say = `${a.title}. ${a.sub.replace(/<[^>]+>/g, "")} ${list.slice(0, 3).map((x) => `${x.c.name}: ${statusLine(x.st)}.`).join(" ")}`;
  const why = whyBody([
    `Walo checks when the rains usually start here, from ${yearsOf(p)} years of NASA rain data.`,
    fo ? "It also checks the weather forecast for the next 10 days, so you plant after a good rain." : (online() ? "There is no forecast right now, so Walo used the usual start of the rains." : "Using usual weather (no forecast offline)."),
    "Crops are grouped: plant now, plant now if you can water, plant soon, later this year, and crops that do not grow well here.",
  ], rainDetails(p, (list[0] || {}).st));
  const tile = (x, g) => cropTile({ href: `#/crop/${x.c.id}`, c: x.c, kind: g.key === "no" ? "no" : x.st.kind === "now" ? "now" : "wait", text: g.key === "no" ? "Grows poorly here" : statusLine(x.st) });
  const P = CFG().photos.plant_here;
  return `${hero({ img: P.img, pos: P.pos, eyebrow: `${esc(placeLabel(p))} · ${MONTHS_LONG[new Date().getMonth()]}`, title: "What to plant here now" })}
  <div class="stack lift">
    ${answer({ ...a, extra: rainStrip(p), why: { title: "Why this answer", html: why }, say, credit: fo ? "NASA data + forecast" : "NASA data" })}
    ${btn(`Not ${esc(placeLabel(p))}? Change location`, { kind: "secondary", ic: "map-pin", attrs: "data-place-open" })}
    ${online() ? "" : note(fo ? "You are offline: Walo uses the last forecast it saved." : "Using usual weather (no forecast offline).", "wifi-off")}
    ${groupedCrops(groups, tile)}
    ${note(`Usual weather is not a promise: watch your own rain too.`)}
  </div>`;
}
