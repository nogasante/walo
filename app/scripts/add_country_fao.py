#!/usr/bin/env python3
"""Add a country's zones and planting windows from FAO's Crop Calendar API.

Hand-typing windows per country is how wrong dates slip in. FAO publishes a crop calendar per country,
per agro-ecological zone, with early/late sowing and harvest dates, and an extractable list of the
administrative units in each zone - so a town can be placed in the zone the source itself names, and
every window carries the calendar it came from.

Usage:
    python3 add_country_fao.py TG BJ CI BF ML SN          # write countries.json + crops.json
    python3 add_country_fao.py --check TG                 # only print what it found

Towns are read from data/places.json, so add the towns (name, region, lat, lon, country) first; this
script assigns each town to the FAO zone whose administrative-units text names its region. A town whose
region matches no zone is left with zone null and is reported, never guessed.
"""
import json, sys, urllib.request, urllib.parse, re

HERE = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
ROOT = __import__("os").path.join(HERE, "..")
API = "https://api-cropcalendar.apps.fao.org/api/v1/countries"

# FAO crop names (lowercased) -> our crop ids. Only crops Walɔ has a page for.
CROP_MAP = {
    "maize": "maize", "corn": "maize", "maize (corn)": "maize", "corn, sweet": "maize",
    "rice": "rice", "paddy rice": "rice", "rice, paddy": "rice",
    "sorghum": "sorghum", "millet": "millet", "pearl millet": "millet",
    "groundnut": "groundnut", "groundnuts": "groundnut", "groundnut (shelled)": "groundnut",
    "cowpea": "cowpea", "cowpeas": "cowpea", "cassava": "cassava", "yam": "yam",
    "plantain": "plantain", "cocoyam": "cocoyam", "taro": "cocoyam", "cocoa": "cocoa",
    "tomato": "tomato", "tomatoes": "tomato", "pepper": "pepper", "onion": "onion",
    "okra": "okra", "garden egg": "garden_egg", "eggplant": "garden_egg", "aubergine": "garden_egg",
    "sweet potato": "sweet_potato", "sweet potatoes": "sweet_potato",
    "soybean": "soybean", "soya bean": "soybean", "soybeans": "soybean",
    "cashew": "cashew", "cashew nut": "cashew",
}
MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Towns read against FAO's own zone descriptions. Text search alone put Zinder (Sahel) in the Sahara, so the
# town-to-zone call is made here, from the administrative units and rainfall band each zone states.
ZONE_OVERRIDE = {
    "TG": {"lome": "004", "sokode": "002", "kara": "001", "dapaong": "001"},
    "CI": {"abidjan": "001", "yamoussoukro": "003", "bouake": "003", "korhogo": "004"},
    "SN": {"dakar": "001", "thies": "004", "kaolack": "004", "tambacounda": "005"},
    "ML": {"bamako": "003", "sikasso": "004", "segou": "003", "mopti": "005"},
    "NE": {"niamey": "004", "zinder": "003", "maradi": "004", "agadez": "001"},
}
# the zones with a second (minor) rainy season; the rest see one
MINOR_ZONES = {"TG": ["003", "004"], "CI": ["001", "002"], "SN": ["006"], "ML": [], "NE": []}


def get(path):
    """FAO answers with an empty body (not JSON) for a country it has no calendar for."""
    try:
        with urllib.request.urlopen(f"{API}/{path}", timeout=60) as r:
            body = r.read()
        return json.loads(body) if body.strip() else None
    except Exception:
        return None


def span(a, b):
    return a if a == b else f"{a} – {b}"


def months_from(s, e):
    """Month list from a start month to an end month, wrapping the year end."""
    s, e = int(s), int(e)
    if not (1 <= s <= 12 and 1 <= e <= 12):
        return []
    out, m = [], s
    for _ in range(12):
        out.append(m)
        if m == e:
            break
        m = m % 12 + 1
    return out


