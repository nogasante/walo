#!/usr/bin/env python3
"""
Walo proof script — NASA Space Apps 2026, team Simply Zero (Field Shift).

This file asks NASA POWER, live, for the weather at one place, then uses the
same planting rules as the Walo app (https://walo-simply-zero.vercel.app).

You only need Python 3. No packages to install.

    python3 walo_proof.py
    python3 walo_proof.py --place Tamale
    python3 walo_proof.py --place Techiman --crop rice
    python3 walo_proof.py --lat 7.3856 --lon -1.3562 --name Ejura

Read HOW_TO_USE.md for a short walkthrough.
"""

import argparse
import json
import math
import os
import sys
import datetime
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# =============================================================================
# SETTINGS  — this is the only block you need to edit
# =============================================================================
# How to change the place:
#   A) Set PLACE_NAME to a name in PLACES below, then run:
#         python3 walo_proof.py
#   B) Leave this file alone and pass a flag:
#         python3 walo_proof.py --place Tamale
#   C) Use any point on Earth (your field, a new town):
#         python3 walo_proof.py --lat 9.4008 --lon -0.8393 --name Tamale
#
# How to change the crop:
#   Set CROP below, or pass --crop rice
#   Names Walo knows: maize, rice, cassava, cowpea, groundnut, sorghum,
#   millet, soybean, yam, plantain, cocoyam, tomato, pepper, onion, okra,
#   garden_egg, sweet_potato, cocoa, cashew
#
# YEARS is the usual-climate window (the same years the Walo app uses).
# THEN_YEARS vs NOW_YEARS is the "ten years ago vs recently" comparison.
# =============================================================================

PLACE_NAME = "Ejura"
LAT = 7.38558          # used only if PLACE_NAME is not in PLACES, or with --lat
LON = -1.35617
CROP = "maize"
YEARS = (1991, 2025)
THEN_YEARS = (2006, 2015)   # "ten years ago"
NOW_YEARS = (2016, 2025)    # "recent years"

# Ready-made towns from Walo's data/places.json (the app's official points).
# Ejura-Sekyedumase is the district name; it uses the same point as Ejura.
PLACES = {
    "Ejura":             {"lat": 7.38558, "lon": -1.35617, "id": "ejura",    "region": "Ashanti Region"},
    "Ejura-Sekyedumase": {"lat": 7.38558, "lon": -1.35617, "id": "ejura",    "region": "Ashanti Region"},
    "Tamale":            {"lat": 9.40079, "lon": -0.8393,  "id": "tamale",   "region": "Northern Region"},
    "Techiman":          {"lat": 7.59054, "lon": -1.93947, "id": "techiman", "region": "Bono East Region"},
    "Kumasi":            {"lat": 6.7,     "lon": -1.625,   "id": "kumasi",   "region": "Ashanti Region"},
    "Accra":             {"lat": 5.55,    "lon": -0.2,     "id": "accra",    "region": "Greater Accra Region"},
}

# =============================================================================
# You do not need to edit anything below this line to run a demo.
# =============================================================================

NASA = "https://power.larc.nasa.gov/api/temporal"
PARAMS = "PRECTOTCORR,T2M,T2M_MAX,T2M_MIN"
COMMUNITY = "AG"          # agriculture community — same as the Walo app
USER_AGENT = "WaloProof/1.0 (NASA Space Apps 2026, team Simply Zero)"
TIMEOUT_SEC = 30
RECENT_DAYS = 45          # how many recent daily values to fetch
MONTHS = ("January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December")
MONTHS_SHORT = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
# Length of each month in a non-leap year. Used to turn NASA's mm/day into mm/month.
MDAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
# Day-of-year (0-based) each month starts, matching lib/agro.js in the app.
MSTART = (0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)
FILL = -900               # NASA fill / missing values are -999
ZONE_NAMES = {
    "F": "Rain forest zone",
    "T": "Transitional zone",
    "G": "Guinea savanna zone",
    "C": "Coastal savanna zone",
}


# ---------- small helpers ----------

def js_round(x):
    """Match JavaScript Math.round (halves go toward +infinity)."""
    return int(math.floor(x + 0.5)) if x >= 0 else int(math.ceil(x - 0.5))


def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def days_in_month(year, month):
    if month == 2 and is_leap(year):
        return 29
    return MDAYS[month - 1]


def month_of_doy(doy):
    """0-based day-of-year -> 0-based month. Same as AGRO.monthOfDoy in the app."""
    d = ((int(doy) % 365) + 365) % 365
    m = 11
    while MSTART[m] > d:
        m -= 1
    return m


def doy_to_text(doy):
    """0-based day-of-year -> '2 April'."""
    m = month_of_doy(doy)
    day = int(doy) - MSTART[m] + 1
    return "%d %s" % (day, MONTHS[m])


def ok_num(v):
    return v is not None and v > FILL


def fmt_lon(lon):
    return "%.4f° %s" % (abs(lon), "E" if lon >= 0 else "W")


def fmt_lat(lat):
    return "%.4f° %s" % (abs(lat), "N" if lat >= 0 else "S")


def bar(value, max_value, width=16):
    if max_value <= 0 or value <= 0:
        return ""
    n = int(round((value / max_value) * width))
    return "#" * max(n, 1) if value > 0 else ""


def comma(n):
    """1,242 — whole millimetres, easy to read out loud."""
    return "{:,.0f}".format(round(n))


