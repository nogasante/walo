#!/usr/bin/env python3
"""Build data/prices.json from MoFA SRID's commodity price file.

Why this file exists: WFP stopped publishing Ghana market prices to HDX in July 2023, so the
seasonal index in data/market.json is a 2015-2023 pattern. SRID (the Ministry of Food and
Agriculture's Statistics, Research and Information Directorate) still collects retail and
wholesale prices per kilogram in markets across the country every two weeks and publishes them
as one CSV: https://srid.mofa.gov.gh/node/18

Usage:
    python3 build_srid_prices.py /path/to/"Commodity prices _04.11.25.csv"

What it writes (data/prices.json):
    markets: name -> {region, lat, lon}   only markets we can place on the map
    crops:   crop id -> {label, mk: {market -> {r: {v,d}, w: {v,d}, w4: number|null}}}

Prices are GH₵ per kilogram as published. A market entry is the mean of that week's rows
(SRID sometimes has two rows for the same commodity in one market). "w4" is the wholesale price
about four weeks earlier, for the "up/down since last month" line.
"""
import csv, json, sys, os, datetime, statistics, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "prices.json")

# SRID market names (messy, uppercase, with and without "market") -> the market on our map.
MARKETS = {
    "TEMA": ("Tema", "Greater Accra", 5.62, -0.02),
    "MANKESSIM": ("Mankessim", "Central", 5.27, -1.02),
    "NKWANTA": ("Nkwanta", "Oti", 8.26, 0.52),
    "GOASO": ("Goaso", "Ahafo", 6.8035, -2.5172),
    "KINTAMPO": ("Kintampo", "Bono East", 8.06, -1.73),
    "TECHIMAN": ("Techiman", "Bono East", 7.58, -1.93),
    "WA": ("Wa", "Upper West", 10.05, -2.48),
    "KOFORIDUA": ("Koforidua", "Eastern", 6.08, -0.25),
    "OBUASI": ("Obuasi", "Ashanti", 6.2, -1.67),
    "BOLGA": ("Bolga", "Upper East", 10.79, -0.85),
    "BOLGATANGA": ("Bolga", "Upper East", 10.79, -0.85),
    "MAKOLA": ("Accra", "Greater Accra", 5.55, -0.22),
    "AGBOGBLOSHIE": ("Accra", "Greater Accra", 5.55, -0.22),
    "HO": ("Ho", "Volta", 6.6, 0.47),
    "GARU": ("Garu", "Upper East", 10.85, -0.18),
    "BIBIANI": ("Bibiani", "Western North", 6.4529, -2.3150),
    "BAMBOI": ("Bamboi", "Savannah", 8.1640, -2.0325),
    "GBINTIRI": ("Gbintiri", "Northern", 10.1331, 0.0635),
}

# crop id -> the SRID commodity that is the same thing on the farm
CROPS = {
    "maize": "white maize",
    "rice": "Rice Local perfumed",
    "cassava": "Cassava",
    "yam": "Yam Puna",
    "sorghum": "Sorghum",
    "millet": "Millet",
    "plantain": "Plantain Apentu",
    "cowpea": "Cowpea White",
    "soybean": "Soya Bean",
    "groundnut": "Groundnut Red",
    "garden_egg": "Garden Egg",
    "onion": "Onion",
    "pepper": "Fresh Pepper Legon 18",
    "tomato": "Tomato Local",
    "okra": "Okro Fresh",
    "cocoyam": "Cocoyam",
    "sweet_potato": "Sweet Potato general white pinkish",
}


def norm_market(raw):
    s = " ".join((raw or "").upper().split())
    if not s:
        return None
    for key in sorted(MARKETS, key=len, reverse=True):  # longest name first: BOLGATANGA before BOLGA
        if s.startswith(key):
            return MARKETS[key]
    return None


def main(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    by_crop = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(list))))
    dates = set()
    markets, unmapped, matched = {}, set(), collections.Counter()
    for r in rows:
        m = norm_market(r.get("Market"))
        if not m:
            unmapped.add((r.get("Market") or "").strip())
            continue
        name, region, lat, lon = m
        comm = (r.get("commodity") or "").strip()
        crop = next((c for c, label in CROPS.items() if label.lower() == comm.lower()), None)
        if not crop:
            continue
        kind = (r.get("Type") or r.get("source") or "").strip().lower()
        if kind not in ("retail", "wholesale"):
            continue
        try:
            price, day = float(r["Price"]), r["market_day"]
        except (KeyError, ValueError, TypeError):
            continue
        if not (0 < price < 10000):
            continue
        markets[name] = {"region": region, "lat": lat, "lon": lon}
        dates.add(day)
        by_crop[crop][name][kind][day].append(price)
        matched[name] += 1

    out = {"markets": markets, "crops": {}}
    for crop, per_market in by_crop.items():
        entry = {"label": CROPS[crop], "mk": {}}
        for name, kinds in per_market.items():
            mk = {}
            for kind, per_day in kinds.items():
                days = sorted(per_day)
                if not days:
                    continue
                latest = days[-1]
                mk["r" if kind == "retail" else "w"] = {"v": round(statistics.mean(per_day[latest]), 2), "d": latest}
                if kind == "wholesale":  # the same market about four weeks earlier, for the change line
                    older = [d for d in days if (datetime.date.fromisoformat(latest) - datetime.date.fromisoformat(d)).days >= 21]
                    if older:
                        o = older[-1]
                        mk["w4"] = round(statistics.mean(per_day[o]), 2)
            if mk:
                entry["mk"][name] = mk
        entry["mk"] = dict(sorted(entry["mk"].items()))
        out["crops"][crop] = entry

    d0, d1 = min(dates), max(dates)
    out = {
        "source": {
            "name": "MoFA SRID, Agricultural Commodity Prices (Market Services Unit)",
            "url": "https://srid.mofa.gov.gh/node/18",
            "file": os.path.basename(path),
        },
        "fetched": datetime.date.today().isoformat(),
        "covered": [d0, d1],
        "unit": "GH₵ per kg",
        "about": "Retail and wholesale prices collected by the Ministry of Food and Agriculture's SRID in markets across Ghana every two weeks. One value per market is the mean of that week's rows for the commodity. Only markets we can place on the map are kept, and only the crop listed for each farm crop. Values are as published; nothing is adjusted.",
        "markets": dict(sorted(out["markets"].items())),
        "crops": dict(sorted(out["crops"].items())),
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}: {len(out['crops'])} crops, {len(out['markets'])} markets, {d0}..{d1}")
    for c, e in out["crops"].items():
        print(f"  {c:12s} {e['label'][:28]:30s} markets={len(e['mk'])}")
    print("left out (no place on our map):", sorted(x for x in unmapped if x))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