def build_zone_windows(cal, zone_id):
    """Our window objects for one zone: one per crop, sessions in the calendar's own order."""
    by_crop = {}
    for row in cal:
        if str(row.get("aez", {}).get("id")) != str(zone_id):
            continue
        cid = CROP_MAP.get(str(row.get("crop", {}).get("name", "")).strip().lower())
        if not cid:
            continue
        for sess in row.get("sessions") or []:
            es, eh = sess.get("early_sowing"), sess.get("early_harvest")
            ls, lh = sess.get("late_sowing") or es, sess.get("late_harvest") or eh
            if not (es and eh):
                continue
            all_year = str(sess.get("all_year", "no")).lower() == "yes"
            # West African rainfed planting happens inside the rains (March-July). FAO also records dry-season
            # and off-season cycles - Togo's savannah maize is listed as sown in February - and those are not
            # the season a rainfed farmer is asking about, so they are dropped rather than scored.
            if not all_year and not any(3 <= int(m) <= 7 for m in months_from(es["month"], ls["month"])):
                continue
            obj = {
                "label": (sess.get("additional_information") or "").strip() or None,
                "sow_text": span(MONTHS[int(es["month"])], MONTHS[int(ls["month"])]) if not all_year else "All year",
                "harvest_text": span(MONTHS[int(eh["month"])], MONTHS[int(lh["month"])]),
                "sow": months_from(es["month"], ls["month"]),
                "harvest": months_from(eh["month"], lh["month"]),
                "all_year": all_year,
                "days": (sess.get("growing_period") or {}).get("value") or None,
                "src": "FAO Crop Calendar",
                "best": False,
            }
            by_crop.setdefault(cid, []).append(obj)
    for cid, wins in by_crop.items():
        if wins:
            wins[0]["best"] = True
    return by_crop


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    countries = json.load(open(f"{ROOT}/data/countries.json"))
    crops = json.load(open(f"{ROOT}/data/crops.json"))
    places = json.load(open(f"{ROOT}/data/places.json"))
    crop_by_id = {c["id"]: c for c in crops["crops"]}

    for iso in args:
        iso = iso.upper()
        entry = countries["countries"].get(iso)
        if not entry:
            print(f"{iso}: not in countries.json, skipped")
            continue
        aez = get(f"{iso}/aez?language=en")
        cal = get(f"{iso}/cropCalendar?language=en")
        if not aez or not cal:
            print(f"{iso}: FAO has no calendar for this country, skipped")
            continue
        zones = {}
        for z in aez:
            zid = str(z.get("zone_id") or "")
            name = (z.get("name") or "").strip()
            if not zid or not name:
                continue
            zones[zid] = {"name": name[:1].upper() + name[1:], "short": name[:18],
                          "_units": (z.get("administratrative_units") or "")[:400]}
        print(f"\n{iso}: {len(zones)} zones, {len(cal)} crop rows")
        for zid, z in zones.items():
            wins = build_zone_windows(cal, zid)
            print(f"  {zid} {z['name'][:28]:30} crops: {','.join(sorted(wins)) or '-'}")

        # put each town in the zone whose administrative text names its region
        mine = {pid: p for pid, p in places["places"].items() if p.get("country") == iso}
        override = ZONE_OVERRIDE.get(iso, {})
        for pid, p in mine.items():
            if pid in override:
                p["zone"] = f"{iso}{override[pid]}"
                print(f"  town {p['name'][:16]:18} region {p.get('region') or '-':16} -> zone {override[pid]} (chosen)")
                continue
            region = (p.get("region") or "").lower()
            town = (p.get("name") or "").lower()
            hit = None
            for zid, z in zones.items():
                units = (z.get("_units") or "").lower()
                if region and region in units:
                    hit = zid; break
                if town and town in units:
                    hit = zid; break
            p["zone"] = f"{iso}{hit}" if hit else None
            print(f"  town {p['name'][:16]:18} region {p.get('region') or '-':16} -> zone {hit or 'UNMATCHED'}")

        if check:
            continue

        if iso in MINOR_ZONES:
            entry["onset"]["minor_search"]["zones"] = [f"{iso}{z}" for z in MINOR_ZONES[iso]]
        for zid, z in zones.items():
            z.pop("_units", None)
        # FAO numbers its zones 001, 002... per country, so a bare "001" means Togo's dry savannah in one row and
        # Senegal's Niayes in another. Every key carries the country: TG001, SN004. Crops also record which zones
        # they are grown in, which is what the crop list filters on.
        entry["zones"] = {**{f"{iso}{k}": v for k, v in zones.items()}, "_source": f"FAO Crop Calendar agro-ecological zones for {iso}"}
        entry.setdefault("sources", {})["crop_calendar"] = f"FAO Crop Calendar ({iso})"
        for zid in zones:
            wins = build_zone_windows(cal, zid)
            for cid, w in wins.items():
                if cid in crop_by_id:
                    key = f"{iso}{zid}"
                    crop_by_id[cid].setdefault("zones", {})[key] = "FAO crop calendar lists this zone"
                    crop_by_id[cid]["windows"][key] = w
        print(f"  wrote zones and windows for {iso}")

    if not check:
        json.dump(countries, open(f"{ROOT}/data/countries.json", "w"), ensure_ascii=False, indent=2)
        json.dump(crops, open(f"{ROOT}/data/crops.json", "w"), ensure_ascii=False, separators=(",", ":"))
        json.dump(places, open(f"{ROOT}/data/places.json", "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