# ---------- find Walo's data files (optional, but used when present) ----------

def find_data_dir():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "data"),
        os.path.join(here, "..", "app", "data"),
        os.path.join(here, "..", "walo-app", "data"),
        "/workspace/walo-app/data",
        os.path.join(here, "..", "data"),
    ]
    for path in candidates:
        path = os.path.normpath(path)
        if os.path.isfile(os.path.join(path, "crops.json")):
            return path
    return None


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_walo_data():
    """Load crops, rules, places, agro, app settings if the Walo data folder is nearby."""
    folder = find_data_dir()
    data = {"dir": folder}
    if not folder:
        return data
    for name in ("crops", "rules", "places", "agro", "app"):
        path = os.path.join(folder, name + ".json")
        if os.path.isfile(path):
            data[name] = load_json(path)
    return data


# ---------- NASA POWER ----------

def power_url(kind, lat, lon, start=None, end=None):
    """Build the exact NASA POWER URL (printed so judges can open it)."""
    lat_s, lon_s = "%.4f" % lat, "%.4f" % lon
    if kind == "climatology":
        return (NASA + "/climatology/point?parameters=%s&community=%s"
                "&longitude=%s&latitude=%s&format=JSON" % (PARAMS, COMMUNITY, lon_s, lat_s))
    if kind == "monthly":
        return (NASA + "/monthly/point?parameters=%s&community=%s"
                "&longitude=%s&latitude=%s&start=%s&end=%s&format=JSON"
                % (PARAMS, COMMUNITY, lon_s, lat_s, start, end))
    if kind == "daily":
        return (NASA + "/daily/point?parameters=%s&community=%s"
                "&longitude=%s&latitude=%s&start=%s&end=%s&format=JSON"
                % (PARAMS, COMMUNITY, lon_s, lat_s, start, end))
    raise ValueError("unknown kind: " + kind)


def fetch_json(url):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=TIMEOUT_SEC) as resp:
        return json.loads(resp.read().decode("utf-8"))


def friendly_network_error(exc):
    if isinstance(exc, HTTPError):
        return ("NASA POWER returned an error (HTTP %s). Try again in a minute.\n"
                "  The exact error was: %s" % (exc.code, exc.reason or exc))
    if isinstance(exc, URLError):
        reason = exc.reason
        reason_s = str(reason)
        if "timed out" in reason_s.lower() or isinstance(reason, TimeoutError):
            return ("The request to NASA POWER timed out. Check the internet and try again.\n"
                    "  The exact error was: %s" % reason_s)
        return ("Could not reach NASA POWER. Check the internet and try again.\n"
                "  The exact error was: %s" % reason_s)
    if isinstance(exc, (TimeoutError, OSError)):
        return ("Could not reach NASA POWER. Check the internet and try again.\n"
                "  The exact error was: %s" % exc)
    return ("Something went wrong while talking to NASA POWER.\n"
            "  The exact error was: %s" % exc)


def parameter_block(payload):
    props = payload.get("properties") or {}
    return props.get("parameter") or {}


def parse_monthly(payload):
    """Turn POWER monthly records into per-year, per-month rain (mm) and temperatures.

    PRECTOTCORR is mm/day, so monthly rain = rate × days in that month.
    T2M is the mean temperature. T2M_MAX / T2M_MIN on the monthly API are
    the hottest and coldest days of the month (not the mean daily max/min
    the app stores). We only use T2M from this endpoint for 'usual' and
    'then vs now' temperature.
    """
    block = parameter_block(payload)
    rain, tmean, tmax_x, tmin_x = {}, {}, {}, {}
    years = set()
    for key, rate in (block.get("PRECTOTCORR") or {}).items():
        if len(key) != 6 or key.endswith("13"):
            continue  # YYYY13 is the annual slot, not a month
        year, month = int(key[:4]), int(key[4:6])
        if month < 1 or month > 12 or not ok_num(rate):
            continue
        years.add(year)
        rain[(year, month)] = rate * days_in_month(year, month)
        t = (block.get("T2M") or {}).get(key)
        if ok_num(t):
            tmean[(year, month)] = t
        tx = (block.get("T2M_MAX") or {}).get(key)
        if ok_num(tx):
            tmax_x[(year, month)] = tx
        tn = (block.get("T2M_MIN") or {}).get(key)
        if ok_num(tn):
            tmin_x[(year, month)] = tn
    header = payload.get("header") or {}
    return {
        "rain": rain, "tmean": tmean, "tmax_x": tmax_x, "tmin_x": tmin_x,
        "years": sorted(years),
        "range": header.get("start"), "end": header.get("end"),
        "api": (header.get("api") or {}).get("version"),
        "period_note": header.get("range"),
    }


def parse_climatology(payload):
    """Official NASA climatology (currently Jan 2001–Dec 2025). Rain is mm/day."""
    block = parameter_block(payload)
    keys = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN",
            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
    rain, tmean = [], []
    for i, key in enumerate(keys):
        rate = (block.get("PRECTOTCORR") or {}).get(key)
        t = (block.get("T2M") or {}).get(key)
        rain.append(rate * MDAYS[i] if ok_num(rate) else None)
        tmean.append(t if ok_num(t) else None)
    header = payload.get("header") or {}
    return {
        "rain": rain, "tmean": tmean,
        "period": header.get("range") or "NASA climatology",
        "messages": payload.get("messages") or [],
        "elev_m": None,
    }


