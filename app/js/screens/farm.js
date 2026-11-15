/* My farm: where the field is now (stage from NASA temperatures), today's task, one alert, when to sell, photos. */
import { farms, farm, updateFarm, removeFarm, saveBlob, placeLabel } from "../store.js";
import { takePhotos, preparePhoto, lostPhoto, galleryButton, photoLabel, MSG } from "../photo.js";
import { farmProgress, fetchGdd, farmAlert, sellAdvice, greenness, monthName, CFG, fieldRain, fieldSoil } from "../data.js";
import { fieldTips } from "../tips.js";
import { downloadSeason } from "../calendar.js";
import { answer, whyBody, btn, sheet, note, icon, closeSheet, hero, ring } from "../ui.js";
import { esc, fmt, roughDate, dayMonth, iso, today0, fromIso, MONTHS_LONG } from "../util.js";
import { fieldCard } from "./home.js";
import { hasSession } from "../sync.js";
/* small, optional: back up fields so they follow the farmer to a new phone */
export const backupLink = () => `<a class="sellcard" href="#/backup"><span class="tile-ic photo">${icon(hasSession() ? "cloud-check" : "cloud-upload")}</span><span>${hasSession() ? "Fields backed up" : "Sign in or back up"}<small>${hasSession() ? "They come back on a new phone" : "Your email is enough — no password"}</small></span>${icon("chevron-right")}</a>`;

