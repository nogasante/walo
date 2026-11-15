/* Build data/agro.json from NASA POWER daily files fetched by scripts/fetch_agro.py (/tmp/agro/<place>.json),
   using the same code the phone uses (lib/agro.js) and the rules in data/rules.json. Run: node scripts/build_agro.js

   Every place belongs to a country (places.json "country", defaulting to countries.json "default"), and each
   country brings its own rainy-season search windows, so the same method gives Ghana's single major season and
   the long and short rains. Places with no cached POWER file are left as they are: this merges into the
   existing data/agro.json instead of rebuilding it, so a country you did not fetch keeps its climate. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), A = require(path.join(ROOT, "lib/agro.js"));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "data/rules.json")));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, "data/places.json"))).places;
const app = JSON.parse(fs.readFileSync(path.join(ROOT, "data/app.json")));
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json")));
const OUT = path.join(ROOT, "data/agro.json");
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)) : { places: {} };
const years = app.periods.agro;
const cache = "/tmp/agro";
const out = {
  method: "See data/rules.json and DESIGN.md Methods. NASA POWER daily AG community, complete years " + years.join("-") + ". Each place uses its own country's season search windows from data/countries.json.",
  fetched: new Date().toISOString().slice(0, 10),
  places: { ...old.places },
};
const done = {};
for (const [id, p] of Object.entries(places)) {
  const file = path.join(cache, id + ".json");
  if (!fs.existsSync(file)) continue;
  const cc = p.country || countries.default, C = countries.countries[cc];
  if (!C) { console.log(id.padEnd(13), "no country entry for", cc); continue; }
  // the country decides where to search for each rainy season; the rule itself stays in rules.json
  const RR = { ...R, onset: { ...R.onset, major_search: C.onset.major_search, minor_search: C.onset.minor_search } };
  const j = JSON.parse(fs.readFileSync(file)), q = j.properties.parameter, [lon, lat, z] = j.geometry.coordinates;
  const D = {};
  for (const k of Object.keys(q.PRECTOTCORR)) D[k] = { P: q.PRECTOTCORR[k], tmax: q.T2M_MAX[k], tmin: q.T2M_MIN[k], t: q.T2M[k], rh: q.RH2M[k], ws: q.WS2M[k], rs: q.ALLSKY_SFC_SW_DWN[k] };
  const zone = p.zone, minor = zone != null && (C.onset.minor_search.zones || []).includes(zone);
  out.places[id] = { lat, lon, elev_m: Math.round(z), zone: zone || null, country: cc, ...A.summarize(D, lat, z, years, RR, minor) };
  (done[cc] = done[cc] || []).push(id);
}
fs.writeFileSync(OUT, JSON.stringify(out));
const doy = (d) => (d == null ? "-" : new Date(Date.UTC(2025, 0, 1 + d)).toISOString().slice(5, 10));
for (const cc of Object.keys(done)) {
  const C = countries.countries[cc];
  console.log(`${cc} ${C.name} (${done[cc].length} places)`);
  for (const id of done[cc]) {
    const x = out.places[id], o = x.onset, f = (q) => (q ? `${doy(q.p20)} / ${doy(q.median)} / ${doy(q.p80)} (${Math.round(q.found_share * 100)}%)` : "-");
    console.log(" ", id.padEnd(12), (x.zone || "-"), "ET0", Math.round(x.months.reduce((a, m) => a + m.et0_mm, 0)), "P", Math.round(x.months.reduce((a, m) => a + m.rain_mm, 0)), "LGP", x.months.filter((m) => m.lgp).map((m) => m.month).join(","), "| major", f(o.major), "| minor", f(o.minor));
  }
}
console.log("wrote", OUT, Object.keys(out.places).length, "places");
