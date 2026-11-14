"""Write the app's data files from the full build outputs, keeping only what the app reads.
Inputs (not shipped): scripts/data/crops_full.json (build_crops.py -> fix_crops_v7/v8 -> add_fao56.py),
scripts/data/market_full.json (build_markets.py), scripts/data/{climate,locations,places_monthly}.json (place coordinates).
Outputs: data/crops.json, data/market.json, data/places.json. Run after any build script."""
import json, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda n: json.load(open(os.path.join(HERE, "scripts", "data", n)))
W = lambda n, o: json.dump(o, open(os.path.join(HERE, "data", n), "w"), ensure_ascii=False, separators=(",", ":"))

crops = S("crops_full.json")
KEEP = ["id", "name", "twi", "kind", "img", "pos", "confidence", "confidence_zone", "zones", "windows", "days_typical",
        "eco", "fao56", "rain_gh", "dry_harvest", "heat_sensitive_stage", "root_crop", "stages", "price_note"]
W("crops.json", {"zones": crops["zones"], "sources": {k: {"title": v["title"], "url": v.get("url")} for k, v in crops["sources"].items()},
                 "crops": [{k: c[k] for k in KEEP if k in c} for c in crops["crops"]]})

mk = S("market_full.json")
out = {}
for cid, c in mk["crops"].items():
    series = [{"market": s["market"], "crop_label": s["crop_label"], "unit": s["unit"], "index": [round(x["index"], 3) if x else None for x in s["index"]],
               "index_years": s["index_years"], "peak_month": s["peak_month"], "dip_month": s["dip_month"], "first": s["first"], "last": s["last"],
               "recent_avg": s["recent_avg"], "thin": s["thin"], "n_excluded": len(s.get("excluded", []))} for s in c["series"] if s.get("main")]
    out[cid] = {"compare": c.get("compare"), "series": series, "srid2025": c.get("srid2025", [])}
W("market.json", {"source": mk["source"], "index_years": mk["index_years"], "srid_source": mk["srid_source"], "notes": mk["notes"], "markets": mk["markets"], "crops": out})

clim, locs, pl = S("climate.json"), S("locations.json"), S("places_monthly.json")
zone = crops["location_zone"]
places = {"ejura": {"name": "Ejura", "region": "Ashanti Region", "lat": clim["place"]["lat"], "lon": clim["place"]["lon"], "zone": zone["ejura"], "coords_url": None}}
for k, v in locs.items():
    places[k] = {"name": v["name"], "region": v["region"], "lat": v["lat"], "lon": v["lon"], "zone": zone.get(k), "coords_url": None}
for k, v in pl["places"].items():
    places[k] = {"name": v["name"], "region": v["region"], "lat": v["lat"], "lon": v["lon"], "zone": v.get("zone"), "coords_url": v.get("coords_url")}
W("places.json", {"source": "Town points: Ejura, Techiman, Tamale from the team's NASA POWER requests; other regional capitals from Wikipedia / Wikidata (P625).",
                  "places": places})
print("ok", len(crops["crops"]), "crops,", sum(len(c["series"]) for c in out.values()), "market series,", len(places), "places")
