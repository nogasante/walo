/* Home: what she is growing now, Plant Doctor, and one way to plant something else (place first or crop first). */
import { place, placeLabel, farmsHere } from "../store.js";
import { crop, cropGroups, farmProgress, CFG } from "../data.js";
import { icon, cropImg, cropTile, hero, ring, row } from "../ui.js";
import { esc, roughDate, MONTHS_LONG } from "../util.js";

export const title = () => "Walɔ";
const greeting = () => { const h = new Date().getHours(); return CFG().greetings.filter(([from]) => h >= from).pop()[1]; };
export function render() {
  const p = place(), P = CFG().photos;
  const mine = farmsHere().filter((f) => !f.demo); // the demo field is never "your crops"
  return `${hero({ img: P.home.img, pos: P.home.pos, eyebrow: `${esc(placeLabel(p))} · ${MONTHS_LONG[new Date().getMonth()]}`, title: `${greeting()}.<br>Here is what is growing.` })}
  <div class="stack">
    <div class="h2row"><h2 class="h2">Your crops</h2>${mine.length > 2 ? `<a class="h2link" href="#/farm">All ${mine.length}</a>` : ""}</div>
    ${mine.length
      ? `<div class="fgrid${mine.length === 1 ? " one" : ""}">${mine.slice(0, 2).map(fieldCard).join("")}</div>`
      : `<a class="fcard empty" href="#/now"><span class="fc-pic"><img src="${P.plant_here.img}" alt="" loading="lazy" style="object-position:${P.plant_here.pos}"></span>
          <span class="fc-t"><span class="fc-mid"><b>Nothing growing yet</b><small>See what you can plant in ${esc(placeLabel(p))} this month.</small></span><span class="fc-go">${icon("chevron-right")}</span></span></a>`}
    ${plantNow(p)}
    ${plantBig(mine.length ? "Plant again" : "Plant something", P)}
    ${row({ href: "#/doctor", ic: "stethoscope", title: "Sick plant?", sub: "Take a photo. Plant Doctor looks at it.", attrs: "data-net" })}
    ${row({ href: "#/shift", ic: "satellite", title: "How this place is changing", sub: `Rain, heat and the season in ${esc(placeLabel(p))}` })}
    <a class="helpbtn" href="#/help/home" data-net><span class="tile-ic talk">${icon("headset")}</span><span class="fo-t"><b>Get help</b><small>Ask Walɔ by talking or typing</small></span>${icon("chevron-right")}</a>
  </div>`;
}
/* the one way to plant something: a tall photo card that goes straight to the planting screen. It used to open a
   sheet whose first option led to that same screen, with a "change location" row that duplicated the place chip. */
const plantBig = (label, P) => `<a class="plantbig" href="#/now" aria-label="${esc(label)}">
    <span class="pb-pic"><img src="${P.plant_here.img}" alt="" loading="lazy" style="object-position:${P.plant_here.pos}"><span class="pb-badge">${icon("sprout")}</span></span>
    <span class="pb-row"><span class="pb-t"><b>${esc(label)}</b><small>What grows here now, and when to sow it</small></span>${icon("chevron-right")}</span>
  </a>`;
/* what is worth planting in her town right now, as pictures: two or three crops, never a second full list */
function plantNow(p) {
  const groups = cropGroups(p), g = groups.find((x) => x.key === "now") || groups.find((x) => x.key === "water");
  const picks = (g && g.items || []).slice(0, 2);
  if (!picks.length) return "";
  return `<div class="h2row"><h2 class="h2">Good to plant now</h2><a class="h2link" href="#/now">All</a></div>
    <div class="tgrid">${picks.map((x) => cropTile({ href: `#/crop/${x.c.id}`, c: x.c, kind: g.key === "now" ? "now" : "wait", text: g.key === "now" ? "Plant now" : "If you can water" })).join("")}</div>`;
}
/* a crop she is growing: latest photo, progress ring, name, stage and harvest */
export function fieldCard(f) {
  const pr = farmProgress(f), c = crop(f.crop), last = (f.photos || []).slice(-1)[0];
  const sub = pr.d < 0 ? `Plant ${roughDate(pr.start)}` : pr.frac >= 1 ? "Ready to harvest" : `${pr.stages[pr.si].name} · harvest ${roughDate(pr.harvest)}`;
  const ic = pr.frac >= 1 ? "wheat" : pr.si >= 0 ? pr.stages[pr.si].icon : "sprout";
  const pic = last ? (/^idb:/.test(last.src) ? `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-ph="${esc(last.src)}" alt="">` : `<img src="${esc(last.src)}" alt="" loading="lazy">`) : cropImg(c);
  return `<a class="fcard" href="#/farm/${esc(f.id)}"><span class="fc-pic">${pic}${f.demo ? '<i class="tag on-pic">Demo</i>' : ""}${ring(pr.d < 0 ? 0 : pr.frac, ic)}</span>
    <span class="fc-t"><b>${esc(f.name)}</b><small>${esc(sub)}</small></span></a>`;
}
