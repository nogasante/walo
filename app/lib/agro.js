/* Walɔ agro methods, shared by the phone (window.AGRO) and the data build (node scripts/build_agro.js).
   Every constant comes from data/rules.json (passed in as R) or from the crop record; see DESIGN.md "Methods". */
(function (root) {
  "use strict";
  const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MSTART = MDAYS.reduce((a, d, i) => (a.push(i ? a[i - 1] + MDAYS[i - 1] : 0), a), []); // day-of-year (0-based) each month starts
  const monthOfDoy = (d) => { d = ((d % 365) + 365) % 365; let m = 11; while (MSTART[m] > d) m--; return m; }; // 0-based month
  const doyOf = (mmdd) => { const [m, d] = mmdd.split("-").map(Number); return MSTART[m - 1] + d - 1; };
  const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * p / 100, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

  /* FAO-56 extraterrestrial radiation Ra (MJ m-2 d-1), Eq. 21-25 */
  function ra(latDeg, J) {
    const phi = latDeg * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * J / 365), dl = 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39);
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dl))));
    return 24 * 60 / Math.PI * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dl) + Math.cos(phi) * Math.cos(dl) * Math.sin(ws));
  }
  const esat = (t) => 0.6108 * Math.exp(17.27 * t / (t + 237.3)); // Eq. 11
  /* FAO-56 Penman-Monteith reference ET0 (mm/day), Eq. 6, daily step, G = 0. */
  function et0PM(x, R) {
    const { tmax, tmin, rh, u2, rs, lat, J, z } = x, T = (tmax + tmin) / 2;
    const P = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26), g = 0.000665 * P; // Eq. 7, 8
    const es = (esat(tmax) + esat(tmin)) / 2, ea = rh / 100 * es; // Eq. 12, 19 (RH mean)
    const D = 4098 * esat(T) / Math.pow(T + 237.3, 2); // Eq. 13
    const Ra = ra(lat, J), Rso = (0.75 + 2e-5 * z) * Ra; // Eq. 37
    const Rns = (1 - R.et0.albedo) * rs; // Eq. 38
    const Rnl = 4.903e-9 * (Math.pow(tmax + 273.16, 4) + Math.pow(tmin + 273.16, 4)) / 2 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Math.min(1, rs / Rso) - 0.35); // Eq. 39
    const Rn = Rns - Rnl;
    return Math.max(0, (0.408 * D * Rn + g * 900 / (T + 273) * u2 * (es - ea)) / (D + g * (1 + 0.34 * u2)));
  }
  /* FAO-56 Hargreaves (Eq. 52), used only when radiation, humidity or wind are missing. */
  const et0HG = (tmax, tmin, lat, J) => Math.max(0, 0.0023 * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 0.408 * ra(lat, J));
  /* USDA-SCS effective rain for a monthly total (CROPWAT). */
  const peff = (P) => (P <= 250 ? P * (125 - 0.2 * P) / 125 : 125 + 0.1 * P);

  /* Onset (Sivakumar 1988 rule, Stern et al. 1982 percentiles): first day d in [from, to] where rain over rain_days days from d >= rain_mm
     (day d itself wet) and no run of more than dry_spell_max_days dry days (< wet_day_mm) in the next check_days days. */
  function onsetYear(p, from, to, O) {
    for (let d = from; d <= to; d++) {
      if (!(p[d] >= O.wet_day_mm)) continue;
      let s = 0; for (let k = 0; k < O.rain_days; k++) s += p[d + k] || 0;
      if (s < O.rain_mm) continue;
      let run = 0, ok = true;
      for (let k = 1; k <= O.check_days; k++) { const v = p[d + k]; if (v == null) { ok = false; break; } run = v < O.wet_day_mm ? run + 1 : 0; if (run > O.dry_spell_max_days) { ok = false; break; } }
      if (ok) return d;
    }
    return null;
  }

  /* Summarise daily POWER records into the place climatology Walɔ needs.
     D: { "YYYYMMDD": {P, tmax, tmin, t, rh, ws, rs} }, years: [y0, y1], minor: bool (bimodal zone). */
  function summarize(D, lat, z, years, R, minor) {
    const ok = (v) => v != null && v > -900, HOT = R.heat.count_thresholds_c;
    const acc = Array.from({ length: 12 }, () => ({ P: [], E: [], tx: [], tn: [], t: [], hot: {} }));
    const onset = { major: [], minor: [] }, nyears = [];
    let pmDays = 0, hgDays = 0;
    for (let y = years[0]; y <= years[1]; y++) {
      const p = new Array(365 + 40).fill(null), mm = Array.from({ length: 12 }, () => ({ P: 0, E: 0, tx: [], tn: [], t: [], n: 0, hot: {} }));
      let full = true;
      for (let J = 0; J < 365; J++) {
        const dt = new Date(Date.UTC(y, 0, 1 + J)), key = dt.toISOString().slice(0, 10).replace(/-/g, ""), r = D[key], m = monthOfDoy(J);
        if (!r || !ok(r.P) || !ok(r.tmax) || !ok(r.tmin)) { full = false; continue; }
        p[J] = r.P;
        let e;
        if (ok(r.rh) && ok(r.ws) && ok(r.rs)) { e = et0PM({ tmax: r.tmax, tmin: r.tmin, rh: r.rh, u2: r.ws, rs: r.rs, lat, J: J + 1, z }, R); pmDays++; } else { e = et0HG(r.tmax, r.tmin, lat, J + 1); hgDays++; }
        const q = mm[m]; q.P += r.P; q.E += e; q.tx.push(r.tmax); q.tn.push(r.tmin); q.t.push(ok(r.t) ? r.t : (r.tmax + r.tmin) / 2); q.n++;
        for (const h of HOT) if (r.tmax > h) q.hot[h] = (q.hot[h] || 0) + 1;
      }
      // the 40 days after 31 Dec are needed only for late-season checks; minor search ends 31 Oct, so the year is enough
      if (!full) continue;
      nyears.push(y);
      mm.forEach((q, i) => { const a = acc[i], mean = (v) => v.reduce((s, x) => s + x, 0) / v.length; a.P.push(q.P); a.E.push(q.E); a.tx.push(mean(q.tx)); a.tn.push(mean(q.tn)); a.t.push(mean(q.t)); for (const h of HOT) (a.hot[h] = a.hot[h] || []).push(q.hot[h] || 0); });
      const O = R.onset;
      onset.major.push(onsetYear(p, doyOf(O.major_search.from), doyOf(O.major_search.to), O));
      if (minor) onset.minor.push(onsetYear(p, doyOf(O.minor_search.from), doyOf(O.minor_search.to), O));
    }
    const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null), r1 = (x, n = 1) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);
    const months = acc.map((a, i) => {
      const P = mean(a.P), E = mean(a.E);
      return { month: i + 1, rain_mm: r1(P), et0_mm: r1(E), peff_mm: r1(peff(P)), tmax_c: r1(mean(a.tx)), tmin_c: r1(mean(a.tn)), tmean_c: r1(mean(a.t)), hot: Object.fromEntries(HOT.map((h) => [h, r1(mean(a.hot[h] || []))])), lgp: P >= R.growing_period.rain_over_et0_min * E };
    });
    const stat = (arr) => {
      if (!arr.length) return null;
      const f = arr.filter((d) => d != null);
      return { n_years: arr.length, found_share: r1(f.length / arr.length, 2), p20: f.length ? Math.round(pct(f, 20)) : null, median: f.length ? Math.round(pct(f, 50)) : null, p80: f.length ? Math.round(pct(f, 80)) : null };
    };
    return { years: nyears.length ? [nyears[0], nyears[nyears.length - 1]] : null, n_years: nyears.length, et0_method: hgDays > pmDays ? "Hargreaves" : "Penman-Monteith", months, onset: { major: stat(onset.major), minor: minor ? stat(onset.minor) : null } };
  }

  /* ----- crop helpers ----- */
  const seasonDays = (c) => { const f = c.fao56; if (!f || !f.stage_days) return null; return c.days_typical || f.stage_days.reduce((s, x) => s + x, 0); };
  function stages(c) { // FAO-56 stage lengths scaled to the local season length, keeping FAO's proportions
    const f = c.fao56, L = f.stage_days, T = L.reduce((s, x) => s + x, 0), S = seasonDays(c);
    const out = L.map((x) => Math.round(x * S / T)); out[3] += S - out.reduce((s, x) => s + x, 0); return out;
  }
  function kcDay(c, d, L) { // FAO-56 Fig. 25 / Eq. 66
    const f = c.fao56, [a, b, m, e] = L;
    if (d < a) return f.kc_ini;
    if (d < a + b) return f.kc_ini + (d - a) / b * (f.kc_mid - f.kc_ini);
    if (d < a + b + m) return f.kc_mid;
    return f.kc_mid + (d - a - b - m) / e * (f.kc_end - f.kc_mid);
  }
  const heatLine = (c, R) => { const h = R.heat.crops[c.id]; return h ? { t: h.tmax_c, src: h.source, cited: true } : c.eco && c.eco.temp_c ? { t: c.eco.temp_c.opt_max, src: "ECOCROP", cited: false } : null; };
  const gddBase = (c, R) => { const g = R.gdd.crops[c.id]; return g ? { tb: g.tbase_c, tu: g.tupper_c, src: g.source, cited: true } : c.eco && c.eco.temp_c ? { tb: c.eco.temp_c.abs_min, tu: null, src: "ECOCROP", cited: false } : null; };
  const clamp = (v, lo, hi) => Math.max(lo, hi != null ? Math.min(v, hi) : v);
  const gddDay = (tmax, tmin, g) => (clamp(tmax, g.tb, g.tu) + clamp(tmin, g.tb, g.tu)) / 2 - g.tb; // McMaster & Wilhelm (1997) method 2

  /* FAO-56 water balance + WRSI for a crop sown on day-of-year `sow` (0-based), using monthly climatology spread evenly over days. */
  function seasonFit(c, months, sow, R) {
    if (!c.fao56 || !c.fao56.stage_days) return null;
    const L = stages(c), S = L.reduce((s, x) => s + x, 0), cap = R.water.soil_store_mm, hl = heatLine(c, R), g = gddBase(c, R);
    let store = 0, need = 0, aet = 0, rain = 0, pe = 0, hot = 0, gdd = 0;
    const gddStage = [0, 0, 0, 0], mid0 = L[0] + L[1], mid1 = mid0 + L[2];
    for (let d = 0; d < S; d++) {
      const m = months[monthOfDoy(sow + d)], n = MDAYS[m.month - 1];
      const etc = kcDay(c, d, L) * m.et0_mm / n, p = m.rain_mm / n, e = m.peff_mm / n;
      store = Math.min(cap, store + e); const a = Math.min(etc, store); store -= a;
      need += etc; aet += a; rain += p; pe += e;
      if (hl && d >= mid0 && d < mid1) hot += (nearestHot(m.hot, hl.t) || 0) / n;
      if (g) { const gd = gddDay(m.tmax_c, m.tmin_c, g); gdd += gd; gddStage[d < L[0] ? 0 : d < mid0 ? 1 : d < mid1 ? 2 : 3] += gd; }
    }
    const wrsi = need ? Math.round(100 * aet / need) : null, wc = R.water.wrsi_classes.find((k) => wrsi >= k.min);
    return { sow, days: S, stages: L, need_mm: Math.round(need), rain_mm: Math.round(rain), peff_mm: Math.round(pe), deficit_mm: Math.round(need - aet), wrsi, water_class: wc, water_dots: R.water.wrsi_dots.find((k) => wrsi >= k.min).dots,
      flower_from: sow + mid0, flower_to: sow + mid1, hot_days: hl ? Math.round(hot) : null, heat: hl, gdd: g ? Math.round(gdd) : null, gdd_stages: g ? gddStage.map(Math.round) : null, gdd_base: g };
  }
  function nearestHot(hot, t) { // hot-day counts are stored for whole-degree thresholds
    if (!hot) return null; const ks = Object.keys(hot).map(Number); if (!ks.length) return null;
    const k = ks.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a)); return hot[k];
  }

  /* EcoCrop suitability (Ramirez-Villegas et al. 2013): temperature = lowest monthly score over the growing season (best of 12 start months);
     rain = the place's annual rain against the EcoCrop ranges, which FAO's database gives as annual rainfall (DESIGN.md notes this choice);
     overall = temperature x rain. */
  function lin(v, a, b, c2, d) { if (v == null || a == null) return null; if (v <= a || (d != null && v >= d)) return 0; if (v < b) return (v - a) / (b - a); if (c2 == null || v <= c2 || d == null) return 1; return (d - v) / (d - c2); }
  /* EcoCrop climate class. `season` (optional) is a sourced planting window: {start (0-based month), len, rain_mm}.
     With it, the rain judged is the rain that falls in the months the crop is actually in the ground, and the
     temperature is the worst of those months - not a whole calendar year, which penalises a long single season
     and flatters a place whose rain arrives outside the crop's window. */
  function ecocrop(c, months, season) {
    const e = c.eco; if (!e || !e.temp_c || !e.rain_mm_annual) return null;
    const t = e.temp_c, r = c.rain_gh || e.rain_mm_annual, cy = e.cycle_days || {};
    const n = Math.max(1, Math.min(12, Math.round(((cy.min || 365) + (cy.max || cy.min || 365)) / 2 / 30)));
    const rain = season && season.rain_mm != null ? season.rain_mm : months.reduce((s, m) => s + m.rain_mm, 0);
    const rs = lin(rain, r.abs_min, r.opt_min, r.opt_max, r.abs_max);
    const starts = season ? [Math.max(0, Math.min(11, season.start))] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const span = season ? Math.max(1, Math.min(12, season.len)) : n;
    let best = null;
    for (const s of starts) {
      let ts = 1, lo = null;
      for (let k = 0; k < span; k++) { const m = months[(s + k) % 12], v = lin(m.tmean_c, t.abs_min, t.opt_min, t.opt_max, t.abs_max); if (v < ts) { ts = v; lo = m.month; } }
      if (!best || ts > best.temp) best = { temp: Math.round(ts * 100) / 100, start: s + 1, months: span, worst_month: lo };
    }
    return { ...best, suit: Math.round(best.temp * rs * 100) / 100, rain_s: Math.round(rs * 100) / 100, rain_mm: Math.round(rain), rain_rng: r, temp_rng: t, season: !!season };
  }
  const classOf = (v, R) => R.suitability.classes.find((k) => v >= k.min);

  const api = { MDAYS, MSTART, monthOfDoy, doyOf, ra, et0PM, et0HG, peff, onsetYear, summarize, stages, seasonDays, kcDay, seasonFit, ecocrop, classOf, heatLine, gddBase, gddDay, pct };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AGRO = api;
})(typeof self !== "undefined" ? self : this);
