/* Start planting: crop -> field photo (optional) -> when -> saved to My farm. One question per step. */
import { place, placeLabel, addFarm, saveBlob, photoUrlNow } from "../store.js";
import { takePhotos, preparePhoto, lostPhoto, galleryButton, photoLabel, MSG } from "../photo.js";
import { crop, cropGroups, isTree, nextSowDate } from "../data.js";
import { btn, icon, cropImg, note, groupedCrops } from "../ui.js";
import { whenShort } from "./words.js";
import { esc, iso, today0, dayMonth, fromIso } from "../util.js";

let F = { crop: null, step: 0 };
export const title = () => "Start planting";
export function render(id) {
  // a tree crop has no field stages to follow, so it never enters the flow (the router sends it to its crop page)
  if (id && crop(id) && !isTree(crop(id)) && F.crop !== id) F = { crop: id, step: 1, photo: null };
  if (!F.crop || !crop(F.crop) || isTree(crop(F.crop))) F = { crop: null, step: 0 };
  const p = place(), steps = 3, dots = `<p class="steps" aria-label="Step ${F.step + 1} of ${steps}">${[0, 1, 2].map((i) => `<i class="${i <= F.step ? "on" : ""}"></i>`).join("")}</p>`;
  if (F.step === 0) {
    const groups = cropGroups(p), trees = groups.flatMap((g) => g.items.map((x) => x.c)).filter(isTree);
    const tile = (x, g) => `<button type="button" class="tile${isTree(x.c) ? " off" : ""}" data-fcrop="${x.c.id}" ${isTree(x.c) ? "disabled" : ""}>${cropImg(x.c, "tile-img")}<span>${esc(x.c.name)}</span><small class="tile-when">${esc(whenShort(x, g))}</small></button>`;
    return `<div class="stack">${dots}<h1 class="q">What will you plant?</h1>
      ${note(`For ${esc(placeLabel(p))}, today.`, "map-pin")}
      ${groupedCrops(groups, tile, "tiles")}
      ${trees.length ? note(`${trees.map((c) => esc(c.name)).join(" and ")} are trees: Walo cannot follow them as a field yet.`) : ""}</div>`;
  }
  const c = crop(F.crop);
  if (F.step === 1) {
    const lost = lostPhoto("start"); if (lost) F.err = lost;
    const pic = F.busy ? `${F.busy !== true ? `<img src="${F.busy}" alt="Your field" onerror="this.style.visibility='hidden'">` : ""}<p class="busy">${icon("loader-circle", "spin")}<span>Saving your photo…</span></p>`
      : `${F.photo ? `<img src="${photoUrlNow(F.photo)}" alt="Your field">` : icon("camera")}<b>${F.photo ? "Take another" : "Open camera"}</b><small>Stand at the edge so the whole field fits.</small>`;
    return `<div class="stack">${dots}<h1 class="q">Take a photo of your field</h1>
      ${F.err ? `<p class="alert">${icon("triangle-alert")}<span>${esc(F.err)}</span></p>` : ""}
      ${photoLabel("camera", "start", pic, { cls: "snap", attrs: 'id="flow-photo"', disabled: !!F.busy })}
      ${F.busy ? "" : galleryButton("start", 'id="flow-gallery"')}
      ${note("Photos stay on this phone. You can skip this.")}
      ${btn(F.photo ? "Next" : "Skip", { kind: F.photo ? "primary" : "secondary", attrs: `data-fstep="2" ${F.busy ? "disabled" : ""}` })}</div>`;
  }
  const plan = nextSowDate(c, p), t = today0(), future = plan && plan > t;
  return `<div class="stack">${dots}<h1 class="q">When did you plant ${esc(c.name.toLowerCase())}?</h1>
    ${btn("Today", { ic: "sprout", attrs: `data-save="${iso(t)}"` })}
    <label class="field"><span>Another day</span><input type="date" id="flow-date" max="${iso(t)}" value="${F.date || ""}"></label>
    ${F.date ? btn(`Save: planted ${dayMonth(fromIso(F.date))}`, { ic: "circle-check", attrs: `data-save="${F.date}"` }) : ""}
    ${future ? btn(`Not yet: plan for ${dayMonth(plan)}`, { kind: "secondary", ic: "calendar-days", attrs: `data-save="${iso(plan)}"` }) : ""}
    <label class="field"><span>Name (optional)</span><input type="text" id="flow-name" maxlength="40" placeholder="My ${esc(c.name.toLowerCase())} field"></label>
    ${note(`Field in ${esc(placeLabel(p))}.`, "map-pin")}</div>`;
}
function save(date) {
  const p = place(), c = crop(F.crop), name = (document.getElementById("flow-name") || {}).value || `My ${c.name.toLowerCase()} field`;
  const f = { name: name.trim().slice(0, 40), crop: c.id, date, loc: p.kind === "gps" ? null : p.id, place: p.kind === "gps" ? p : undefined,
    photos: F.photo ? [{ src: F.photo, stage: "Field", date: iso(today0()) }] : [] };
  const id = addFarm(f);
  if (id) { F = { crop: null, step: 0 }; location.hash = `#/farm/${id}`; }
}
async function fieldPhoto(file, rerender) {
  const flow = F, url = URL.createObjectURL(file);
  flow.busy = url; flow.err = ""; rerender(); // show it at once
  try {
    const { blob } = await preparePhoto(file, { owner: "start" });
    try { flow.photo = await saveBlob(blob); } catch { throw new Error(MSG.save); }
  } catch (e) { flow.err = e.message || MSG.save; }
  URL.revokeObjectURL(url); flow.busy = false;
  if (flow === F && location.hash.startsWith("#/start")) rerender();
}
export function mount(root, id, _f, rerender) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-fcrop]"); if (t && !t.disabled) { F = { crop: t.dataset.fcrop, step: 1, photo: null }; rerender(); return; }
    const s = e.target.closest("[data-fstep]"); if (s) { F.step = +s.dataset.fstep; rerender(); return; }
    const v = e.target.closest("[data-save]"); if (v) save(v.dataset.save);
  });
  takePhotos("start", (file) => { if (F.crop && F.step === 1) fieldPhoto(file, rerender); });
  const dt = root.querySelector("#flow-date");
  if (dt) dt.addEventListener("change", () => { F.date = dt.value && fromIso(dt.value) <= today0() ? dt.value : null; rerender(); });
}
