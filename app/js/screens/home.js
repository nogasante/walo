/* Home: my main crop today, the two ways in (my place -> what to plant now; a crop -> where it grows best), Plant Doctor, my fields. */
import { place, placeLabel, placeChosen, farms, setCrop, mainCrop } from "../store.js";
import { crop, farmProgress, plantStatus, CFG } from "../data.js";
import { icon, cropImg, hero, ring } from "../ui.js";
import { esc, roughDate, MONTHS_LONG } from "../util.js";
import { openPlacePicker, openCropPicker, openMainCropPicker } from "./pickers.js";
import { statusLine } from "./words.js";

export const title = () => "Walo";
const greeting = () => { const h = new Date().getHours(); return CFG().greetings.filter(([from]) => h >= from).pop()[1]; };
const card = ({ tag = "a", href, id, ph, ic, title, sub, wide = false, attrs = "" }) =>
  `<${tag} class="pcard${wide ? " wide" : ""}" ${tag === "a" ? `href="${href}"` : `type="button" id="${id}"`} ${attrs}>
    <span class="pc-pic"><img src="${ph.img}" alt="" loading="lazy" style="object-position:${ph.pos}"><span class="badge">${icon(ic)}</span></span>
    <span class="pc-t"><b>${title}</b><small>${sub}</small></span></${tag}>`;
export function render() {
  const p = place(), fs = farms(), P = CFG().photos;
  return `${hero({ img: P.home.img, pos: P.home.pos, eyebrow: `${esc(placeLabel(p))} · ${MONTHS_LONG[new Date().getMonth()]}`, title: `${greeting()}.<br>What do you want to know?` })}
  <div class="stack lift">
    ${focusCard(p, fs)}
    <div class="pgrid">
      ${card({ tag: "button", id: "pick-place", ph: P.plant_here, ic: "map-pin", title: "What to plant here", sub: `Now, in ${esc(placeLabel(p))}` })}
      ${card({ tag: "button", id: "pick-crop", ph: P.where_crop, ic: "sprout", title: "Where my crop grows best", sub: "Pick a crop" })}
      ${card({ href: "#/doctor", ph: P.doctor, ic: "stethoscope", title: "Sick plant?", sub: "Take a photo. Plant Doctor looks at it.", wide: true, attrs: "data-net" })}
    </div>
    <div class="h2row"><h2 class="h2">My fields</h2>${fs.length > 2 ? `<a class="h2link" href="#/farm">All ${fs.length}</a>` : ""}</div>
    <div class="fgrid">${fs.slice(0, 2).map(fieldCard).join("")}${fs.length < 2 ? `<a class="fcard add" href="#/start">${icon("plus")}<b>Add a field</b><small>Walo follows it to harvest</small></a>` : ""}</div>
    <a class="helpbtn" href="#/help/home" data-net><span class="tile-ic talk">${icon("headset")}</span><span class="fo-t"><b>Get help</b><small>Ask Walo by talking or typing</small></span>${icon("chevron-right")}</a>
  </div>`;
}
/* my main crop: one line for today (its field if there is one, else planting here), and a small Change */
function focusCard(p, fs) {
  const id = mainCrop();
  if (!id) return `<button type="button" class="focus empty" id="change-main"><span class="tile-ic">${icon("sprout")}</span><span class="fo-t"><b>Pick your main crop</b><small>Walo then opens on it everywhere</small></span>${icon("chevron-right")}</button>`;
  // only a field she actually made can say "ripening"; a demo field never speaks for her
  const c = crop(id), f = fs.find((x) => !x.demo && x.crop === id), pr = f ? farmProgress(f) : null;
  const line = pr ? (pr.d < 0 ? `Plant ${roughDate(pr.start)}` : pr.frac >= 1 ? "Ready to harvest" : `${pr.stages[pr.si].name} · harvest ${roughDate(pr.harvest)}`) : statusLine(plantStatus(c, p));
  return `<div class="focus"><a class="fo-main" href="${f ? `#/farm/${esc(f.id)}` : `#/crop/${c.id}`}">${cropImg(c, "fo-img")}<span class="fo-t"><small>My main crop</small><b>Your ${esc(c.name.toLowerCase())}</b><span>${esc(line)}</span></span></a>
    <button type="button" class="fo-change" id="change-main" aria-label="Change my main crop">Change</button></div>`;
}
/* a field as a photo card: latest photo, progress ring, name, stage and harvest */
export function fieldCard(f) {
  const pr = farmProgress(f), c = crop(f.crop), last = (f.photos || []).slice(-1)[0];
  const sub = pr.d < 0 ? `Plant ${roughDate(pr.start)}` : pr.frac >= 1 ? "Ready to harvest" : `${pr.stages[pr.si].name} · harvest ${roughDate(pr.harvest)}`;
  const ic = pr.frac >= 1 ? "wheat" : pr.si >= 0 ? pr.stages[pr.si].icon : "sprout";
  const pic = last ? (/^idb:/.test(last.src) ? `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-ph="${esc(last.src)}" alt="">` : `<img src="${esc(last.src)}" alt="" loading="lazy">`) : cropImg(c);
  return `<a class="fcard" href="#/farm/${esc(f.id)}"><span class="fc-pic">${pic}${f.demo ? '<i class="tag on-pic">Demo</i>' : ""}${ring(pr.d < 0 ? 0 : pr.frac, ic)}</span>
    <span class="fc-t"><b>${esc(f.name)}</b><small>${esc(sub)}</small></span></a>`;
}
export function mount(root) {
  root.querySelector("#change-main").addEventListener("click", (e) => openMainCropPicker(e.currentTarget));
  // she already told Walo where her farm is: answer, do not ask again
  root.querySelector("#pick-place").addEventListener("click", (e) => { if (placeChosen()) location.hash = "#/now"; else openPlacePicker("#/now", e.currentTarget); });
  root.querySelector("#pick-crop").addEventListener("click", (e) => openCropPicker("where", e.currentTarget, (id) => { setCrop(id); location.hash = `#/crop/${id}/where`; }));
}
export { openPlacePicker };