export const title = (id) => { const f = id && farm(id); return f ? f.name : farms().length === 1 ? farms()[0].name : "My fields"; };
export function render(id) {
  const all = farms();
  if (!id && all.length === 1) id = all[0].id;
  const f = id && farm(id);
  if (!f) {
    return `<div class="stack">
      ${all.length ? `<div class="fgrid">${all.map(fieldCard).join("")}</div>` : answer({ kind: "info", icon: "sprout", title: "No fields yet", sub: "Pick a crop and tap Start planting. Walo then follows your field to harvest." })}
      ${btn("Add a field", { href: "#/start", ic: "plus" })}
      ${all.some((x) => !x.demo) ? backupLink() : ""}
    </div>`;
  }
  return farmView(f, all.length > 1);
}
const ALERT = {
  wet: () => "Harvest time is usually wet here: dry the crop fast.",
  heat: () => "Very hot days often come while it flowers.",
  water: () => "Rain may not be enough this season.",
};
export function sellLine(sa, pr) {
  if (sa.kind === "index") return sa.store ? `Harvest in ${roughDate(pr.harvest)}. Prices usually rise by ${monthName(sa.store.month)}: store if you can.` : `Harvest in ${roughDate(pr.harvest)}. Prices do not usually rise much after: sell soon after harvest.`;
  return sa.guessMonth ? `Harvest in ${roughDate(pr.harvest)}. Best guess: sell around ${monthName(sa.guessMonth)}.` : `Harvest in ${roughDate(pr.harvest)}.`;
}
/* Add photo: one photo at a time; shown at once while it is saved */
let ADD = { id: null, url: "", busy: false, err: "" };
function addState(f) {
  const lost = lostPhoto(`farm:${f.id}`); if (lost) ADD = { id: f.id, url: "", busy: false, err: lost };
  if (ADD.id !== f.id) return "";
  if (ADD.busy) return `<div class="card photo-busy">${ADD.url ? `<img src="${ADD.url}" alt="Your photo" onerror="this.style.visibility='hidden'">` : ""}<p class="busy">${icon("loader-circle", "spin")}<span>Saving your photo…</span></p></div>`;
  return ADD.err ? `<div class="card stack photo-err"><p class="alert">${icon("triangle-alert")}<span>${esc(ADD.err)}</span></p>${galleryButton(`farm:${esc(f.id)}`)}</div>` : "";
}
function farmView(f, many) {
  const pr = farmProgress(f), c = pr.c, photos = f.photos || [], last = photos[photos.length - 1];
  fetchGdd(f).then((changed) => { if (changed) document.dispatchEvent(new Event("walo-refresh")); });
  const left = Math.ceil((pr.harvest - today0()) / 864e5);
  const t = pr.d < 0 ? `Plant on ${dayMonth(pr.start)}` : pr.frac >= 1 ? "Ready to harvest" : left <= CFG().farm.harvest_soon_days ? `Harvest soon: ${roughDate(pr.harvest)}` : `Harvest in ${roughDate(pr.harvest)}`;
  const stage = pr.si >= 0 ? pr.stages[pr.si].name : "Not planted yet";
  const task = pr.task ? pr.task.action : pr.d < 0 ? "Get seed ready. Plant after a good rain." : "";
  const al = farmAlert(pr), sa = sellAdvice(c.id, pr.p, pr.harvest), g = greenness(pr.p), tips = fieldTips(pr), rain = fieldRain(f), soil = fieldSoil(f);
  const gddLine = pr.total ? `Growth counts warmth since planting (growing degree days, base ${pr.g.tb} °C${pr.g.tu != null ? `, top ${pr.g.tu} °C` : ""}): ${fmt(pr.gdd || 0)} of about ${fmt(pr.total)}. ${pr.obs && pr.obs.days ? `NASA POWER daily temperatures at the field up to ${pr.obs.last.replace(/(\d{4})(\d\d)(\d\d)/, "$3/$2/$1")}, usual weather after that.` : "Usual NASA weather for this place (live data loads when online)."} Stages follow FAO-56 Table 11.` : `Dates use a typical ${pr.days}-day season for ${esc(c.name.toLowerCase())}${pr.guessDays ? " (best guess)" : ""}.`;
  const why = whyBody([
    "Walo counts the warmth your crop has had since planting, from NASA temperatures. Warm days make it grow faster, so the harvest date moves a little.",
    g ? `Satellite pictures (NASA MODIS) show fields around here are ${g.word} for ${MONTHS_LONG[g.month - 1]}.` : "",
  ].filter(Boolean), [
    `Planted ${dayMonth(pr.start)}${pr.d >= 0 ? `, day ${pr.d} of about ${pr.days}` : ""}. Harvest about ${dayMonth(pr.harvest)}.`,
    gddLine,
    g ? `NDVI ${fmt(g.ndvi, 2)} on ${g.date}; usual for ${MONTHS_LONG[g.month - 1]} ${fmt(g.usual, 2)} (MODIS MOD13Q1, 2016–2025, via Microsoft Planetary Computer).` : "",
    al && al.kind === "wet" ? `Harvest month: usual rain ${fmt(al.hm.rain_mm)} mm vs ${fmt(al.hm.et0_mm)} mm that dries off (FAO-56 ET0).` : "",
    al && al.kind === "heat" ? `About ${al.fit.hot_days} day(s) above ${al.fit.heat.t} °C usually fall while it flowers.` : "",
    al && al.kind === "water" ? `Usual rain leaves a water deficit of about ${fmt(al.fit.deficit_mm)} mm this season (WRSI ${al.fit.wrsi}).` : "",
    rain && rain.last ? `Rain comes from daily rain data at this point; the newest day in it is ${rain.last.slice(6, 8)}/${rain.last.slice(4, 6)}.` : "",
    soil ? `Root-zone soil wetness ${fmt(soil.soil, 2)} on a 0–1 scale (0 dry, 1 saturated), average of the last ${soil.soilDays} day(s). It is a model of the soil, not a satellite picture of your field.` : "",
    f.demo ? "This is a demo field so you can see how Walo works. Remove it any time." : "",
  ].filter(Boolean));
  const remove = `<button type="button" class="btn danger wide" data-remove="${esc(f.id)}">${icon("trash-2")}<span>Remove this field</span></button>`;
  const photoHtml = `<div class="photos">${photos.length ? photos.slice().reverse().map((ph) => `<figure><img ${imgAttr(ph.src)} alt="Field photo" loading="lazy"><figcaption>${esc(ph.stage || "")}${ph.date ? ` · ${dayMonth(fromIso(ph.date))}` : ph.day ? ` · ${esc(ph.day)}` : ""}</figcaption></figure>`).join("") : `<p class="muted">No photos yet.</p>`}</div>
    ${note("Photos stay on this phone.", "info")}`;
  const ic = pr.frac >= 1 ? "wheat" : pr.si >= 0 ? pr.stages[pr.si].icon : "sprout";
  const heroImg = last && !/^idb:/.test(last.src) ? last.src : last ? "" : c.img;
  const extra = `${last && /^idb:/.test(last.src) ? `<img class="hero-ph" ${imgAttr(last.src)} alt="">` : ""}${f.demo ? '<i class="tag on-pic">Demo</i>' : ""}
    <button type="button" class="pic-count" data-sheet="${sheet(`Photos of ${f.name}`, photoHtml)}" aria-label="${photos.length} photos">${icon("image")}<span>${photos.length}</span></button>`;
  return `${hero({ img: heroImg, eyeIcon: "sprout", eyebrow: `${esc(c.name)} · ${esc(placeLabel(pr.p))}`, title: esc(f.name), extra })}
  <div class="stack lift">
    ${answer({ kind: pr.frac >= 1 ? "now" : "info", tone: pr.frac >= 1 ? "good" : "info", badge: ring(pr.d < 0 ? 0 : pr.frac, ic), title: t, sub: esc(stage), extra: `<ol class="stages" aria-label="Stage: ${esc(stage)}">${pr.stages.map((s, i) => `<li class="${i < pr.si ? "done" : i === pr.si ? "now" : ""}">${icon(s.icon)}<span>${esc(s.name)}</span></li>`).join("")}</ol>`, why: { title: "How Walo knows", html: why + remove }, say: `${f.name}. ${t}. ${stage}. ${task ? "Today: " + task : ""}` })}
    ${task ? `<div class="task">${icon("circle-check")}<div><small>Today</small><b>${esc(task)}</b></div></div>` : ""}
    ${al ? `<p class="alert">${icon(al.icon)}<span>${ALERT[al.kind]()}</span></p>` : ""}
    ${tips.map((t) => `<div class="task">${icon(t.ic)}<div><small>${esc(t.k)}</small><b>${esc(t.text)}</b></div></div>`).join("")}
    ${rain ? `<div class="task">${icon("cloud-rain")}<div><small>Rain at this field</small><b>${fmt(rain.rain)} mm since planting · ${fmt(rain.rain7)} mm in the last 7 days</b></div></div>` : ""}
    ${soil ? `<div class="task">${icon("droplets")}<div><small>Soil at this field</small><b>${soilWord(soil.soil)}</b></div></div>` : ""}
    ${pr.late || pr.frac >= 1 ? `<a class="sellcard" href="#/sell/${c.id}/${esc(f.id)}"><span class="tile-ic sell">${icon("tag")}</span><span>${esc(sellLine(sa, pr))}</span>${icon("chevron-right")}</a>` : ""}
    ${addState(f)}
    <div class="actions3">
      ${photoLabel("camera", `farm:${esc(f.id)}`, `<span class="tile-ic photo">${icon("camera")}</span><span>Add photo</span>`, { cls: "act", disabled: ADD.busy && ADD.id === f.id })}
      <a class="act" href="#/doctor/${c.id}/${esc(f.id)}"><span class="tile-ic doc">${icon("stethoscope")}</span><span>Check plant</span></a>
      <a class="act" href="#/sell/${c.id}/${esc(f.id)}"><span class="tile-ic sell">${icon("tag")}</span><span>Sell</span></a>
    </div>
    ${btn("Add this season to my calendar", { kind: "secondary", ic: "calendar-days", attrs: `data-ics="${esc(f.id)}"` })}
    ${many ? btn("All my fields", { href: "#/farm", kind: "secondary", ic: "leaf" }) : btn("Add a field", { href: "#/start", kind: "secondary", ic: "plus" })}
    ${backupLink()}
  </div>`;
}
/* soil wetness in words: 0 is dust, 1 is saturated. No number on the card, it is in Why?. */
const soilWord = (v) => (v >= 0.6 ? "Still wet from the rain." : v >= 0.3 ? "Has water in it." : "Drying out.");
const imgAttr = (src) => (/^idb:/.test(src || "") ? `src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-ph="${esc(src)}"` : `src="${esc(src)}"`);
async function addPhoto(id, file, rerender) {
  if (ADD.url) URL.revokeObjectURL(ADD.url);
  ADD = { id, url: URL.createObjectURL(file), busy: true, err: "" }; rerender();
  try {
    const { blob } = await preparePhoto(file, { owner: "farm" }); // field photos are kept, so they must open on this phone: no original fallback
    let src; try { src = await saveBlob(blob); } catch { throw new Error(MSG.save); }
    const pr = farmProgress(farm(id));
    URL.revokeObjectURL(ADD.url); ADD = { id: null, url: "", busy: false, err: "" };
    updateFarm(id, (f) => { (f.photos = f.photos || []).push({ src, stage: pr.si >= 0 ? pr.stages[pr.si].name : "Before planting", date: iso(today0()) }); });
  } catch (e) { URL.revokeObjectURL(ADD.url); ADD = { id, url: "", busy: false, err: e.message || MSG.save }; }
  rerender();
}
export function mount(root, _id, _b, rerender) {
  takePhotos("farm", (file, owner) => { const id = owner.slice(5); if (farm(id)) addPhoto(id, file, rerender); });
}
document.addEventListener("click", (e) => {
  const ic = e.target.closest("[data-ics]");
  if (ic) { const fl = farm(ic.dataset.ics); if (fl) downloadSeason(fl, farmProgress(fl)); return; }
  const r = e.target.closest("[data-remove]");
  if (r && confirm("Remove this field and its photos from this phone?")) { removeFarm(r.dataset.remove); closeSheet(true); location.hash = "#/farm"; }
});

