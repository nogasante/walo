#!/usr/bin/env python3
"""Build data/shift.json: how the farming season at each town has moved between two periods.

The Field Shift brief asks for adaptation to *changing* conditions, not just current suitability, so Walo compares
the same NASA POWER daily record over two periods at the exact point it gives advice for:

    early   1991-2014
    recent  2015-2025

For each town and each period it stores three numbers, all from PRECTOTCORR and T2M_MAX (NASA POWER, AG community,
same point as data/agro.json):

  onset_doy    median day of year of the onset of the major rains (the rule in DESIGN.md section 14.4)
  season_rain  mean rain in mm over the country's major-season search window (data/countries.json)
  hot_days     mean days with T2M_MAX above 35 degC in that same window

All three are "usual" figures for their period. Nothing here is a forecast.

Usage:  python3 scripts/build_shift.py [--only ejura,accra] [--limit 5]
"""
import json
import statistics
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = "PRECTOTCORR,T2M_MAX"
EARLY = (1991, 2014)
RECENT = (2015, 2025)
HOT_C = 35.0
FILL = -999.0


def fetch(lat, lon, y0, y1):
    q = urllib.parse.urlencode({
        "parameters": PARAMS, "community": "AG", "longitude": f"{lon:.5f}", "latitude": f"{lat:.5f}",
        "start": f"{y0}0101", "end": f"{y1}1231", "format": "JSON",
    })
    req = urllib.request.Request(f"{POWER}?{q}", headers={"User-Agent": "walo-field-shift/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())["properties"]["parameter"]


def onset(rain, day, window_from, window_to):
    """First sowing rain in the window: >=1 mm on the day, >=20 mm over three days, and no run of more than
    7 dry days (<1 mm) in the following 30. Same rule as lib/agro.js."""
    d = window_from
    while d <= window_to:
        key = d.strftime("%Y%m%d")
        p = rain.get(key, FILL)
        if p is None or p <= FILL + 1:
            d += timedelta(days=1)
            continue
        three = sum((rain.get((d + timedelta(days=i)).strftime("%Y%m%d"), 0) or 0) for i in range(3))
        if p >= 1 and three >= 20:
            dry, run, ok = 0, 0, True
            for i in range(1, 31):
                v = rain.get((d + timedelta(days=i)).strftime("%Y%m%d"), 0) or 0
                run = run + 1 if v < 1 else 0
                dry = max(dry, run)
            if dry <= 7:
                return d.timetuple().tm_yday
        d += timedelta(days=1)
    return None


def window(year, mm_from, mm_to):
    f = date(year, int(mm_from[:2]), int(mm_from[3:]))
    t = date(year, int(mm_to[:2]), int(mm_to[3:]))
    return f, t


def summarise(rain, tmax, y0, y1, w_from, w_to):
    onsets, rains, hots = [], {k: [] for k in (EARLY, RECENT)}, {k: [] for k in (EARLY, RECENT)}
    for y in range(y0, y1 + 1):
        f, t = window(y, w_from, w_to)
        o = onset(rain, y, f, t)
        if o:
            onsets.append((y, o))
        total, hot = 0.0, 0
        d = f
        while d <= t:
            k = d.strftime("%Y%m%d")
            r, tm = rain.get(k, FILL), tmax.get(k, FILL)
            if r is not None and r > FILL + 1:
                total += r
            if tm is not None and tm > FILL + 1 and tm > HOT_C:
                hot += 1
            d += timedelta(days=1)
        rains[EARLY if y <= EARLY[1] else RECENT].append(total)
        hots[EARLY if y <= EARLY[1] else RECENT].append(hot)
    def med(v):
        return round(statistics.median(v), 0) if v else None
    def mean(v):
        return round(sum(v) / len(v), 0) if v else None
    return {
        "early": {"onset_doy": med([o for y, o in onsets if y <= EARLY[1]]), "season_rain": mean(rains[EARLY]), "hot_days": mean(hots[EARLY])},
        "recent": {"onset_doy": med([o for y, o in onsets if y > EARLY[1]]), "season_rain": mean(rains[RECENT]), "hot_days": mean(hots[RECENT])},
        "years": {"early": sum(rains[EARLY]) and len(rains[EARLY]), "recent": len(rains[RECENT])},
    }


def main():
    only = None
    limit = None
    for i, a in enumerate(sys.argv):
        if a == "--only":
            only = set(sys.argv[i + 1].split(","))
        if a == "--limit":
            limit = int(sys.argv[i + 1])
    places = json.loads((ROOT / "data/places.json").read_text())["places"]
    countries = json.loads((ROOT / "data/countries.json").read_text())["countries"]
    out = {"method": "NASA POWER daily PRECTOTCORR and T2M_MAX, AG community, compared over 1991-2014 and 2015-2025 at each town point. Onset uses the same rule as the rest of Walo; see DESIGN.md method 4. Figures are usual values for each period, not a forecast.",
           "hot_threshold_c": HOT_C, "periods": {"early": list(EARLY), "recent": list(RECENT)}, "places": {}}
    items = [(k, v) for k, v in places.items() if (only is None or k in only)]
    if limit:
        items = items[:limit]
    for n, (pid, p) in enumerate(items, 1):
        c = countries.get(p.get("country") or "GH") or {}
        onset_conf = (c.get("onset") or {}).get("major_search") or {}
        w_from, w_to = onset_conf.get("from", "03-01"), onset_conf.get("to", "07-31")
        try:
            par = fetch(p["lat"], p["lon"], EARLY[0], RECENT[1])
            s = summarise(par.get("PRECTOTCORR", {}), par.get("T2M_MAX", {}), EARLY[0], RECENT[1], w_from, w_to)
            s["window"] = [w_from, w_to]
            out["places"][pid] = s
            print(f"[{n}/{len(items)}] {pid}: {s['early']} -> {s['recent']}", flush=True)
        except Exception as e:  # noqa: BLE001 - one town failing must not lose the rest
            print(f"[{n}/{len(items)}] {pid}: FAILED {e}", flush=True)
        time.sleep(0.35)
    (ROOT / "data/shift.json").write_text(json.dumps(out, indent=1) + "\n")
    print("wrote data/shift.json for", len(out["places"]), "places")


if __name__ == "__main__":
    main()
