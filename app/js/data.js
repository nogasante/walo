/* Walo data layer: loads data/*.json once and answers every question the screens ask.
   Methods live in lib/agro.js (window.AGRO) and every threshold in data/rules.json; see DESIGN.md "Methods".
   No place, market or crop names are written in this file. */
import { MONTHS_LONG, DAY, today0, doyOfDate, km, runs, iso } from "./util.js";

const A = () => window.AGRO;
export const D = {};
const FILES = ["app", "rules", "countries", "crops", "places", "agro", "ndvi", "market", "prices", "credits", "ghana-map", "help"];
export async function load() {
  const js = await Promise.all(FILES.map((n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })));
  FILES.forEach((n, i) => { D[n.replace("-", "_")] = js[i]; });
  D.cropList = D.crops.crops;
}
export const CFG = () => D.app;
export const R = () => D.rules;

/* ---------- country ---------- */
/* Everything a country changes lives in data/countries.json: which coordinates are accepted, the money on
   Sell, the rain-season search windows, the zone names and the map. No country name is written in this file. */
const COUNTRIES = () => D.countries || { default: "GH", countries: {} };
export const country = (id) => { const c = COUNTRIES(), k = id || c.default; return c.countries[k] ? { id: k, ...c.countries[k] } : null; };
export const currency = () => { const c = country(); return (c && c.currency && c.currency.code) || ""; };
export const inCountry = (lat, lon) => Object.values(COUNTRIES().countries).some((c) => c.status === "live" && lat >= c.bbox.lat[0] && lat <= c.bbox.lat[1] && lon >= c.bbox.lon[0] && lon <= c.bbox.lon[1]);
/* rules.json holds the physical onset rule; the country holds where to look for the season. A southern-hemisphere
   country points these windows at its own rainy months; nothing else in the method changes. */
export const onsetRules = () => {
  const r = R(), o = (country() || {}).onset;
  if (!o) return r;
  return { ...r, onset: { ...r.onset, major_search: o.major_search || r.onset.major_search, minor_search: o.minor_search || r.onset.minor_search } };
};

/* ---------- crops ---------- */
export const crop = (id) => D.cropList.find((c) => c.id === id);
export const crops = () => D.cropList;
export const isTree = (c) => c.kind === "tree";

/* ---------- places ---------- */
export const towns = () => Object.entries(D.places.places).map(([id, p]) => ({ id, kind: "town", ...p }));
export const town = (id) => (D.places.places[id] ? { id, kind: "town", ...D.places.places[id] } : null);
export function nearestTown(pt, except) {
  return towns().filter((t) => t.id !== except).map((t) => ({ t, d: km(pt, t) })).sort((a, b) => a.d - b.d)[0];
}
/* zone: the town's FAO zone; a phone location takes the zone of its nearest town. null = outside FAO's zone text (climate only). */
export const zoneOf = (p) => (p.kind === "gps" ? p.zone : p.zone == null ? null : p.zone);
export const zoneName = (z) => {
  if (!z) return null;
  const cz = (country() || {}).zones;
  return (cz && cz[z] && cz[z].name) || (CFG().zones[z] && CFG().zones[z].name) || null;
};
const baseId = (p) => (p.kind === "gps" ? p.near_id : p.id);
export function agroOf(p) {
  if (p.agro) return p.agro;
  return D.agro.places[p.id] || D.agro.places[nearestTown(p).t.id];
}
export const climateOnly = (p) => zoneOf(p) == null;
export const cropsHere = (p) => (climateOnly(p) ? crops().slice() : crops().filter((c) => c.zones[zoneOf(p)]));
export function confFor(c, p) { return c.confidence[baseId(p)] || (c.confidence_zone || {})[zoneOf(p)] || "Low"; }
const CONF_ORDER = { High: 0, Medium: 1, Low: 2 };

