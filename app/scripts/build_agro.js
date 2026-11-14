/* Build data/agro.json from NASA POWER daily files fetched by scripts/fetch_agro.py (/tmp/agro/<place>.json),
   using the same code the phone uses (lib/agro.js) and the rules in data/rules.json. Run: node scripts/build_agro.js */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), A = require(path.join(ROOT, "lib/agro.js"));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "data/rules.json")));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"))).places;
const app = JSON.parse(fs.readFileSync(path.join(ROOT, "data/app.json")));
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json")));
const C = countries.countries[countries.default];
// the country decides where to search for each rainy season; the rule itself stays in rules.json
const RR = { ...R, onset: { ...R.onset, major_search: C.onset.major_search, minor_search: C.onset.minor_search } };
const years = app.periods.agro;
const out = { method: "See data/rules.json and DESIGN.md Methods. NASA POWER daily AG community, complete years " + years.join("–") + ".", fetched: app.periods.agro_fetched, places: {} };
for (const f of fs.readdirSync("/tmp/agro").filter((x) => x.endsWith(".json")).sort()) {
  const id = f.replace(".json", ""), j = JSON.parse(fs.readFileSync("/tmp/agro/" + f)), p = j.properties.parameter, [lon, lat, z] = j.geometry.coordinates;
  const D = {};
  for (const k of Object.keys(p.PRECTOTCORR)) D[k] = { P: p.PRECTOTCORR[k], tmax: p.T2M_MAX[k], tmin: p.T2M_MIN[k], t: p.T2M[k], rh: p.RH2M[k], ws: p.WS2M[k], rs: p.ALLSKY_SFC_SW_DWN[k] };
  const zone = places[id].zone, minor = zone != null && (C.onset.minor_search.zones || []).includes(zone);
  const s = A.summarize(D, lat, z, years, RR, minor);
  out.places[id] = { lat, lon, elev_m: Math.round(z), zone: zone || null, ...s };
}
fs.writeFileSync(path.join(ROOT, "data/agro.json"), JSON.stringify(out));
const doy = (d) => (d == null ? "–" : new Date(Date.UTC(2025, 0, 1 + d)).toISOString().slice(5, 10));
for (const [id, x] of Object.entries(out.places)) {
  const o = x.onset, f = (q) => (q ? `${doy(q.p20)} / ${doy(q.median)} / ${doy(q.p80)} (${Math.round(q.found_share * 100)}%)` : "–");
  console.log(id.padEnd(13), (x.zone || "-"), "ET0", Math.round(x.months.reduce((a, m) => a + m.et0_mm, 0)), "P", Math.round(x.months.reduce((a, m) => a + m.rain_mm, 0)), "LGP", x.months.filter((m) => m.lgp).map((m) => m.month).join(","), "| major", f(o.major), "| minor", f(o.minor));
}