def parse_daily(payload):
    """Recent daily values, dropping NASA fill values at the end (publication lag)."""
    block = parameter_block(payload)
    rain_p = block.get("PRECTOTCORR") or {}
    t_p = block.get("T2M") or {}
    tx_p = block.get("T2M_MAX") or {}
    days = []
    for key in sorted(rain_p):
        p, t, tx = rain_p.get(key), t_p.get(key), tx_p.get(key)
        if not ok_num(p):
            continue
        days.append({
            "date": key,
            "rain": p,
            "t": t if ok_num(t) else None,
            "tmax": tx if ok_num(tx) else None,
        })
    return days


def mean(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return sum(values) / len(values)


def monthly_means(series, year0, year1, months=range(1, 13)):
    """Average of a (year, month) -> value map over a year window."""
    out = []
    for m in months:
        vals = [series.get((y, m)) for y in range(year0, year1 + 1) if (y, m) in series]
        out.append(mean(vals))
    return out


def annual_means(rain, tmean, year0, year1):
    """Mean annual rainfall (mm) and mean temperature over a year window."""
    year_rain, year_t = [], []
    for y in range(year0, year1 + 1):
        months_r = [rain.get((y, m)) for m in range(1, 13)]
        months_t = [tmean.get((y, m)) for m in range(1, 13)]
        if all(v is not None for v in months_r):
            year_rain.append(sum(months_r))
        ts = [v for v in months_t if v is not None]
        if len(ts) == 12:
            year_t.append(sum(ts) / 12.0)
    return mean(year_rain), mean(year_t), len(year_rain)


# ---------- Walo rules (same logic as js/data.js + lib/agro.js) ----------

def peff(p):
    """USDA-SCS effective rain (mm/month), same formula as AGRO.peff / FAO CROPWAT."""
    if p is None:
        return None
    if p <= 250:
        return p * (125 - 0.2 * p) / 125.0
    return 125 + 0.1 * p


def heat_line(crop, rules):
    """Critical temperature for this crop. Maize and rice: 35 °C (Sánchez et al. 2014).
    Other crops: the top of the EcoCrop optimum range, same as the app."""
    heat = (rules or {}).get("heat") or {}
    special = (heat.get("crops") or {}).get(crop.get("id"))
    if special:
        return {"t": special["tmax_c"], "src": special.get("source"), "cited": True}
    eco = (crop.get("eco") or {}).get("temp_c") or {}
    if eco.get("opt_max") is not None:
        return {"t": eco["opt_max"], "src": "ECOCROP", "cited": False}
    return None


def wrsi_class(wrsi, rules):
    classes = ((rules or {}).get("water") or {}).get("wrsi_classes") or [
        {"min": 80, "label": "Enough rain", "cls": "good"},
        {"min": 60, "label": "Some water stress", "cls": "wait"},
        {"min": 50, "label": "Serious water stress", "cls": "bad"},
        {"min": 0, "label": "Crop likely to fail without water", "cls": "bad"},
    ]
    if wrsi is None:
        return None
    for row in classes:
        if wrsi >= row["min"]:
            return row
    return classes[-1]


def wrsi_dots(wrsi, rules):
    dots = ((rules or {}).get("water") or {}).get("wrsi_dots") or [
        {"min": 80, "dots": 5}, {"min": 60, "dots": 4},
        {"min": 50, "dots": 3}, {"min": 0, "dots": 1},
    ]
    if wrsi is None:
        return None
    for row in dots:
        if wrsi >= row["min"]:
            return row["dots"]
    return 1


def stages_for(crop):
    """FAO-56 stage lengths scaled to the local season, same as AGRO.stages."""
    fao = crop.get("fao56") or {}
    lengths = fao.get("stage_days")
    if not lengths:
        return None
    total = sum(lengths)
    season = crop.get("days_typical") or total
    out = [js_round(x * season / float(total)) for x in lengths]
    out[3] += season - sum(out)
    return out


def kc_day(crop, day, lengths):
    """FAO-56 crop coefficient on day `day` of the season (AGRO.kcDay)."""
    fao = crop["fao56"]
    a, b, mid, end = lengths
    if day < a:
        return fao["kc_ini"]
    if day < a + b:
        return fao["kc_ini"] + (day - a) / float(b) * (fao["kc_mid"] - fao["kc_ini"])
    if day < a + b + mid:
        return fao["kc_mid"]
    return fao["kc_mid"] + (day - a - b - mid) / float(end) * (fao["kc_end"] - fao["kc_mid"])


def nearest_hot(hot, threshold):
    if not hot:
        return None
    keys = [int(k) if not isinstance(k, int) else k for k in hot]
    if not keys:
        return None
    k = min(keys, key=lambda x: abs(x - threshold))
    return hot.get(k, hot.get(str(k)))


def season_fit(crop, months, sow, rules):
    """FAO-56 water balance + WRSI for a crop sown on 0-based day-of-year `sow`.

    Same method as AGRO.seasonFit in lib/agro.js: monthly climate is spread
    evenly over the days of the month; a 100 mm soil store starts empty
    and fills with effective rain.
    """
    lengths = stages_for(crop)
    if not lengths:
        return None
    season = sum(lengths)
    cap = ((rules or {}).get("water") or {}).get("soil_store_mm", 100)
    hl = heat_line(crop, rules)
    store = need = aet = rain = pe = hot = 0.0
    mid0 = lengths[0] + lengths[1]
    mid1 = mid0 + lengths[2]
    for d in range(season):
        m = months[month_of_doy(sow + d)]
        n = float(MDAYS[m["month"] - 1])
        etc = kc_day(crop, d, lengths) * m["et0_mm"] / n
        p = m["rain_mm"] / n
        e = m["peff_mm"] / n
        store = min(cap, store + e)
        a = min(etc, store)
        store -= a
        need += etc
        aet += a
        rain += p
        pe += e
        if hl and mid0 <= d < mid1:
            h = nearest_hot(m.get("hot") or {}, hl["t"])
            if h:
                hot += h / n
    wrsi = js_round(100 * aet / need) if need else None
    return {
        "sow": sow, "days": season,
        "need_mm": js_round(need), "rain_mm": js_round(rain),
        "peff_mm": js_round(pe), "deficit_mm": js_round(need - aet),
        "wrsi": wrsi, "water_class": wrsi_class(wrsi, rules),
        "water_dots": wrsi_dots(wrsi, rules),
        "hot_days": js_round(hot) if hl else None, "heat": hl,
    }


def lin(v, a, b, c2, d):
    """Piecewise-linear EcoCrop score, same as AGRO.lin."""
    if v is None or a is None:
        return None
    if v <= a or (d is not None and v >= d):
        return 0.0
    if v < b:
        return (v - a) / float(b - a)
    if c2 is None or v <= c2 or d is None:
        return 1.0
    return (d - v) / float(d - c2)


def ecocrop(crop, months):
    """EcoCrop suitability, same as AGRO.ecocrop (rain = annual total)."""
    eco = crop.get("eco") or {}
    t, r = eco.get("temp_c"), crop.get("rain_gh") or eco.get("rain_mm_annual")
    if not t or not r:
        return None
    cy = eco.get("cycle_days") or {}
    n = max(1, min(12, js_round(((cy.get("min") or 365) + (cy.get("max") or cy.get("min") or 365)) / 2 / 30.0)))
    rain = sum(m["rain_mm"] for m in months)
    rs = lin(rain, r["abs_min"], r["opt_min"], r.get("opt_max"), r.get("abs_max"))
    best = None
    for start in range(12):
        ts, lo = 1.0, None
        for k in range(n):
            m = months[(start + k) % 12]
            v = lin(m["tmean_c"], t["abs_min"], t["opt_min"], t.get("opt_max"), t.get("abs_max"))
            if v is not None and v < ts:
                ts, lo = v, m["month"]
        if best is None or ts > best["temp"]:
            best = {"temp": round(ts * 100) / 100.0, "start": start + 1, "months": n, "worst_month": lo}
    best["suit"] = round(best["temp"] * rs * 100) / 100.0
    best["rain_s"] = round(rs * 100) / 100.0
    best["rain_mm"] = js_round(rain)
    return best


def class_of(suit, rules):
    classes = ((rules or {}).get("suitability") or {}).get("classes") or [
        {"min": 0.8, "code": "S1", "label": "Highly suitable", "dots": 5},
        {"min": 0.6, "code": "S2", "label": "Moderately suitable", "dots": 4},
        {"min": 0.4, "code": "S3", "label": "Marginally suitable", "dots": 3},
        {"min": 0.2, "code": "S3-", "label": "Very marginal", "dots": 2},
        {"min": 0, "code": "N", "label": "Not suitable", "dots": 1},
    ]
    for row in classes:
        if suit >= row["min"]:
            return row
    return classes[-1]


def fit_word(score):
    """Same wording the app uses (js/data.js fitWord)."""
    if score >= 4:
        return "Grows well"
    if score == 3:
        return "Can grow"
    return "Grows poorly"


def crop_sow_months(crop, zone, agro, rules):
    """Planting months, same as js/data.js cropMonths.

    If the FAO Ghana crop calendar lists windows for this zone, those months
    are used. Otherwise Walo uses the onset-of-rains window (20th to 80th
    percentile) and drops a season whose FAO-56 water class is 'bad'.
    """
    windows = (crop.get("windows") or {}).get(zone) or []
    if windows:
        sow = []
        labels = []
        for w in windows:
            for m in w.get("sow") or []:
                if m not in sow:
                    sow.append(m)
            labels.append({
                "label": w.get("label"),
                "sow": list(w.get("sow") or []),
                "sow_text": w.get("sow_text"),
                "src": w.get("src") or "FAO Ghana crop calendar",
            })
        return {"sow": sorted(sow), "windows": labels, "guess": all(w.get("best") for w in windows),
                "source": "FAO Ghana crop calendar"}

    if not agro:
        return {"sow": [], "windows": [], "guess": True, "source": None}

    sow, labels = [], []
    uses_water_limit = ((rules or {}).get("water") or {}).get("wrsi_max_season_days", 200)
    for season in ("major", "minor"):
        onset = (agro.get("onset") or {}).get(season)
        if not onset or onset.get("median") is None:
            continue
        if crop.get("kind") == "tree" and season != "major":
            continue
        fit = season_fit(crop, agro["months"], onset["median"], rules)
        if fit and crop.get("kind") == "seasonal" and fit["days"] <= uses_water_limit:
            if fit["water_class"] and fit["water_class"].get("cls") == "bad":
                continue
        months = []
        d = onset["p20"]
        while d <= onset["p80"]:
            m = month_of_doy(d) + 1
            if m not in months:
                months.append(m)
            d += 5
        end_m = month_of_doy(onset["p80"]) + 1
        if end_m not in months:
            months.append(end_m)
        for m in months:
            if m not in sow:
                sow.append(m)
        labels.append({
            "label": "Major season" if season == "major" else "Second season",
            "sow": months,
            "sow_text": "%s – %s" % (doy_to_text(onset["p20"]), doy_to_text(onset["p80"])),
            "src": "Onset of rains (Sivakumar 1988 / Stern 1982), same as Walo",
        })
    return {"sow": sorted(sow), "windows": labels, "guess": True, "source": "onset of rains"}


# ---------- place / crop lookup ----------

def norm_name(s):
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def lookup_place(name, data):
    """Find a ready-made place by name or id (case-insensitive, ignores spaces)."""
    want = norm_name(name)
    if not want:
        return None
    for label, rec in PLACES.items():
        if norm_name(label) == want or rec["id"] == want:
            out = dict(rec)
            out["name"] = "Ejura" if out["id"] == "ejura" else label
            return out
    places = (data.get("places") or {}).get("places") or {}
    for pid, rec in places.items():
        if norm_name(pid) == want or norm_name(rec.get("name")) == want:
            out = dict(rec)
            out["id"] = pid
            return out
    return None


def resolve_target(args, data):
    """Decide the place from flags and the SETTINGS block."""
    if args.lat is not None or args.lon is not None:
        if args.lat is None or args.lon is None:
            sys.exit("Give both --lat and --lon (for example --lat 7.3856 --lon -1.3562).")
        name = args.name or args.place or PLACE_NAME or "Custom point"
        known = lookup_place(name, data) if (args.place or args.name) else None
        return {
            "name": name if not known else known.get("name", name),
            "lat": args.lat, "lon": args.lon,
            "id": known.get("id") if known else None,
            "region": known.get("region") if known else None,
            "zone": known.get("zone") if known else None,
            "custom": True,
        }

    name = args.place or PLACE_NAME
    known = lookup_place(name, data)
    if known:
        # Prefer official coordinates from places.json when the file is present.
        official = ((data.get("places") or {}).get("places") or {}).get(known["id"]) or {}
        lat = official.get("lat", known["lat"])
        lon = official.get("lon", known["lon"])
        return {
            "name": official.get("name") or known.get("name") or name,
            "lat": lat, "lon": lon, "id": known["id"],
            "region": official.get("region") or known.get("region"),
            "zone": official.get("zone") if "zone" in official else known.get("zone"),
            "custom": False,
        }

    # PLACE_NAME was not in the list — use LAT / LON from the settings block.
    if not args.place and LAT is not None and LON is not None:
        return {"name": name, "lat": LAT, "lon": LON, "id": None,
                "region": None, "zone": None, "custom": True}

    ready = ", ".join(sorted(set(rec["id"] and label for label, rec in PLACES.items()
                                 if label != "Ejura-Sekyedumase")))
    sys.exit("I do not have a saved point called %r.\n"
             "Use one of: %s\n"
             "Or pass any point:  python3 walo_proof.py --lat 7.39 --lon -1.36 --name 'My field'"
             % (name, ready))


def find_crop(crop_id, data):
    crops = ((data.get("crops") or {}).get("crops") or [])
    want = norm_name(crop_id)
    for c in crops:
        if c["id"] == crop_id or norm_name(c["id"]) == want or norm_name(c.get("name")) == want:
            return c
    if crops:
        names = ", ".join(c["id"] for c in crops)
        sys.exit("I do not know a crop called %r.\nWalo's crops are: %s" % (crop_id, names))
    # Standalone fallback so the script still runs without the data folder.
    if want == "maize":
        return {
            "id": "maize", "name": "Maize", "kind": "seasonal", "days_typical": 90,
            "windows": {},
            "eco": {"temp_c": {"abs_min": 10, "opt_min": 18, "opt_max": 33, "abs_max": 47},
                    "rain_mm_annual": {"abs_min": 400, "opt_min": 600, "opt_max": 1200, "abs_max": 1800},
                    "cycle_days": {"min": 65, "max": 365}},
            "fao56": {"kc_ini": 0.3, "kc_mid": 1.2, "kc_end": 0.35, "stage_days": [20, 35, 40, 30]},
        }
    sys.exit("No Walo data folder found, and %r is not in the built-in fallback (maize).\n"
             "Put this script next to the app, or pass --crop maize." % crop_id)


def fill_zone(target, data):
    """A saved town already has a FAO zone. A custom point uses the nearest town's zone."""
    if target.get("zone") is not None or not target.get("id"):
        # custom or already set; for custom, copy zone from nearest bundled town
        pass
    official = ((data.get("places") or {}).get("places") or {}).get(target.get("id") or "") or {}
    if official.get("zone") is not None:
        target["zone"] = official["zone"]
        return target
    places = ((data.get("places") or {}).get("places") or {})
    if not places:
        return target
    best, best_d = None, None
    for pid, rec in places.items():
        dlat = rec["lat"] - target["lat"]
        dlon = rec["lon"] - target["lon"]
        # rough km (good enough to pick the nearest town)
        d = math.sqrt((dlat * 111) ** 2 + (dlon * 111 * math.cos(math.radians(target["lat"]))) ** 2)
        if best_d is None or d < best_d:
            best, best_d = rec, d
            best["id"] = pid
    if best:
        target["zone"] = best.get("zone")
        target["near_id"] = best["id"]
        target["near_name"] = best.get("name")
        target["near_km"] = round(best_d)
    return target


def agro_for(target, data):
    agro_places = (data.get("agro") or {}).get("places") or {}
    if target.get("id") and target["id"] in agro_places:
        return agro_places[target["id"]]
    if target.get("near_id") and target["near_id"] in agro_places:
        return agro_places[target["near_id"]]
    return None


# ---------- printing ----------

def section(title):
    print()
    print("-" * 60)
    print(title)
    print("-" * 60)


def print_usual(rain_mm, tmean, year0, year1):
    section("1. Usual rain and temperature  (NASA POWER, %s–%s)" % (year0, year1))
    peak = max(v for v in rain_mm if v is not None)
    year_rain = sum(v or 0 for v in rain_mm)
    print("  Month     Rain            Usual temperature")
    for i, r in enumerate(rain_mm):
        t = tmean[i]
        rtxt = "%4.0f mm" % r if r is not None else "   n/a"
        ttxt = ("%5.1f °C" % t) if t is not None else ""
        print("  %-9s %s  %-16s  %s" % (MONTHS_SHORT[i], rtxt, bar(r or 0, peak), ttxt))
    print()
    print("  A usual year here has about %s mm of rain." % comma(year_rain))


def print_then_now(then_rain, then_t, now_rain, now_t, then_years, now_years, n_then, n_now):
    section("2. Ten years ago compared with recently")
    print("  Same NASA POWER monthly data, same point.")
    print("  Ten years ago : %s–%s  (%s complete years)" % (then_years[0], then_years[1], n_then))
    print("  Recent years  : %s–%s  (%s complete years)" % (now_years[0], now_years[1], n_now))
    print()
    if then_rain is not None and now_rain is not None:
        diff = now_rain - then_rain
        if abs(diff) < 10:
            words = "about the same as ten years ago."
        elif diff > 0:
            words = "about %s mm more than ten years ago." % comma(abs(diff))
        else:
            words = "about %s mm less than ten years ago." % comma(abs(diff))
        print("  Rain in a usual year:")
        print("    Ten years ago : %s mm" % comma(then_rain))
        print("    Recent years  : %s mm" % comma(now_rain))
        print("    Change        : %s" % words)
    print()
    if then_t is not None and now_t is not None:
        diff = now_t - then_t
        if abs(diff) < 0.1:
            words = "about the same as ten years ago."
        elif diff > 0:
            words = "about %.1f °C warmer than ten years ago." % abs(diff)
        else:
            words = "about %.1f °C cooler than ten years ago." % abs(diff)
        print("  Usual temperature:")
        print("    Ten years ago : %.1f °C" % then_t)
        print("    Recent years  : %.1f °C" % now_t)
        print("    Change        : %s" % words)


def pretty_date(yyyymmdd):
    try:
        d = datetime.datetime.strptime(yyyymmdd, "%Y%m%d")
        return d.strftime("%d %b %Y")
    except ValueError:
        return yyyymmdd


def print_recent(days):
    section("3. Recent weather  (NASA POWER daily)")
    if not days:
        print("  NASA has not published recent daily values for this point yet.")
        return
    first, last = days[0]["date"], days[-1]["date"]
    total = sum(d["rain"] for d in days)
    wet = sum(1 for d in days if d["rain"] >= 1)
    hottest = max((d for d in days if d["tmax"] is not None), key=lambda d: d["tmax"], default=None)
    print("  From %s to %s  (%s days published)." % (pretty_date(first), pretty_date(last), len(days)))
    print("  Rain in that period : %s mm, with %s wet day%s of at least 1 mm." % (comma(total), wet, "" if wet == 1 else "s"))
    if hottest:
        print("  Hottest day         : %.1f °C on %s." % (hottest["tmax"], pretty_date(hottest["date"])))
    print("  (NASA daily values often lag a few days behind today.)")


def month_list(months):
    return ", ".join(MONTHS[m - 1] for m in months)


def print_crop(crop, target, agro, rules, live_rain, live_tmean):
    section("4. Good months for %s here  (same rules as Walo)" % crop["name"])
    zone = target.get("zone")
    if zone:
        zone_name = ZONE_NAMES.get(zone, zone)
        print("  This place is in the %s." % zone_name)
    elif target.get("near_name"):
        print("  Closest saved town: %s (about %s km). Using that town's zone where needed."
              % (target["near_name"], target.get("near_km")))

    plan = crop_sow_months(crop, zone, agro, rules)
    if plan["windows"]:
        src = plan["windows"][0].get("src")
        if plan["source"] == "FAO Ghana crop calendar":
            print("  The FAO crop calendar (the same one Walo uses) says plant %s in:"
                  % crop["name"].lower())
        else:
            print("  Using the onset-of-rains rule Walo uses when no FAO calendar window exists:")
        for w in plan["windows"]:
            label = (w["label"] + ": ") if w.get("label") else ""
            if w.get("sow_text"):
                print("    %s%s  (%s)" % (label, w["sow_text"], month_list(w["sow"])))
            else:
                print("    %s%s" % (label, month_list(w["sow"])))
        print("    Source: %s." % src)
    elif plan["sow"]:
        print("  Planting months: %s." % month_list(plan["sow"]))
    else:
        print("  No planting window is listed for this crop at this place.")

    # Water + heat, using the app's stored daily climatology (ET0 and onset).
    if agro and agro.get("months"):
        onset = (agro.get("onset") or {}).get("major") or {}
        if onset.get("median") is not None:
            print()
            print("  Usual start of the main rains here: %s"
                  % doy_to_text(onset["median"]), end="")
            if onset.get("p20") is not None and onset.get("p80") is not None:
                print("  (most years: %s to %s)." % (doy_to_text(onset["p20"]), doy_to_text(onset["p80"])))
            else:
                print(".")
            fit = season_fit(crop, agro["months"], onset["median"], rules)
            if fit and fit.get("wrsi") is not None:
                wc = fit["water_class"] or {}
                print("  Water need (FAO-56) if planted on that date:")
                print("    The crop needs about %s mm; usual rain in the season is about %s mm."
                      % (comma(fit["need_mm"]), comma(fit["rain_mm"])))
                print("    Water satisfaction (WRSI): %s%% — %s."
                      % (fit["wrsi"], wc.get("label") or "n/a"))
            if fit and fit.get("heat") and fit.get("hot_days") is not None:
                print("  Heat limit: %s can be hurt above %.0f °C%s."
                      % (crop["name"].lower(), fit["heat"]["t"],
                         " at flowering" if fit["heat"].get("cited") else ""))
                if fit["hot_days"] > 0:
                    print("    A usual season has about %s day(s) that hot during flowering."
                          % fit["hot_days"])
                else:
                    print("    A usual season does not usually hit that limit during flowering.")

        eco = ecocrop(crop, agro["months"])
        if eco is not None:
            cls = class_of(eco["suit"], rules)
            # Combine with water class the way scoreCrop does, when we have a fit.
            score = cls["dots"]
            onset = (agro.get("onset") or {}).get("major") or {}
            fit = season_fit(crop, agro["months"], onset["median"], rules) if onset.get("median") is not None else None
            water_ok = fit and crop.get("kind") == "seasonal" and fit.get("days") and fit["days"] <= ((rules or {}).get("water") or {}).get("wrsi_max_season_days", 200)
            if water_ok and fit.get("water_dots"):
                score = min(score, fit["water_dots"])
            print("  Climate class (FAO EcoCrop, same as Walo): %s — %s."
                  % (fit_word(score), cls["label"]))
    elif live_rain and all(v is not None for v in live_rain):
        # Custom point with no stored agro: annual EcoCrop rain only (no ET0 / onset).
        print()
        print("  (No stored daily climate for this exact point, so water-need and")
        print("   onset dates are not computed here. Rain suitability uses the live total.)")
        months = [{"month": i + 1, "rain_mm": live_rain[i], "tmean_c": (live_tmean[i] if live_tmean else None)}
                  for i in range(12)]
        # Build a temporary crop months list in the shape ecocrop expects.
        if crop.get("eco"):
            # tmean may be present from live monthly T2M
            if all(m["tmean_c"] is not None for m in months):
                eco = ecocrop(crop, months)
                if eco is not None:
                    cls = class_of(eco["suit"], rules)
                    print("  EcoCrop rain+temperature class from live NASA data: %s (%s)."
                          % (cls["label"], fit_word(cls["dots"])))

    if plan["sow"]:
        print()
        print("  Same as the app shows: plant %s in %s."
              % (crop["name"].lower(), month_list(plan["sow"])))
        if zone is None and not plan["windows"]:
            print("  (Open Walo, pick this place, and the app will confirm from the live climate.)")


def print_match(live_rain, live_t, agro, place_name):
    """Short live-vs-app check, useful both for us and for judges."""
    if not agro or not agro.get("months"):
        return None
    app_r = [m["rain_mm"] for m in agro["months"]]
    app_t = [m["tmean_c"] for m in agro["months"]]
    d_r = [abs((live_rain[i] or 0) - app_r[i]) for i in range(12)]
    d_t = [abs((live_t[i] or 0) - app_t[i]) for i in range(12)]
    max_r, max_t = max(d_r), max(d_t)
    section("5. Do these live numbers match the app?")
    years = agro.get("years") or [1991, 2025]
    print("  Comparing this NASA download with Walo's stored climate for %s"
          " (%s–%s daily average)." % (place_name, years[0], years[1]))
    # compact line
    worst_r = d_r.index(max_r) + 1
    print("  Rain: biggest gap is %.1f mm (%s). Annual total live %s mm, app %s mm."
          % (max_r, MONTHS_SHORT[worst_r - 1],
             comma(sum(live_rain)), comma(sum(app_r))))
    print("  Temperature: biggest gap is %.2f °C." % max_t)
    if max_r <= 2 and max_t <= 0.2:
        print("  These are the same numbers, within normal rounding.")
        print("  (Tiny gaps come from leap days: the app reads daily data and skips 29 Feb.)")
    else:
        print("  The gap is larger than simple rounding. See the verification notes.")
    return {"max_rain_gap_mm": max_r, "max_temp_gap_c": max_t,
            "worst_rain_month": worst_r,
            "live_annual": sum(live_rain), "app_annual": sum(app_r),
            "month_gaps": [{"month": i + 1, "live_rain": live_rain[i], "app_rain": app_r[i],
                            "d_rain": live_rain[i] - app_r[i],
                            "live_t": live_t[i], "app_t": app_t[i],
                            "d_t": live_t[i] - app_t[i]} for i in range(12)]}


# ---------- main ----------

def parse_args():
    p = argparse.ArgumentParser(
        description="Pull NASA POWER live for one place and apply Walo's crop rules.",
        epilog="Examples:\n"
               "  python3 walo_proof.py\n"
               "  python3 walo_proof.py --place Tamale\n"
               "  python3 walo_proof.py --place Techiman --crop rice\n"
               "  python3 walo_proof.py --lat 7.3856 --lon -1.3562 --name Ejura\n",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--place", help="Name of a ready place, e.g. Tamale, Techiman, Kumasi, Accra, Ejura")
    p.add_argument("--lat", type=float, help="Latitude (use with --lon)")
    p.add_argument("--lon", type=float, help="Longitude (use with --lat)")
    p.add_argument("--name", help="Label to print when you pass --lat and --lon")
    p.add_argument("--crop", help="Crop id or name (default: the CROP setting, usually maize)")
    return p.parse_args()


def main():
    args = parse_args()
    data = load_walo_data()
    # Allow app.json zone names to override the built-in labels.
    zones = (data.get("app") or {}).get("zones") or {}
    for code, rec in zones.items():
        if code.startswith("_"):
            continue
        if isinstance(rec, dict) and rec.get("name"):
            ZONE_NAMES[code] = rec["name"]

    target = fill_zone(resolve_target(args, data), data)
    crop = find_crop(args.crop or CROP, data)
    rules = data.get("rules") or {}
    agro = agro_for(target, data)
    year0, year1 = YEARS

    today = datetime.date.today()
    daily_end = today - datetime.timedelta(days=1)
    daily_start = daily_end - datetime.timedelta(days=RECENT_DAYS - 1)

    urls = {
        "climatology": power_url("climatology", target["lat"], target["lon"]),
        "monthly": power_url("monthly", target["lat"], target["lon"], year0, year1),
        "daily": power_url("daily", target["lat"], target["lon"],
                           daily_start.strftime("%Y%m%d"), daily_end.strftime("%Y%m%d")),
    }

    print("=" * 60)
    print("WALO PROOF  —  NASA data for this exact place")
    print("=" * 60)
    line = "Place : %s  (%s,  %s)" % (target["name"], fmt_lat(target["lat"]), fmt_lon(target["lon"]))
    if target.get("region"):
        line += "  %s" % target["region"]
    print(line)
    print("Crop  : %s" % crop["name"])
    print("Years : %s–%s (same years the Walo app uses)" % (year0, year1))
    if data.get("dir"):
        print("Data  : reading Walo rules from %s" % data["dir"])
    print()
    print("NASA pages you can open now (same request this script just made):")
    print("  Usual climate (climatology):")
    print("    %s" % urls["climatology"])
    print("  Month-by-month history (%s–%s):" % (year0, year1))
    print("    %s" % urls["monthly"])
    print("  Recent days:")
    print("    %s" % urls["daily"])
    print()
    print("Asking NASA now…")
    sys.stdout.flush()

    results, errors = {}, {}

    def one(kind):
        return kind, fetch_json(urls[kind])

    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            for kind, payload in pool.map(one, ("climatology", "monthly", "daily")):
                results[kind] = payload
    except Exception as exc:
        print()
        print(friendly_network_error(exc))
        sys.exit(1)

    # If the pooled map already succeeded, we have all three. Still guard missing.
    if "monthly" not in results:
        print()
        print("NASA POWER did not return the monthly history. Try again in a minute.")
        sys.exit(1)

    monthly = parse_monthly(results["monthly"])
    clim = parse_climatology(results.get("climatology") or {"properties": {}})
    recent = parse_daily(results.get("daily") or {"properties": {}})

    if not monthly["years"]:
        print()
        print("NASA returned no monthly values for this point and year range.")
        sys.exit(1)

    live_rain = monthly_means(monthly["rain"], year0, year1)
    live_t = monthly_means(monthly["tmean"], year0, year1)

    print_usual(live_rain, live_t, year0, year1)
    if clim.get("period"):
        period = clim["period"]
        if "(" in period and ")" in period:
            period = period[period.find("(") + 1:period.rfind(")")].replace(" - ", " to ")
        print("  NASA's official climatology page (the first URL above) covers %s." % period)
        print("  The table uses %s–%s so the numbers match the years stored in Walo." % (year0, year1))

    then_rain, then_t, n_then = annual_means(monthly["rain"], monthly["tmean"], *THEN_YEARS)
    now_rain, now_t, n_now = annual_means(monthly["rain"], monthly["tmean"], *NOW_YEARS)
    print_then_now(then_rain, then_t, now_rain, now_t, THEN_YEARS, NOW_YEARS, n_then, n_now)
    print_recent(recent)
    print_crop(crop, target, agro, rules, live_rain, live_t)

    match = None
    if agro and not target.get("custom"):
        match = print_match(live_rain, live_t, agro, target["name"])

    print()
    print("Source : NASA POWER  https://power.larc.nasa.gov/  (AG community, point API)")
    print("Rules  : FAO onset of rains, FAO-56 water need, EcoCrop, crop heat limits")
    print("         — the same rules as Walo (data/rules.json).")
    print("App    : https://walo-simply-zero.vercel.app")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(130)
