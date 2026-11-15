#!/usr/bin/env python3
"""Build data/soilhealth.json: a soil-health screening for each town from data Walo can actually get.

Three inputs, all open and reproducible:

  slope      a 3x3 elevation sample around the town point (~1.2 km apart) from the Copernicus DEM through
             Open-Meteo's elevation API. NOT SRTM: SRTM needs an Earthdata login, and a wrong source name would be
             worse than a slightly different DEM. Steep ground erodes faster.
  cover      the peak month of NASA MODIS NDVI (MOD13Q1) already in data/ndvi.json: how much vegetation usually
             covers the ground, which is the cheapest proxy we have for soil organic matter and raindrop protection.
  rain       NASA POWER annual rain from data/agro.json: erosivity rises with rain amount.

The output is a screening band (low / medium / high), not RUSLE and not a soil test. Each town gets a plain note
saying what pushed its band, so the app can explain it and a farmer can disagree with it.

Usage: python3 scripts/build_soilhealth.py [--only ejura,accra]
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STEP = 0.011  # degrees, about 1.2 km at these latitudes
ELEV = "https://api.open-meteo.com/v1/elevation"


def elevation(lat, lon):
    lats = ",".join(f"{lat + dy * STEP:.5f}" for dy in (-1, 0, 1) for _ in (-1, 0, 1))
    lons = ",".join(f"{lon + dx * STEP:.5f}" for _ in (-1, 0, 1) for dx in (-1, 0, 1))
    q = urllib.parse.urlencode({"latitude": lats, "longitude": lons})
    req = urllib.request.Request(f"{ELEV}?{q}", headers={"User-Agent": "walo-soilhealth/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())["elevation"]
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 3:
                raise
            time.sleep(6 * (attempt + 1))
    return [None] * 9


def slope_pct(vals):
    """steepest drop or rise between the centre point and its 8 neighbours, in percent (m per 100 m)"""
    if len(vals) != 9 or any(v is None for v in vals):
        return None
    centre, out = vals[4], 0.0
    dist = STEP * 111_000 * 0.95  # metres per step, both axes at these latitudes
    for i, v in enumerate(vals):
        if i == 4:
            continue
        dx = abs(i % 3 - 1) * dist
        dy = abs(i // 3 - 1) * dist
        d = (dx * dx + dy * dy) ** 0.5
        out = max(out, abs(v - centre) / d * 100)
    return round(out, 1)


def band(value, cuts):
    lo, hi = cuts
    return "low" if value < lo else "medium" if value < hi else "high"


def main():
    only = None
    for i, a in enumerate(sys.argv):
        if a == "--only":
            only = set(sys.argv[i + 1].split(","))

    places = json.loads((ROOT / "data/places.json").read_text())["places"]
    ndvi = json.loads((ROOT / "data/ndvi.json").read_text())["places"]
    agro = json.loads((ROOT / "data/agro.json").read_text())["places"]
    out = {
        "source": "Slope from a 3x3 Copernicus DEM sample (via Open-Meteo); cover from NASA MODIS NDVI (MOD13Q1) in data/ndvi.json; rain from NASA POWER in data/agro.json.",
        "method": "Erosion screening = steepness x rain x (1 / vegetation cover). Organic matter is read from peak vegetation cover. Both are bands for comparing towns, not a soil test and not RUSLE; ask locally before spending money on it.",
        "places": {},
    }
    items = [(k, v) for k, v in places.items() if (only is None or k in only)]
    raw = {}
    for n, (pid, p) in enumerate(items, 1):
        try:
            sl = slope_pct(elevation(p["lat"], p["lon"]))
        except Exception as e:  # noqa: BLE001 - one town must not stop the rest
            print(f"[{n}/{len(items)}] {pid}: elevation failed {e}", flush=True)
            sl = None
        months = (ndvi.get(pid) or {}).get("months") or []
        am = (agro.get(pid) or {}).get("months") or []
        wet_months = sum(1 for m in am if m.get("lgp"))
        if months:
            peak, cover_src = round(max(months), 3), "MODIS NDVI (MOD13Q1)"
        elif am:
            peak, cover_src = round(0.15 + 0.025 * wet_months, 3), "rain-season length (NASA POWER)"
        else:
            peak, cover_src = None, None
        rain = round(sum(m.get("rain_mm") or 0 for m in am)) if am else None
        elev = (agro.get(pid) or {}).get("elev_m")
        raw[pid] = {**p, "slope_pct": sl, "ndvi_peak": peak, "cover_src": cover_src, "wet_months": wet_months, "rain_mm": rain, "elev_m": elev}
        print(f"[{n}/{len(items)}] {pid}: slope {sl}% cover {peak} rain {rain} mm", flush=True)
        time.sleep(1.1)

    # bands are relative to this country set, so they compare towns with each other
    slopes = [v["slope_pct"] for v in raw.values() if v["slope_pct"] is not None]
    covers = [v["ndvi_peak"] for v in raw.values() if v["ndvi_peak"] is not None]
    rains = [v["rain_mm"] for v in raw.values() if v["rain_mm"] is not None]

    def terciles(vals):
        vals = sorted(vals)
        if not vals:
            return (0, 0)
        return (vals[len(vals) // 3], vals[(2 * len(vals)) // 3])

    s_cut, c_cut, r_cut = terciles(slopes), terciles(covers), terciles(rains)
    for pid, v in raw.items():
        if v["slope_pct"] is None or v["ndvi_peak"] is None or v["rain_mm"] is None:
            continue
        steep = v["slope_pct"] / 10.0                     # 10% slope scores 1
        wet = v["rain_mm"] / 1000.0                       # 1000 mm scores 1
        bare = 1.0 / max(0.15, v["ndvi_peak"])            # low cover scores high
        score = round((steep * 0.5 + wet * 0.5) * bare, 2)
        erosion = "high" if score >= 3.2 else "medium" if score >= 1.8 else "low"
        om = "high" if v["ndvi_peak"] >= c_cut[1] else "medium" if v["ndvi_peak"] >= c_cut[0] else "low"
        steep_txt = (f"the ground is steep here (about {v['slope_pct']}% slope)" if v["slope_pct"] >= s_cut[1]
                     else f"the ground is fairly flat ({v['slope_pct']}% slope)")
        if v["cover_src"].startswith("MODIS"):
            cover_txt = (f"cover is thin (NDVI peaks at {v['ndvi_peak']})" if v["ndvi_peak"] < c_cut[0]
                         else f"cover is good (NDVI peaks at {v['ndvi_peak']})")
        else:
            cover_txt = (f"only about {v['wet_months']} wet months keep cover on the ground" if v["ndvi_peak"] < c_cut[0]
                         else f"a {v['wet_months']}-month wet season keeps cover on the ground")
        rain_txt = f", and rain is heavy ({v['rain_mm']} mm a year)" if v["rain_mm"] >= r_cut[1] else ""
        note = f"Erosion risk looks {erosion}: {steep_txt}, {cover_txt}{rain_txt}."
        out["places"][pid] = {
            "lat": v["lat"], "lon": v["lon"], "elev_m": v.get("elev_m"),
            "slope_pct": v["slope_pct"], "ndvi_peak": v["ndvi_peak"], "cover_src": v["cover_src"], "rain_mm": v["rain_mm"],
            "erosion": {"band": erosion, "score": score}, "om": {"band": om}, "wet_months": v["wet_months"], "note": note,
        }
    dest = ROOT / "data/soilhealth.json"
    if dest.exists() and only:
        try:
            old = json.loads(dest.read_text())
            out["places"] = {**old.get("places", {}), **out["places"]}
        except Exception:  # noqa: BLE001
            pass
    dest.write_text(json.dumps(out, indent=1) + "\n")
    print("wrote data/soilhealth.json for", len(out["places"]), "places")


if __name__ == "__main__":
    main()
