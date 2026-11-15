/* After this crop: the rotation answer the Field Shift brief asks for. Three or four crops (always including the
   crop already in the field, so "maize again" is compared and not hidden), scored on what each does to the soil,
   the water the usual NASA rain gives, the heat at flowering and the usual price pattern, weighted by what she
   says matters most. Rules of thumb are labelled as such; the numbers are in the Why? sheet. */
import { place, placeLabel, priority, setPriority, soilChoice, setSoilChoice, farm, mainCrop } from "../store.js";
import { crop, farmPlace, farmProgress, scoreCrop, CFG } from "../data.js";
import { rotationOptions, PRIORITIES, SOILS, scoreChip } from "../rotation.js";
import { answer, whyBody, btn, note, hero, emptyState, icon, sheet } from "../ui.js";
import { esc, fmt, monthName } from "../util.js";

export const title = (id) => { const c = crop(id); return c ? `After ${c.name.toLowerCase()}` : "After this crop" };

function optionCard(o, top) {
  const role = (o.r && o.r.role) || "";
  const sc = scoreChip(o.pct);
  const why = whyBody(
    [o.same ? `This is what you grow now, so it is the one to beat. ${role}.` : `${role}.`].concat(o.reasons.slice(0, 2)),
    [
      o.r ? `After harvest it leaves ${o.r.cover} of 3 for ground cover, uses ${o.r.water} of 3 for water, and is a ${o.r.family}${o.r.n_fix ? " that fixes nitrogen" : ""}.` : "",
      `FAO-56 water balance for the usual season here: needs about ${fmt((scoreCrop(o.c, farmPlaceNow()).fit || {}).need_mm)} mm, effective rain ${fmt((scoreCrop(o.c, farmPlaceNow()).fit || {}).peff_mm)} mm, WRSI ${(scoreCrop(o.c, farmPlaceNow()).fit || {}).wrsi ?? "not judged"}.`,
      o.hot ? `About ${Math.round(o.hot)} days above ${((scoreCrop(o.c, farmPlaceNow()).fit || {}).heat || {}).t || 35} °C usually fall while it flowers.` : "",
      `Score ${o.pct} of 100 (water ${Math.round(o.water * 100)}, soil ${Math.round(o.soilScore * 100)}, money ${Math.round(o.money * 100)}, heat ${Math.round(o.risk * 100)}), weighted for "${PRIORITIES.find((x) => x.id === priority()).label.toLowerCase()}" on a ${soilChoice()} soil.`,
      "Crop traits are extension rules of thumb (IITA, MoFA crop guides); rain and heat come from NASA POWER.",
    ].filter(Boolean),
  );
  return `<article class="nextcard">
    <div class="nc-top">
      ${o.c.img ? `<img class="nc-img" src="${esc(o.c.img)}" alt="" loading="lazy" style="object-position:${esc(o.c.pos || "50% 50%")}">` : ""}
      <div class="nc-t"><b>${esc(o.same ? `${o.c.name} again` : o.c.name)}</b><small>${esc(role)}</small></div>
      <span class="chip ${sc.kind}">${sc.text}</span>
    </div>
    <p class="nc-why">${esc(o.reasons[0] || "")}</p>
    ${o.risks.length ? `<p class="nc-risk">${icon("triangle-alert")}<span>${esc(o.risks[0])}</span></p>` : ""}
    <div class="nc-acts">
      ${btn(o.same ? "Plant it again" : "Plant this", { href: `#/start/${esc(o.c.id)}`, ic: "sprout" })}
      <button type="button" class="btn secondary" data-sheet="${sheet(`Why ${o.c.name}?`, why)}">Why?</button>
    </div>
  </article>`;
}

let PLACE_NOW = null; // the place the cards were built for, so the Why? text uses the same one
const farmPlaceNow = () => PLACE_NOW || place();

export function render(id, fid) {
  const after = crop(id);
  const f = fid ? farm(fid) : null;
  if (!after) return emptyState({ ic: "sprout", title: "Pick the crop in the field first", sub: "Walo needs to know what is growing to say what should follow it.", action: "My fields", href: "#/farm" });
  const p = f ? farmPlace(f) : place();
  PLACE_NOW = p;
  const pr = f ? farmProgress(f) : null;
  const { options } = rotationOptions(after.id, p, { soil: soilChoice(), priority: priority() });
  if (!options.length) return emptyState({ ic: "sprout", title: `No crops to follow ${after.name.toLowerCase()} here`, sub: "Walo has no other crop for this place yet.", action: "Try another place", href: "#/welcome" });
  const top = options[0], prio = priority(), soil = soilChoice();
  const when = pr ? `Your ${after.name.toLowerCase()} comes off around ${monthName(pr.harvest.getMonth() + 1).toLowerCase()}. ` : "";
  const headline = top.same
    ? `Keep ${after.name.toLowerCase()} in this field`
    : `Plant ${top.c.name.toLowerCase()} after your ${after.name.toLowerCase()}`;
  const sub = `${when}${top.reasons[0] || ""}${top.reasons[1] ? ` ${top.reasons[1]}` : ""}`;
  const why = whyBody(
    [
      "Walo scores each crop on what it leaves in the soil, how much of its water the usual rain here covers (FAO-56), the heat while it flowers, and its usual price pattern.",
      `Right now it is weighted for ${PRIORITIES.find((x) => x.id === prio).label.toLowerCase()}, on a ${soil} soil. Change either and the order changes.`,
    ],
    ["NASA POWER daily rain and temperature 1991–2025 at this point; FAO-56 stage lengths and crop coefficients; EcoCrop temperature limits; WFP/MoFA price records for the usual price pattern.", "Crop rotation traits are extension rules of thumb from the IITA and MoFA guides cited per crop, not measurements from your field."],
  );
  return `${hero({ img: CFG().photos.home.img, pos: CFG().photos.home.pos, eyeIcon: "refresh-cw", eyebrow: `${esc(after.name)} · ${esc(placeLabel(p))}`, title: after.name === "Maize" ? "After the maize" : `After the ${after.name.toLowerCase()}` })}
  <div class="stack lift">
    ${answer({ kind: top.same ? "info" : "now", tone: top.same ? "info" : "good", ic: "refresh-cw", title: esc(headline), sub: esc(sub), why: { title: "How Walo chose", html: why }, say: `${headline}. ${sub}` })}
    <div class="seg3" role="group" aria-label="What matters most">
      ${PRIORITIES.map((x) => `<button type="button" class="seg${x.id === prio ? " on" : ""}" data-prio="${x.id}" aria-pressed="${x.id === prio}">${icon(x.ic)}<span>${x.label}</span></button>`).join("")}
    </div>
    <p class="seg-line">${esc(PRIORITIES.find((x) => x.id === prio).line)}</p>
    <div class="soilline"><span>Your soil</span>
      ${SOILS.map((x) => `<button type="button" class="soilchip${x.id === soil ? " on" : ""}" data-soil="${x.id}" aria-pressed="${x.id === soil}">${x.label}</button>`).join("")}
    </div>
    ${options.map((o) => optionCard(o, top)).join("")}
    <p class="note-text">${esc(SOILS.find((x) => x.id === soil).plain)}. Walo cannot test your soil; pick what it looks and feels like.</p>
    ${note("Walo compares what each crop does to the soil and the rain. You decide what fits your farm.", "info")}
    ${f ? btn("Back to the field", { href: `#/farm/${esc(f.id)}`, kind: "secondary", ic: "sprout" }) : ""}
  </div>`;
}

export function mount(root, id) {
  root.addEventListener("click", (e) => {
    const pr = e.target.closest("[data-prio]");
    if (pr) { setPriority(pr.dataset.prio); return; }
    const so = e.target.closest("[data-soil]");
    if (so) setSoilChoice(so.dataset.soil);
  });
}
