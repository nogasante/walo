"""Fetch NASA POWER daily (AG community) 1991-2025 for every bundled place, for the FAO-56 / onset / heat / GDD methods.
Parameters: PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, RH2M, WS2M, ALLSKY_SFC_SW_DWN. Cached in /tmp/agro/<place>.json (not shipped)."""
import json, os, urllib.request, time
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda n: json.load(open(os.path.join(HERE, "data", n)))
pts = {k: (v["lat"], v["lon"]) for k, v in D("places.json")["places"].items()}
os.makedirs("/tmp/agro", exist_ok=True)
PARAMS = "PRECTOTCORR,T2M_MAX,T2M_MIN,T2M,RH2M,WS2M,ALLSKY_SFC_SW_DWN"
def get(item):
    pid, (lat, lon) = item; cache = f"/tmp/agro/{pid}.json"
    if os.path.exists(cache) and os.path.getsize(cache) > 100000: return pid, "cached"
    url = f"https://power.larc.nasa.gov/api/temporal/daily/point?parameters={PARAMS}&community=AG&longitude={lon:.4f}&latitude={lat:.4f}&start=19910101&end=20251231&format=JSON"
    for a in range(4):
        try:
            b = urllib.request.urlopen(url, timeout=300).read(); json.loads(b); open(cache, "wb").write(b); return pid, "ok"
        except Exception as e:
            time.sleep(5 + 5 * a); err = e
    return pid, f"FAIL {err}"
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(get, pts.items()): print(*r, flush=True)
