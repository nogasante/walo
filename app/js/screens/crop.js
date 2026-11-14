/* Crop answer: can I plant this crop here, and when. "Where else" shows the best towns for it. */
import { twiOn } from "../twi.js";
import { place, placeLabel, setPlace, setCrop, focusCrop } from "../store.js";
import { crop, scoreCrop, fitWord, plantStatus, cropMonths, cropDays, placeList, isTree, country, D, zoneOf, zoneName, forecastFor, fcOnset, confFor } from "../data.js";
import { answer, whyBody, btn, sheet, row, note, openSheet, closeSheet, hero, facts } from "../ui.js";
import { esc, fmt, runs, monthSpan, weekday, MONTHS_LONG, doyText } from "../util.js";
import { rainDetails, rainStrip } from "./words.js";

export const title = (id) => crop(crop(id) ? id : focusCrop()).name;
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
function details(c, p, sc, cm, st) {
  const e = sc.eco, f = sc.fit, out = [`Class ${sc.cls.code} (${sc.cls.label}), ${sc.score} of 5: the lower of the climate class (EcoCrop) and the water class (FAO-56). Data confidence: ${confFor(c, p)}.`];
  if (e) out.push(`EcoCrop: rain ${fmt(e.rain_mm)} mm a year vs ideal ${fmt(e.rain_rng.opt_min)}–${fmt(e.rain_rng.opt_max)} mm${e.gh ? " (Ghana figure)" : ""}; temperature fit ${Math.round(e.temp * 100)}% over its ${e.months}-month season (ideal ${e.temp_rng.opt_min}–${e.temp_rng.opt_max} °C).`);
  if (f) out.push(`FAO-56 water balance, sown at the usual start of the rains (${doyText(f.sow)}): needs about ${fmt(f.need_mm)} mm, effective rain ${fmt(f.peff_mm)} mm, WRSI ${f.wrsi} (${f.water_class.label.toLowerCase()})${sc.water ? "" : ", not used for long crops"}.`);
  if (f && f.heat && f.hot_days != null) out.push(`About ${f.hot_days} day${f.hot_days === 1 ? "" : "s"} above ${f.heat.t} °C while it flowers.`);
  if (cm.windows.length) out.push(cm.guess ? `Planting months are Walo's best guess: from the date the rains have started in 2 of 10 years to 8 of 10 years, keeping seasons with enough rain for it.` : `Planting months: ${cm.windows.map((w) => `${esc(w.src || ((country() || {}).sources || {}).crop_calendar || "FAO crop calendar")} (sow ${esc(w.sow_text)}, harvest ${esc(w.harvest_text)})`).join("; ")}.`);
  return out.concat(rainDetails(p, st));
}
export function render(id, sub) {
  id = crop(id) ? id : focusCrop();
  const c = crop(id), p = place(); setCrop(id);
  const sc = scoreCrop(c, p), fw = fitWord(sc), st = plantStatus(c, p), cm = cropMonths(c, p), z = zoneOf(p), outZone = z != null && !c.zones[z];
  const months = cm.allYear ? "Any month" : cm.sow.length ? runs(cm.sow).map(monthSpan).join(", ") : "";
  const subLine = months ? `Planting months: ${months}${cm.guess ? " (best guess)" : ""}.` : "";
  const t = headline(c, st), fo = fcOnset(forecastFor(p));
  const why = whyBody(reasons(c, sc).concat(outZone ? [`FAO does not list ${c.name.toLowerCase()} for the ${zoneName(z).toLowerCase()}.`] : []), details(c, p, sc, cm, st));
  const where = whereSheet(c);
  if (sub === "where") { history.replaceState(null, "", `#/crop/${id}`); setTimeout(() => openSheet(where), 60); }
  const twi = c.twi && twiOn() ? ` · <span lang="ak">${esc(c.twi.split(" / ")[0].split(" (")[0])}</span>` : "";
  const fx = facts([{ ic: fw.cls === "bad" ? "circle-x" : "leaf", tone: fw.cls, text: fw.text }, isTree(c) ? null : { ic: "clock", tone: "info", text: `Ready in about ${cropDays(c)} days` }]);
  return `${hero({ img: c.img, pos: c.pos || "50% 50%", eyeIcon: "sprout", eyebrow: `${esc(c.name)}${twi}`, title: `When to plant ${esc(c.name.toLowerCase())}` })}
  <div class="stack lift">
    ${answer({ kind: st.kind, title: t, sub: subLine, extra: fx + rainStrip(p, cm.allYear ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : cm.sow), why: { title: `Why: ${c.name}`, html: why }, say: `${t}. ${fw.text} in ${placeLabel(p)}. ${subLine}`, credit: fo ? "NASA data + forecast" : "NASA data" })}
    ${isTree(c) ? note(`${esc(c.name)} is a tree crop: Walo cannot follow it as a field yet.`) : btn("Start planting", { href: `#/start/${c.id}`, ic: "sprout" })}
    ${btn("Where else it grows best", { kind: "secondary", ic: "map-pin", attrs: `data-sheet="${sheet(where.title, where.html, where.onOpen)}"` })}
  </div>`;
}
/* where it grows best: map + the best towns; tapping one makes it your place */
function whereSheet(c) {
  const list = placeList(c), cur = place(), g = D.ghana_map;
  const P = (lat, lon) => [(lon - g.x0) * g.s, (g.y1 - lat) * g.s];
  const pins = list.slice().reverse().map((x) => { const [px, py] = P(x.p.lat, x.p.lon), w = fitWord(x.sc); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${x.p.id === cur.id ? 9 : 6}" class="pin ${x.listed ? w.cls : "bad"}${x.p.id === cur.id ? " sel" : ""}"><title>${esc(x.p.name)}</title></circle>`; }).join("");
  const map = `<svg class="gmap" viewBox="-10 -10 ${g.w + 20} ${g.h + 20}" role="img" aria-label="Map of ${esc((country() || {}).name || "the country")}: green dots grow ${esc(c.name.toLowerCase())} well"><path d="${g.path}" class="land"/>${pins}</svg>`;
  const top = list.filter((x) => x.listed).slice(0, 6);
  const html = `${map}<p class="legend"><span class="dot good"></span>Grows well <span class="dot wait"></span>Can grow <span class="dot bad"></span>Poorly</p>
    <div class="list">${top.map((x) => row({ attrs: `data-town="${x.p.id}"`, ic: "map-pin", title: esc(x.p.name), sub: fitWord(x.sc).text, status: x.sc.score >= 4 ? "good" : x.sc.score === 3 ? "wait" : "bad" })).join("")}</div>
    <p class="muted small">Tap a town to see ${esc(c.name.toLowerCase())} there. Based on NASA weather and FAO methods.</p>`;
  return { title: `Where ${c.name.toLowerCase()} grows best`, html, onOpen: (b) => b.addEventListener("click", (e) => { const t = e.target.closest("[data-town]"); if (t) { setPlace(t.dataset.town); closeSheet(true); location.hash = `#/crop/${c.id}`; } }) };
}