/* ---------- suitability: EcoCrop climate class + FAO-56 water class (the lower one is shown) ---------- */
const seasons = (ag) => ["major", "minor"].filter((s) => ag.onset[s] && ag.onset[s].median != null);
export const cropDays = (c) => c.days_typical || (c.eco && c.eco.cycle_days && c.eco.cycle_days.min) || R().season_days_default.value;
const usesWater = (c, f) => !!f && c.kind === "seasonal" && f.days <= R().water.wrsi_max_season_days;
const fitAt = (c, ag, doy) => (c.fao56 && c.fao56.stage_days ? A().seasonFit(c, ag.months, doy, R()) : null);
const memo = (m, k, f) => (m.has(k) ? m.get(k) : (m.set(k, f()), m.get(k)));
const _sc = new Map(), _cm = new Map();
const pkey = (p) => `${p.id}|${p.lat}|${p.lon}`;

export function scoreCrop(c, p) {
  return memo(_sc, `${c.id}|${pkey(p)}`, () => {
    const ag = agroOf(p), eco = A().ecocrop(c, ag.months), cl = R().suitability.classes;
    const best = seasons(ag).map((s) => ({ s, f: fitAt(c, ag, ag.onset[s].median) })).filter((x) => x.f).sort((a, b) => b.f.wrsi - a.f.wrsi)[0] || null;
    const f = best && best.f, water = usesWater(c, f);
    const ecoCls = eco ? A().classOf(eco.suit, R()) : cl[cl.length - 1];
    const score = Math.min(ecoCls.dots, water ? f.water_dots : 5), cls = cl.find((k) => k.dots === score) || ecoCls;
    return { score, cls, ecoCls, eco, fit: f, season: best && best.s, water, fine: (eco ? eco.suit : 0) + (water ? f.wrsi / 100 : 1) };
  });
}
/* plain words for the class: S1/S2 grows well, S3 can grow, below that grows poorly */
export function fitWord(sc) {
  if (sc.score >= 4) return { cls: "good", text: "Grows well" };
  if (sc.score === 3) return { cls: "wait", text: "Can grow" };
  return { cls: "bad", text: "Grows poorly" };
}

/* ---------- planting months: sourced calendar where one exists, otherwise onset of rains + FAO-56 water check ---------- */
export function cropMonths(c, p) {
  return memo(_cm, `${c.id}|${pkey(p)}`, () => {
    const w = c.windows[zoneOf(p)] || [], sow = [], harvest = [];
    const add = (x) => { x.sow.forEach((m) => sow.includes(m) || sow.push(m)); x.harvest.forEach((m) => harvest.includes(m) || harvest.push(m)); };
    if (w.length) {
      w.forEach(add);
      return { sow: sow.sort((a, b) => a - b), harvest, windows: w, guess: w.every((x) => x.best), allYear: w.some((x) => x.all_year) };
    }
    const ag = agroOf(p), ws = [];
    seasons(ag).forEach((s) => { // best guess: from the 2-in-10 to the 8-in-10 onset date of each season that gives the crop enough water
      if (isTree(c) && s !== "major") return;
      const o = ag.onset[s], f = fitAt(c, ag, o.median);
      if (usesWater(c, f) && f.water_class.cls === "bad") return;
      const ms = []; for (let d = o.p20; d <= o.p80; d += 5) { const m = A().monthOfDoy(d) + 1; if (!ms.includes(m)) ms.push(m); }
      const em = A().monthOfDoy(o.p80) + 1; if (!ms.includes(em)) ms.push(em);
      const h = isTree(c) ? null : A().monthOfDoy(o.median + cropDays(c)) + 1;
      ws.push({ sow: ms, harvest: h ? [h] : [], season: s, onset: o, best: true });
    });
    ws.forEach(add);
    return { sow: sow.sort((a, b) => a - b), harvest, windows: ws, guess: true, allYear: false };
  });
}

