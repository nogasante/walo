"""Satellite greenness for every bundled place: NASA MODIS Terra MOD13Q1 v6.1 NDVI (250 m, 16-day), read through
Microsoft Planetary Computer (STAC collection modis-13Q1-061, data API statistics; free, no login).
For each place: median NDVI in a ~3 x 3 km box around the town point for each 16-day composite, 2016-2025 -> monthly
climatology (mean of the composite medians starting in that month) + the latest composite available. Writes data/ndvi.json."""
import json, os, urllib.request, time, statistics as st
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda n: json.load(open(os.path.join(HERE, "data", n)))
agro = D("agro.json")["places"]
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
STATS = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=modis-13Q1-061&item={}&assets=250m_16_days_NDVI"
HALF = 0.0135  # degrees, ~1.5 km
def post(url, body, tries=4):
    for a in range(tries):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}), timeout=60).read())
        except Exception as e: err = e; time.sleep(2 + 3 * a)
    raise err
def items(lat, lon):
    out, body = [], {"collections": ["modis-13Q1-061"], "intersects": {"type": "Point", "coordinates": [lon, lat]}, "datetime": "2016-01-01T00:00:00Z/2026-12-31T00:00:00Z", "limit": 500, "query": {"platform": {"eq": "terra"}}}
    j = post(STAC, body)
    while True:
        out += [(f["id"], f["properties"]["start_datetime"][:10]) for f in j["features"]]
        nxt = [l for l in j.get("links", []) if l.get("rel") == "next"]
        if not nxt: break
        j = post(nxt[0]["href"], nxt[0].get("body", {})) if nxt[0].get("method") == "POST" else json.loads(urllib.request.urlopen(nxt[0]["href"], timeout=60).read())
    return [x for x in out if x[0].startswith("MOD13Q1")]
def stat(arg):
    iid, lat, lon = arg
    poly = {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [[[lon - HALF, lat - HALF], [lon + HALF, lat - HALF], [lon + HALF, lat + HALF], [lon - HALF, lat + HALF], [lon - HALF, lat - HALF]]]}}
    try:
        s = post(STATS.format(iid), poly)["properties"]["statistics"]["250m_16_days_NDVI_b1"]
        return s["median"] / 10000 if s["count"] and s["median"] > -2000 else None
    except Exception: return None
out = {"source": "NASA MODIS Terra MOD13Q1 v6.1 NDVI, 250 m, 16-day composites (Didan 2021, doi:10.5067/MODIS/MOD13Q1.061), via Microsoft Planetary Computer STAC collection modis-13Q1-061", "url": "https://planetarycomputer.microsoft.com/dataset/modis-13Q1-061", "method": "Median NDVI in a ~3 x 3 km box around each town point; monthly values = mean of 2016-2025 composites that start in that month.", "fetched": time.strftime("%Y-%m-%d"), "places": {}}
for pid, p in agro.items():
    its = items(p["lat"], p["lon"])
    with ThreadPoolExecutor(12) as ex: vals = list(ex.map(stat, [(i, p["lat"], p["lon"]) for i, _ in its]))
    rows = [(d, v) for (_, d), v in zip(its, vals) if v is not None]
    mon = []
    for m in range(1, 13):
        xs = [v for d, v in rows if int(d[5:7]) == m and 2016 <= int(d[:4]) <= 2025]
        mon.append(round(st.mean(xs), 3) if xs else None)
    last = max(rows) if rows else None
    out["places"][pid] = {"months": mon, "latest": {"date": last[0], "ndvi": round(last[1], 3)} if last else None, "n": len(rows)}
    print(pid, len(its), len(rows), mon, out["places"][pid]["latest"], flush=True)
json.dump(out, open(os.path.join(HERE, "data", "ndvi.json"), "w"), separators=(",", ":"))
