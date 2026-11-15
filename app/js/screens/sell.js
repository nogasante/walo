/* Sell: opens on the farmer's own crops (one card per field, main crop first); one field opens straight on it.
   For each: when it usually sells best near that field (WFP/HDX price pattern), tied to its harvest, with the data's years and unit.
   "Check another crop" is a small option at the bottom. */
import { place, placeLabel, farm, farms, setCrop, mainCrop } from "../store.js";
import { crop, sellAdvice, farmProgress, monthName, currency, D, CFG } from "../data.js";
import { answer, whyBody, note, icon, link, cropImg, hero, monthBars, btn, chip } from "../ui.js";
import { esc, fmt, roughDate } from "../util.js";
import { sellLine } from "./farm.js";
import { openCropPicker } from "./pickers.js";

export const title = (id) => (crop(id) ? `Sell ${crop(id).name.toLowerCase()}` : farms().length === 1 ? `Sell ${crop(farms()[0].crop).name.toLowerCase()}` : "When to sell");
const mk = (m) => `${esc(m.name)} market (${fmt(m.km)} km)`;
const other = (mine) => `<button type="button" class="linkbtn center" id="check-crop">${icon("search")}<span>${mine ? "Check another crop" : "Check a crop"}</span></button>`;
/* the farmer's fields, main crop first, then the soonest harvest */
const myFields = () => { const m = mainCrop(); return farms().map((f) => ({ f, pr: farmProgress(f) })).sort((a, b) => (b.f.crop === m) - (a.f.crop === m) || a.pr.harvest - b.pr.harvest); };
export function render(id, farmId) {
  if (!crop(id)) { const mine = myFields(); return mine.length === 1 ? detail(mine[0].f.crop, mine[0].f) : list(mine); }
  return detail(id, farmId ? farm(farmId) : null);
}
/* one plain summary of the advice for a field (used on the cards) */
function summary(sa, pr) {
  if (sa.kind === "index") return { line: `Usually best in ${monthName(sa.peak)} at ${mk(sa.market)}`, tone: sa.store ? "wait" : "now", act: sa.store ? `Store if you can: prices rise by ${monthName(sa.store.month)}` : "Sell soon after harvest", data: `Price pattern to ${monthName(+sa.s.last.slice(5, 7))} ${sa.s.last.slice(0, 4)} · per ${esc(sa.unit)}` };
  if (sa.kind === "spot") return { line: `${esc(sa.spot.market)}${sa.spot.km != null ? ` (${fmt(sa.spot.km)} km)` : ""}: ${currency()} ${fmt(sa.spot.lo)}–${fmt(sa.spot.hi)}`, tone: "info", act: sa.guessMonth ? `Best guess: sell around ${monthName(sa.guessMonth)}` : "No price history", data: "Only 2025 prices, unit not given" };
  return { line: "No price records yet", tone: "info", act: sa.guessMonth ? `Best guess: sell around ${monthName(sa.guessMonth)}` : "Sell when stores run low", data: "" };
}
function list(mine) {
  const P = CFG().photos.sell;
  const top = hero({ img: P.img, pos: P.pos, eyeIcon: "tag", eyebrow: mine.length ? `${mine.length} fields` : esc(placeLabel(place())), title: "When to sell your crops" });
  if (!mine.length) return `${top}<div class="stack lift">
    ${answer({ kind: "info", icon: "tag", title: "Add your field to see when to sell", sub: "Walo follows your field to harvest, then says when and where to sell.", say: "Add your field to see when to sell." })}
    ${btn("Add a field", { href: "#/start", ic: "plus" })}${other(false)}</div>`;
  const card = ({ f, pr }) => {
    const c = crop(f.crop), sa = sellAdvice(c.id, pr.p, pr.harvest), s = summary(sa, pr), last = (f.photos || []).slice(-1)[0];
    const pic = last ? (/^idb:/.test(last.src) ? `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-ph="${esc(last.src)}" alt="">` : `<img src="${esc(last.src)}" alt="" loading="lazy">`) : cropImg(c);
    const when = pr.frac >= 1 ? "Ready to harvest" : `Harvest ${roughDate(pr.harvest)}`;
    return `<a class="scard" href="#/sell/${c.id}/${esc(f.id)}"><span class="sc-pic">${pic}${f.demo ? '<i class="tag on-pic">Demo</i>' : ""}</span>
      <span class="sc-t"><small class="sc-eye">${esc(f.name)}</small><b>Your ${esc(c.name.toLowerCase())} · ${esc(when)}</b>${chip(s.tone, esc(s.act))}<span class="sc-line">${s.line}</span>${s.data ? `<small class="sc-data">${s.data}</small>` : ""}</span>${icon("chevron-right")}</a>`;
  };
  return `${top}<div class="stack lift"><div class="scards">${mine.map(card).join("")}</div>
    ${note("WFP's price records for these markets stop in July 2023. They show the usual season, not this year's price.", "calendar-days")}${other(true)}</div>`;
}
function detail(id, f) {
  const c = crop(id), pr = f ? farmProgress(f) : null, p = pr ? pr.p : place(); setCrop(id);
  const sa = sellAdvice(id, p, pr ? pr.harvest : null);
  const yrs = `${sa.years[0]}–${sa.years[1]}`;
  let a, dataLine = "";
  if (sa.kind === "index") {
    const m = sa.market, last = sa.s.last, newest = `${monthName(+last.slice(5, 7))} ${last.slice(0, 4)}`; // the newest price in the data, said in the answer itself
    if (pr) a = { kind: sa.store ? "later" : "now", icon: sa.store ? "clock" : "tag", title: sa.store ? `Store if you can: prices usually rise by ${monthName(sa.store.month)}` : "Sell soon after harvest", sub: `${esc(sellLine(sa, pr).split(". ")[0])}. At ${mk(m)}.` };
    else a = { kind: "now", icon: "tag", title: `Usually best in ${monthName(sa.peak)}`, sub: `At ${mk(m)}. More money than in ${monthName(sa.dip)}.` };
    dataLine = `Price pattern from ${yrs} prices (WFP), per ${esc(sa.unit)}. The newest price in it is ${newest}, so today's price may be different. Ask at the market before you sell.`;
  } else if (sa.kind === "spot") {
    const s = sa.spot;
    a = { kind: "info", icon: "tag", title: sa.guessMonth ? `Best guess: sell around ${monthName(sa.guessMonth)}` : `No price history for ${esc(c.name.toLowerCase())}`, sub: `Only 2025 prices: ${esc(s.market)}${s.km != null ? ` (${fmt(s.km)} km)` : ""}, ${currency()} ${fmt(s.lo)}–${fmt(s.hi)}, unit not given.` };
    dataLine = `No price history for ${esc(c.name.toLowerCase())}, so the month is a best guess.`;
  } else {
    a = { kind: "info", icon: "tag", title: sa.guessMonth ? `Best guess: sell around ${monthName(sa.guessMonth)}` : "No price records", sub: `No price records for ${esc(c.name.toLowerCase())} yet.` };
    dataLine = "Best guess: a few months after harvest, when stores run low.";
  }
  const det = [];
  if (sa.kind === "index") {
    const s = sa.s, pct = (m) => Math.round((s.index[m - 1] - 1) * 100);
    det.push(`${esc(sa.market.name)}, ${esc(sa.label)}, ${esc(sa.unit)}: usually ${pct(sa.peak) >= 0 ? "+" : ""}${pct(sa.peak)}% in ${monthName(sa.peak)} and ${pct(sa.dip)}% in ${monthName(sa.dip)} vs the year's average (seasonal index, ${s.index_years} years in ${yrs}).`);
    det.push(`Last price in the data: ${s.last.replace(/(\d{4})-(\d\d)/, (x, y, mm) => `${monthName(+mm)} ${y}`)}. Last 12 months' average then: ${currency()} ${fmt(s.recent_avg)}.`);
    if (sa.store) det.push(`Harvest month to best month within ${D.rules.sell.store_window_months.value} months: about +${Math.round(sa.store.gain * 100)}% (Walo says "store" from +${Math.round(D.rules.sell.store_gain_min.value * 100)}%).`);
    if (sa.better) det.push(`${esc(sa.better.market.name)} paid about ${Math.round(sa.better.gain * 100)}% more in its last year of data (same crop and ${esc(sa.better.unit)}).`);
    if (s.thin) det.push("Only a few years of data for this market: treat the pattern with care.");
    if (s.n_excluded) det.push(`${s.n_excluded} odd price(s) left out (over 3× the months around them). The raw data is unchanged.`);
  }
  if (sa.kind === "spot") det.push(`MoFA SRID 2025 (${esc(sa.spot.market)}): ${esc(sa.spot.label)}, ${currency()} ${fmt(sa.spot.lo, 2)}–${fmt(sa.spot.hi, 2)}, June–October 2025. The file has no unit column.`);
  det.push(`Distances are straight-line from ${esc(placeLabel(p))}.`);
  det.push(`Sources: ${link(D.market.source.url, "WFP Ghana food prices (HDX)")} · ${link(D.market.srid_source.url, "MoFA SRID")}`);
  const why = whyBody([
    "Prices usually drop just after harvest, when many farmers sell, and rise later when stores run low.",
    sa.kind === "index" ? `Walo looked at the same market's prices over the years ${yrs}.` : "Walo has no price pattern for this crop, so this is a best guess.",
  ], det);
  let strip = "";
  if (sa.kind === "index") { // usual price through the year: best month green, lowest month red
    const ix = sa.s.index, lo = Math.min(...ix), hi = Math.max(...ix), span = hi - lo || 1;
    strip = monthBars(ix.map((v, i) => ({ v: 0.25 + 0.75 * (v - lo) / span, cls: i + 1 === sa.peak ? "g" : i + 1 === sa.dip ? "r" : "n" })), { caption: "Usual price", legend: [["g", "Best month"], ["r", "Lowest"]] });
  }
  const P = CFG().photos.sell;
  return `${hero({ img: P.img, pos: P.pos, eyeIcon: "tag", eyebrow: `${esc(c.name)} · ${esc(placeLabel(p))}`, title: `When to sell ${esc(c.name.toLowerCase())}` })}
  <div class="stack lift">
    ${answer({ ...a, extra: strip, why: { title: "Why this answer", html: why }, say: `${a.title}. ${a.sub.replace(/<[^>]+>/g, "")}` })}
    ${note(dataLine, "calendar-days")}
    ${sa.better ? note(`${esc(sa.better.market.name)} market (${fmt(sa.better.market.km)} km) usually pays more.`, "store") : ""}
    ${farms().length > 1 && f ? btn("All my crops", { href: "#/sell", kind: "secondary", ic: "leaf" }) : ""}
    ${!f && farms().length ? btn("My crops", { href: "#/sell", kind: "secondary", ic: "leaf" }) : ""}
    ${other(!!farms().length)}
  </div>`;
}
export function mount(root) {
  const b = root.querySelector("#check-crop");
  if (b) b.addEventListener("click", (e) => openCropPicker("sell", e.currentTarget, (cid) => { location.hash = `#/sell/${cid}`; }));
}