/* ---------- 10-day forecast (Meteomatics via /api/forecast; the login stays on the server) ---------- */
const FC = {};
let onForecast = () => {};
export const setForecastListener = (fn) => { onForecast = fn; };
const fcKey = (p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
export function forecastFor(p) {
  const k = fcKey(p), x = FC[k], age = CFG().forecast.max_age_h * 3600e3;
  if (x && x.t > Date.now() - age) return x.data;
  if (!x || !x.loading) loadForecast(p, k, age);
  return x ? x.data : null;
}
async function loadForecast(p, k, age) {
  FC[k] = { t: 0, data: (FC[k] || {}).data || null, loading: true };
  try {
    const sv = JSON.parse(localStorage.getItem("walo.fc." + k) || "null");
    if (sv && sv.t > Date.now() - age) { FC[k] = { t: sv.t, data: sv.data }; onForecast(); return; }
  } catch { /* ignore */ }
  if (!navigator.onLine) { FC[k] = { t: Date.now(), data: null }; onForecast(); return; }
  try {
    const r = await fetch(`${CFG().forecast.endpoint}?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`), j = await r.json();
    if (!r.ok || !j.ok || !j.days || !j.days.length) throw new Error("no forecast");
    FC[k] = { t: Date.now(), data: j };
    try { localStorage.setItem("walo.fc." + k, JSON.stringify(FC[k])); } catch { /* storage full */ }
  } catch { FC[k] = { t: Date.now(), data: null }; } // Walo still answers from NASA climatology alone
  onForecast();
}
/* the onset rule applied to the forecast days (the dry-spell part can only see the days the forecast covers) */
export function fcOnset(fc) {
  if (!fc) return null;
  const O = R().onset, d = fc.days, total = Math.round(d.reduce((a, x) => a + x.rain_mm, 0));
  for (let i = 0; i + O.rain_days <= d.length; i++) {
    if (d[i].rain_mm < O.wet_day_mm) continue;
    const s = d.slice(i, i + O.rain_days).reduce((a, x) => a + x.rain_mm, 0);
    if (s >= O.rain_mm) return { date: new Date(d[i].date + "T00:00:00"), mm: Math.round(s), total, days: d.length };
  }
  return { date: null, total, days: d.length };
}

/* ---------- "plant now?" for one crop, this place, today ----------
   kinds: now (plant), wait (in the window but no planting rain yet), water (only with watering), later (next window), no (no month here) */
export function plantStatus(c, p) {
  const m = new Date().getMonth() + 1, d = doyOfDate(today0()), cm = cropMonths(c, p), ag = agroOf(p), cur = ag.months[m - 1];
  const fc = forecastFor(p), fo = fcOnset(fc);
  const rainCheck = (base) => { // the forecast decides when there is one; climatology otherwise
    if (fo) return fo.date ? { kind: "now", rainDate: fo.date, fo, base } : { kind: "wait", fo, base };
    return base === "before" ? { kind: "wait", base } : { kind: "now", base };
  };
  if (cm.allYear) return cur.lgp ? { ...rainCheck("in"), allYear: true } : { kind: "water", allYear: true, cur };
  if (!cm.sow.length) return { kind: "no" };
  if (cm.sow.includes(m)) {
    const f = fitAt(c, ag, d);
    if (usesWater(c, f) && f.water_class.cls === "bad") return { kind: "water", fit: f, cur };
    const near = seasons(ag).map((s) => ({ s, o: ag.onset[s], dd: ((d - ag.onset[s].median + 545) % 365) - 180 })).sort((a, b) => Math.abs(a.dd) - Math.abs(b.dd))[0];
    return { ...rainCheck(near && near.dd < 0 && d < near.o.p20 ? "before" : "in"), season: near, fit: f };
  }
  const next = runs(cm.sow).map((r) => ({ m: r[0], k: (r[0] - m + 12) % 12 || 12 })).sort((a, b) => a.k - b.k)[0];
  return { kind: "later", month: next.m, months: next.k };
}
const KIND_ORDER = { now: 0, wait: 1, water: 2, later: 3, no: 9 };
/* every crop for one place, grouped by when it can be planted (app.json crop_groups): now, water, soon, later, no.
   Order: now, wait, water, later (soonest first), then best fit; crops outside the place's FAO zones or below "can grow" go to "no". */
export function cropGroups(p) {
  const G = CFG().crop_groups, here = new Set(cropsHere(p).map((c) => c.id));
  const items = crops().map((c) => ({ c, sc: scoreCrop(c, p), conf: confFor(c, p), st: plantStatus(c, p), here: here.has(c.id) }));
  const keyOf = (x) => {
    if (!x.here || x.st.kind === "no" || x.sc.score < G.min_score) return "no";
    if (x.st.kind === "now") return "now";
    if (x.st.kind === "water") return "water";
    if (x.st.kind === "wait" || (x.st.kind === "later" && x.st.months <= G.soon_months)) return "soon";
    return "later";
  };
  const sort = (a, b) => KIND_ORDER[a.st.kind] - KIND_ORDER[b.st.kind] || (a.st.months || 0) - (b.st.months || 0) || b.sc.score - a.sc.score || CONF_ORDER[a.conf] - CONF_ORDER[b.conf] || b.sc.fine - a.sc.fine || a.c.name.localeCompare(b.c.name);
  return G.groups.map((g) => ({ ...g, items: items.filter((x) => keyOf(x) === g.key).sort(sort) })).filter((g) => g.items.length);
}
/* "pick a crop": every town for one crop, best first; towns outside the crop's FAO zones go last */
export function placeList(c) {
  return towns().map((t) => { const z = zoneOf(t), listed = z == null || !!c.zones[z]; return { p: t, listed, sc: scoreCrop(c, t), conf: z == null ? "Low" : confFor(c, t) }; })
    .sort((a, b) => b.listed - a.listed || b.sc.score - a.sc.score || CONF_ORDER[a.conf] - CONF_ORDER[b.conf] || b.sc.fine - a.sc.fine || a.p.name.localeCompare(b.p.name));
}
/* next sowing date, for a plan: today if the window is open, else the first day of the next window */
export function nextSowDate(c, p) {
  const st = plantStatus(c, p), t = today0();
  if (st.kind === "later") { const y = t.getFullYear() + (st.month < t.getMonth() + 1 ? 1 : 0); return new Date(y, st.month - 1, 1); }
  if (st.kind === "no") return null;
  return st.rainDate || t;
}

/* ---------- satellite greenness (NASA MODIS NDVI via Microsoft Planetary Computer) ---------- */
export function greenness(p) {
  const P = D.ndvi.places, v = P[baseId(p)] || P[nearestTown(p).t.id];
  if (!v || !v.latest) return null;
  const lm = +v.latest.date.slice(5, 7), usual = v.months[lm - 1], diff = v.latest.ndvi - usual, band = R().ndvi.usual_band;
  return { word: diff > band ? "greener than usual" : diff < -band ? "less green than usual" : "about as green as usual", ndvi: v.latest.ndvi, usual, date: v.latest.date, month: lm };
}

/* ---------- a field: stages from growing degree days (NASA POWER), climatology for the days not yet published ---------- */
const STAGE_NAMES = (c) => [["Sprouting", "sprout"], ["Growing", "leaf"], [c.root_crop ? "Bulking" : "Flowering", c.root_crop ? "carrot" : "flower-2"], ["Ripening", "sun"], ["Harvest", "wheat"]];
const climGdd = (ag, doy, g) => { const m = ag.months[A().monthOfDoy(doy)]; return A().gddDay(m.tmax_c, m.tmin_c, g); };
const gddCache = () => { try { return JSON.parse(localStorage.getItem("walo.gdd") || "{}"); } catch { return {}; } };
export function farmPlace(f) {
  if (f.place && f.place.kind === "gps") return f.place;
  return town(f.loc) || town(CFG().default_place);
}
export function farmProgress(f) {
  const c = crop(f.crop), p = farmPlace(f), ag = agroOf(p), start = new Date(f.date + "T00:00:00"), d = Math.round((today0() - start) / DAY);
  const sow = doyOfDate(start), fit = fitAt(c, ag, sow), g = A().gddBase(c, R());
  let st = R().stages_default.fractions, frac, harvest, gdd = null, total = null, obs = null, days = cropDays(c);
  if (fit && g && fit.gdd) {
    total = fit.gdd; days = fit.days;
    const cum = fit.gdd_stages.reduce((a, x) => (a.push(a[a.length - 1] + x), a), [0]); st = cum.slice(0, 4).map((x) => x / total);
    obs = gddCache()[`${f.id}|${f.date}|${f.loc || ""}`] || null;
    let acc = 0, k0 = 0;
    if (obs && obs.days) { acc = obs.gdd; k0 = Math.min(obs.days, Math.max(0, d)); }
    for (let k = k0; k < Math.max(0, d); k++) acc += climGdd(ag, sow + k, g);
    gdd = Math.round(acc); frac = d < 0 ? 0 : acc / total;
    let k = Math.max(0, d), a2 = d < 0 ? 0 : acc; while (a2 < total && k < 3 * days) { a2 += climGdd(ag, sow + k, g); k++; }
    harvest = new Date(start.getTime() + k * DAY);
  } else { frac = Math.max(0, d / days); harvest = new Date(start.getTime() + days * DAY); }
  const names = STAGE_NAMES(c), stages = names.map(([name, icon], i) => ({ name, icon, at: i < 4 ? st[i] : 1 }));
  const si = d < 0 ? -1 : frac >= 1 ? 4 : stages.reduce((a, s, i) => (i < 4 && frac >= s.at ? i : a), 0);
  const steps = c.stages || [];
  const task = d < 0 ? null : frac >= 1 ? steps[steps.length - 1] || null : steps.reduce((a, s) => (frac >= s.at ? s : a), steps[0] || null);
  const late = d >= 0 && frac >= st[3];
  return { c, p, ag, fit, g, start, d, frac, stages, si, task, harvest, gdd, total, obs, late, days: Math.round((harvest - start) / DAY), guessDays: !c.days_typical && !(fit && fit.gdd) };
}
/* heat units since sowing from NASA POWER daily T2M_MAX/T2M_MIN at the field, cached on the phone */
export async function fetchGdd(f) {
  const c = crop(f.crop), g = c && A().gddBase(c, R()), p = farmPlace(f), all = gddCache(), k = `${f.id}|${f.date}|${f.loc || ""}`, today = iso(today0());
  // an entry saved before soil wetness or humidity was asked for is fetched once more, so those appear today
  if (!g || !navigator.onLine || f.date >= today || (all[k] && all[k].fetched === today && all[k].soil !== undefined && all[k].rh !== undefined)) return false;
  try {
    const r = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,RH2M&community=AG&longitude=${p.lon.toFixed(4)}&latitude=${p.lat.toFixed(4)}&start=${f.date.replace(/-/g, "")}&end=${today.replace(/-/g, "")}&format=JSON`);
    if (!r.ok) return false;
    const P = (await r.json()).properties.parameter, ks = Object.keys(P.T2M_MAX).sort();
    let gdd = 0, days = 0, rain = 0;
    const rains = [], soils = [], rhs = [];
    for (const day of ks) {
      const tx = P.T2M_MAX[day], tn = P.T2M_MIN[day];
      if (tx == null || tn == null || tx <= -900 || tn <= -900) break;
      gdd += A().gddDay(tx, tn, g); days++;
      const mm = P.PRECTOTCORR ? P.PRECTOTCORR[day] : null;
      if (mm != null && mm > -900) { rain += mm; rains.push(mm); } else rains.push(0);
      const sm = P.GWETROOT ? P.GWETROOT[day] : null;
      if (sm != null && sm > -900) soils.push(sm);
      const hu = P.RH2M ? P.RH2M[day] : null;
      if (hu != null && hu > -900) rhs.push(hu);
    }
    const rain7 = rains.slice(-7).reduce((a, b) => a + b, 0);
    // root-zone soil wetness (0 dry, 1 saturated) is the one number that says whether the rain
    // reached the soil under this crop, so it is kept beside the rain for the field screen.
    const soilLast7 = soils.slice(-7);
    const soil = soilLast7.length ? +(soilLast7.reduce((a, b) => a + b, 0) / soilLast7.length).toFixed(2) : null;
    // rain since sowing is what tells a farmer whether this season is wet or dry at HER field,
    // not at the district: NASA POWER daily precipitation, same call as the temperatures.
    const rhLast7 = rhs.slice(-7);
    const rh = rhLast7.length ? Math.round(rhLast7.reduce((a, b) => a + b, 0) / rhLast7.length) : null;
    all[k] = { gdd: Math.round(gdd), days, last: days ? ks[days - 1] : null, rain: Math.round(rain), rain7: Math.round(rain7), soil, soilDays: soilLast7.length, rh, fetched: today };
    localStorage.setItem("walo.gdd", JSON.stringify(all));
    return true;
  } catch { return false; }
}
/* what NASA POWER says fell at this field: total since planting and the last 7 days */
export const fieldRain = (f) => { const c = gddCache()[`${f.id}|${f.date}|${f.loc || ""}`]; return c && c.rain != null ? c : null; };
/* root-zone soil wetness at the field, 0 (dry) to 1 (saturated), averaged over the last 7 days */
export const fieldSoil = (f) => { const c = gddCache()[`${f.id}|${f.date}|${f.loc || ""}`]; return c && c.soil != null ? c : null; };
/* one alert for the stage the field is in now (or none) */
export function farmAlert(pr) {
  const { c, fit, ag, si, harvest } = pr;
  if (si < 0) return null;
  const hm = ag.months[harvest.getMonth()];
  if (si >= 3 && c.dry_harvest && hm.rain_mm >= R().growing_period.humid_rain_over_et0 * hm.et0_mm) return { icon: "cloud-rain", kind: "wet", hm };
  if (si === 2 && fit && fit.hot_days > 0 && (fit.heat.cited || c.heat_sensitive_stage)) return { icon: "thermometer-sun", kind: "heat", fit };
  if (si <= 2 && fit && usesWater(c, fit) && fit.deficit_mm > 0 && fit.water_class.cls !== "good") return { icon: "droplets", kind: "water", fit };
  return null;
}

/* ---------- selling: WFP/HDX seasonal price index (2015-2023), MoFA SRID 2025 spot prices, or a best guess ---------- */
const S = () => R().sell;
const mkByName = (n) => D.market.markets.find((x) => x.name === n);
export const unitText = (u) => u.replace(/\s*\(.*\)/, "").replace(/^(\d+) KG$/, "$1 kg bag").replace(/^KG$/, "kg").replace(/^Bunch$/, "bunch").replace(/^100 Tubers$/, "100 tubers").replace(/^Piece$/, "piece");
export function marketsFor(cropId, pt) {
  const m = D.market.crops[cropId]; if (!m) return [];
  return m.series.map((s) => { const mk = mkByName(s.market); return mk && { ...mk, s, km: Math.round(km(pt, mk)) }; }).filter(Boolean).sort((a, b) => a.km - b.km);
}
const idx = (s, m) => s.index[((m - 1) % 12 + 12) % 12];
export function sellAdvice(cropId, pt, harvest = null) {
  const c = crop(cropId), m = D.market.crops[cropId], near = marketsFor(cropId, pt), years = D.market.index_years;
  const out = { c, years, harvest };
  if (near.length) {
    const n = near[0], s = n.s;
    Object.assign(out, { kind: "index", market: n, unit: unitText(s.unit), label: s.crop_label, peak: s.peak_month, dip: s.dip_month, thin: s.thin, last: s.last, s });
    if (harvest) {
      const hm = harvest.getMonth() + 1, W = S().store_window_months.value; let best = hm;
      for (let k = 1; k <= W; k++) { const mm = ((hm - 1 + k) % 12) + 1; if (idx(s, mm) != null && (idx(s, best) == null || idx(s, mm) > idx(s, best))) best = mm; }
      const gain = idx(s, hm) ? idx(s, best) / idx(s, hm) - 1 : 0;
      out.store = gain >= S().store_gain_min.value ? { month: best, gain } : null;
    }
    const cmp = m.compare, mine = cmp && s.crop_label === cmp.crop_label && s.unit === cmp.unit ? s.recent_avg : null;
    if (mine) {
      const better = near.slice(1).filter((x) => x.km <= S().compare_max_km.value && x.s.crop_label === cmp.crop_label && x.s.unit === cmp.unit && x.s.recent_avg >= mine * (1 + S().compare_gain_min.value))
        .sort((a, b) => b.s.recent_avg - a.s.recent_avg)[0];
      if (better) out.better = { market: better, gain: better.s.recent_avg / mine - 1, unit: unitText(cmp.unit) };
    }
    return out;
  }
  const hv = harvest ? [harvest.getMonth() + 1] : cropMonths(c, pt).harvest;
  const guess = hv.length ? ((hv[hv.length - 1] - 1 + S().best_guess_months_after_harvest.value) % 12) + 1 : null;
  Object.assign(out, { kind: m && m.srid2025.length ? "spot" : "guess", guessMonth: guess });
  if (out.kind === "spot") {
    const rows = m.srid2025, lab = Object.entries(rows.reduce((a, r) => ((a[r.crop_label] = (a[r.crop_label] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0][0];
    const use = rows.filter((r) => r.crop_label === lab), mk = mkByName(use[0].market);
    out.spot = { market: use[0].market, km: mk ? Math.round(km(pt, mk)) : null, label: lab, lo: Math.min(...use.map((r) => r.min)), hi: Math.max(...use.map((r) => r.max)) };
  }
  return out;
}
export const monthName = (m) => MONTHS_LONG[m - 1];

/* ---------- what markets pay now: MoFA SRID's two-weekly collection, per kilogram ---------- */
/* WFP's Ghana series stops in July 2023, so the seasonal index says when prices usually rise, and this
   says what a market actually paid in the last fortnight. Nearest markets first, wholesale preferred
   because that is what a farmer selling a bag gets. */
export function priceNear(cropId, pt, n = 3) {
  const P = D.prices && D.prices.crops[cropId];
  if (!P) return [];
  const out = [];
  for (const [name, mk] of Object.entries(P.mk)) {
    const m = D.prices.markets[name];
    if (!m) continue;
    // SRID's newest week is not the same for retail and wholesale in every market, so show the newer one
    const pick = [mk.w && { type: "wholesale", v: mk.w.v, d: mk.w.d, prev: mk.w4 || null }, mk.r && { type: "retail", v: mk.r.v, d: mk.r.d, prev: null }]
      .filter(Boolean).sort((a, b) => b.d.localeCompare(a.d))[0];
    if (!pick) continue;
    out.push({ name, km: Math.round(km(pt, m)), ...pick, label: P.label });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

/* ---------- "Use my location": NASA POWER daily for this point, summarised on the phone with the same methods ---------- */
export async function fetchLive(lat, lon) {
  const [y0, y1] = CFG().periods.live;
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${y0}0101&end=${y1}1231&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("POWER " + res.status);
  const j = await res.json(), P = j.properties.parameter, z = j.geometry.coordinates[2] || 0;
  const days = {}; for (const k of Object.keys(P.PRECTOTCORR)) days[k] = { P: P.PRECTOTCORR[k], tmax: P.T2M_MAX[k], tmin: P.T2M_MIN[k], t: P.T2M[k], rh: P.RH2M[k], ws: P.WS2M[k], rs: P.ALLSKY_SFC_SW_DWN[k] };
  const RR = onsetRules(), n = nearestTown({ lat, lon }), zone = n.t.zone == null ? null : n.t.zone;
  const agro = { lat, lon, elev_m: Math.round(z), zone, ...A().summarize(days, lat, z, [y0, y1], RR, zone != null && (RR.onset.minor_search.zones || []).includes(zone)) };
  return { id: "gps", kind: "gps", lat, lon, zone, near_id: n.t.id, near_km: Math.round(n.d), agro, fetched: iso(today0()) };
}
/* nearest village or town name for a phone location (OpenStreetMap Nominatim, cached) */
export async function placeName(lat, lon) {
  const G = CFG().geocode, k = `walo.geo.${lat.toFixed(3)},${lon.toFixed(3)}`;
  try { const c = localStorage.getItem(k); if (c) return c; } catch { /* ignore */ }
  try {
    const r = await fetch(`${G.endpoint}?format=jsonv2&zoom=${G.zoom}&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&accept-language=en`);
    if (!r.ok) return null;
    const a = (await r.json()).address || {}, name = a.village || a.town || a.city || a.suburb || a.hamlet || a.municipality || a.county || null;
    if (name) try { localStorage.setItem(k, name); } catch { /* ignore */ }
    return name;
  } catch { return null; }
}
