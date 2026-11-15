/* Crop answer: can I plant this crop here, and when. "Where else" shows the best towns for it. */
import { twiOn } from "../twi.js";
import { place, placeLabel, placeChosen, setPlace, setCrop, focusCrop } from "../store.js";
import { crop, town, scoreCrop, fitWord, growFixes, plantStatus, cropMonths, cropDays, placeList, isTree, country, D, zoneOf, zoneName, forecastFor, fcOnset, confFor, mapFor } from "../data.js";
import { answer, whyBody, btn, row, note, openSheet, closeSheet, hero, facts, emptyState } from "../ui.js";
import { esc, fmt, runs, monthSpan, weekday, MONTHS_LONG, doyText, km } from "../util.js";
import { rainDetails, rainStrip } from "./words.js";

export const title = (id, sub) => { const c = crop(crop(id) ? id : focusCrop()); return sub === "where" ? `Where ${c.name.toLowerCase()} grows best` : c.name; };
function headline(c, st) {
  const n = c.name.toLowerCase();
  switch (st.kind) {
    case "now": return st.rainDate ? `Plant ${n} after the rain on ${weekday(st.rainDate)}` : `Plant ${n} now, after a good rain`;
    case "wait": return `Wait to plant ${n}: rain not here yet`;
    case "water": return `Plant ${n} only if you can water`;
    case "later": return `Plant ${n} in ${MONTHS_LONG[st.month - 1]}`;
    default: return `${c.name} has no good planting month here`;
  }
}
/* the plain reasons, from the same numbers the class uses */
function reasons(c, sc) {
  const out = [], e = sc.eco, f = sc.fit;
  if (e) {
    out.push(e.rain_s >= 1 ? "Rain here in a year is right for it." : e.rain_mm < e.rain_rng.opt_min ? "Rain here is a little low for it." : "Rain here is more than it likes.");
    out.push(e.temp >= 1 ? "The temperatures suit it." : "It is a little too hot or too cool here for it in some months.");
  }
  if (sc.water && f.deficit_mm > 0 && f.water_class.cls !== "good") out.push("In a usual season, rain does not give it all the water it needs.");
  if (f && f.hot_days > 0 && (f.heat.cited || c.heat_sensitive_stage)) out.push("Some very hot days usually come while it flowers.");
  return out;
}
/* the steps for a "can grow" or "poorly" place, in a card she can act on */
function fixesCard(items, title) {
  return `<div class="card stack fixes"><b class="fix-h">${esc(title)}</b><ul class="fixlist">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
}
function details(c, p, sc, cm, st) {
  const e = sc.eco, f = sc.fit, out = [`Class ${sc.cls.code} (${sc.cls.label}), ${sc.score} of 5: the lower of the climate class (EcoCrop) and the water class (FAO-56). Data confidence: ${confFor(c, p)}.`];
  if (e) out.push(`EcoCrop: rain ${fmt(e.rain_mm)} mm a year vs ideal ${fmt(e.rain_rng.opt_min)}-${fmt(e.rain_rng.opt_max)} mm${e.gh ? " (Ghana figure)" : ""}; temperature fit ${Math.round(e.temp * 100)}% over its ${e.months}-month season (ideal ${e.temp_rng.opt_min}-${e.temp_rng.opt_max} °C).`);
  if (f) out.push(`FAO-56 water balance, sown at the usual start of the rains (${doyText(f.sow)}): needs about ${fmt(f.need_mm)} mm, effective rain ${fmt(f.peff_mm)} mm, WRSI ${f.wrsi} (${f.water_class.label.toLowerCase()})${sc.water ? "" : ", not used for long crops"}.`);
  if (f && f.heat && f.hot_days != null) out.push(`About ${f.hot_days} day${f.hot_days === 1 ? "" : "s"} above ${f.heat.t} °C while it flowers.`);
  if (cm.windows.length) out.push(cm.guess ? `Planting months are Walɔ's best guess: from the date the rains have started in 2 of 10 years to 8 of 10 years, keeping seasons with enough rain for it.` : `Planting months: ${cm.windows.map((w) => `${esc(w.src || ((country() || {}).sources || {}).crop_calendar || "FAO crop calendar")} (sow ${esc(w.sow_text)}, harvest ${esc(w.harvest_text)})`).join("; ")}.`);
  return out.concat(rainDetails(p, st));
}
export function render(id, sub) {
  id = crop(id) ? id : focusCrop();
  const c = crop(id), p = place(); setCrop(id);
  const sc = scoreCrop(c, p), fw = fitWord(sc), st = plantStatus(c, p), cm = cropMonths(c, p), z = zoneOf(p), outZone = z != null && !c.zones[z];
  const months = cm.allYear ? "Any month" : cm.sow.length ? runs(cm.sow).map(monthSpan).join(", ") : "";
  // the headline already names the month it wants, so this line adds the width of the window, never a second answer
  const guessNote = cm.guess && !cm.allYear ? " Walɔ's best guess from ten years of rain." : "";
  const subLine = cm.allYear ? "Any month works here." : cm.sow.length > 1 ? `Sowing runs ${months}.${guessNote}` : guessNote.trim();
  const t = headline(c, st), fo = fcOnset(forecastFor(p));
  const why = whyBody(reasons(c, sc).concat(outZone ? [`FAO does not list ${c.name.toLowerCase()} for the ${zoneName(z).toLowerCase()}.`] : []), details(c, p, sc, cm, st));
  // "Where does it grow best" is its own page at #/crop/<id>/where, not a sheet popped over this one: the same
  // link then lands on the same screen every time, and reloading or coming back does not lose it.
  if (sub === "where") return `<div class="stack">${placesHtml(c)}</div>`;
  const twi = c.twi && twiOn() ? ` · <span lang="ak">${esc(c.twi.split(" / ")[0].split(" (")[0])}</span>` : "";
  // the verdict wears the legend's own icon (check / clock / cross); the calendar marks the days to harvest so
  // two clocks never sit side by side
  const fx = facts([{ ic: fw.cls === "bad" ? "circle-x" : fw.cls === "wait" ? "clock" : "circle-check", tone: fw.cls, text: fw.text }, isTree(c) ? null : { ic: "calendar-days", tone: "info", text: `Ready in about ${cropDays(c)} days` }]);
  return `${hero({ img: c.img, pos: c.pos || "50% 50%", eyeIcon: "sprout", eyebrow: `${esc(c.name)}${twi}`, title: `When to plant ${esc(c.name.toLowerCase())}` })}
  <div class="stack lift">
    ${answer({ kind: st.kind, title: t, sub: subLine, extra: fx + rainStrip(p, cm.allYear ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : cm.sow), why: { title: `Why: ${c.name}`, html: why }, say: `${t}. ${fw.text} in ${placeLabel(p)}. ${subLine}` })}
    ${sc.score < 4 ? fixesCard(growFixes(c, p), `To grow it in ${placeLabel(p)}`) : ""}
    ${isTree(c) ? note(`${esc(c.name)} is a tree crop: Walɔ cannot follow it as a field yet.`) : btn("Start planting", { href: `#/start/${c.id}`, ic: "sprout" })}
    ${btn("Where else it grows best", { kind: "secondary", ic: "map-pin", href: `#/crop/${c.id}/where` })}
    ${isTree(c) ? "" : btn("What to plant after it", { kind: "secondary", ic: "refresh-cw", href: `#/next/${c.id}` })}
  </div>`;
}
/* the map and the best towns for a crop. Used on the crop page, and by first run, which has no place yet. */
export function placesHtml(c, opts = {}) {
  // every town in the country, each with its own verdict: hiding the "can grow" and "poorly" ones left her unable
  // to answer "what about my town?". With opts.near the same list is ordered by how close each town is to her.
  const base = placeList(c), near = opts.near || null;
  const list = near ? base.slice().sort((a, b) => km(near, a.p) - km(near, b.p)) : base.slice().sort((a, b) => b.sc.score - a.sc.score || a.p.name.localeCompare(b.p.name));
  const cur = place(), hers = placeChosen(), g = mapFor();
  // the icon carries the verdict in the legend's own colours (green / amber / grey); no words per row, the legend says it
  const tone = (x) => (x.sc.score >= 4 ? "good" : x.sc.score === 3 ? "wait" : "poor");
  const P = (lat, lon) => [(lon - g.x0) * g.s, (g.y1 - lat) * g.s];
  const pins = g ? list.slice().reverse().map((x) => { const [px, py] = P(x.p.lat, x.p.lon), sel = hers && x.p.id === cur.id; return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${sel ? 9 : 6}" class="pin ${tone(x)}${sel ? " sel" : ""}"><title>${esc(x.p.name)}</title></circle>`; }).join("") : "";
  // a country with no outline in data/ just shows the list: no map is better than another country's map
  const map = g ? `<svg class="gmap" viewBox="-10 -10 ${g.w + 20} ${g.h + 20}" role="img" aria-label="Map of ${esc((country() || {}).name || "the country")}: green dots grow ${esc(c.name.toLowerCase())} well"><path d="${g.path}" class="land"/>${pins}</svg>` : "";
  const body = list.length
    ? `<div class="list">${list.map((x) => row({ attrs: `data-town="${x.p.id}"`, ic: "map-pin", icTone: tone(x), title: esc(x.p.name), sub: near ? `${Math.round(km(near, x.p))} km away` : "" })).join("")}</div>`
    : emptyState({ ic: "map-pin", title: `No towns in ${(country() || {}).name || "this country"} yet`, sub: "Walɔ needs towns here before it can say where a crop grows.", action: "Choose another country", href: "#/welcome" });
  return `${map}<p class="legend"><span class="dot good"></span>Grows well <span class="dot wait"></span>Can grow <span class="dot bad"></span>Poorly</p>${body}`;
}
/* a town on the where page: its verdict for this crop, and the one control that changes her farm. Tapping a town
   only looks at it, so browsing never moves her farm by accident. */
function townSheet(c, id) {
  const p = town(id); if (!p) return null;
  const sc = scoreCrop(c, p), st = plantStatus(c, p), isCur = p.id === place().id;
  const html = `<div class="stack">
    <p class="list-h">${esc(p.name)}${isCur ? " · your farm" : ""}</p>
    ${answer({ kind: st.kind, title: headline(c, st), sub: `${esc(fitWord(sc).text)} here.` })}
    ${sc.score < 4 ? fixesCard(growFixes(c, p), `To grow it in ${esc(p.name)}`) : ""}
    ${isCur ? "" : btn("Make this my farm", { ic: "map-pin", attrs: `data-makefarm="${p.id}"` })}
  </div>`;
  return { title: p.name, html, onOpen: (b) => b.addEventListener("click", (e) => {
    const mk = e.target.closest("[data-makefarm]");
    if (mk) { setPlace(mk.dataset.makefarm); closeSheet(true); } // setPlace re-renders: the pin moves to her farm
  }) };
}
export function mount(root, id) {
  const c = crop(crop(id) ? id : focusCrop());
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-town]"); if (!t) return;
    const s = townSheet(c, t.dataset.town); if (s) openSheet(s, t);
  });
}
