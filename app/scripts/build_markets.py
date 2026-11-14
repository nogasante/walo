"""Build data/market.json from the WFP Ghana food prices CSV (HDX), for every Walo crop and all 20 markets with real depth.

Input:  /workspace/walo-crops-build/wfp_gha.csv (HDX "wfp_food_prices_gha.csv", 2006-01 to 2023-07, lat/lon per market)
Keeps:  MoFA SRID 2025 (Techiman) and GCX / dated quotes ("srid2025", "other_quotes") from the previous data/market.json.
Rules (same as before):
  - seasonal index: month price / that year's average (same series), averaged over 2015-2023 (INDEX_YEARS)
  - outliers: an observation > 3x the median of its neighbours (6 before + 6 after, same series, >= 4 neighbours) is
    excluded from charts and stats and listed under "excluded" (raw CSV unchanged)
  - markets with fewer than 100 rows in the file (one-off 2019-2021 survey points) are left out
  - a series needs >= 12 kept observations
"""
import csv, json, os, statistics as st
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("WALO_WFP_CSV", "/workspace/walo-crops-build/wfp_gha.csv")
OUT = os.path.join(HERE, "scripts", "data", "market_full.json")  # full output; scripts/finalize_data.py writes the app's data/market.json
INDEX_YEARS = (2015, 2023)
FACTOR, MIN_MARKET_ROWS, MIN_OBS = 3.0, 100, 12
SOURCE = "WFP Ghana food prices via HDX (sourced from FPMA / MoFA SRID / FAO GIEWS)"
SOURCE_URL = "https://data.humdata.org/dataset/wfp-food-prices-for-ghana"

# WFP commodity -> (Walo crop id, label shown in Walo). Processed or imported goods (gari, imported rice, dried pepper) are left out.
COMMODITY = {
    "Maize": ("maize", "Maize (white)"), "Maize (yellow)": ("maize", "Maize (yellow)"),
    "Cassava": ("cassava", "Cassava"), "Yam": ("yam", "Yam"), "Yam (puna)": ("yam", "Yam (puna)"),
    "Rice (local)": ("rice", "Rice (local)"), "Rice (paddy)": ("rice", "Rice (paddy)"),
    "Millet": ("millet", "Millet"), "Sorghum": ("sorghum", "Sorghum"), "Soybeans": ("soybean", "Soybean"),
    "Cowpeas": ("cowpea", "Cowpea"), "Cowpeas (white)": ("cowpea", "Cowpea (white)"),
    "Plantains (apentu)": ("plantain", "Plantain (apentu)"), "Plantains (apem)": ("plantain", "Plantain (apem)"),
    "Tomatoes (local)": ("tomato", "Tomato (local)"), "Tomatoes (navrongo)": ("tomato", "Tomato (Navrongo)"),
    "Peppers (fresh)": ("pepper", "Pepper (fresh)"), "Onions": ("onion", "Onion"), "Eggplants": ("garden_egg", "Garden egg"),
}
LABEL_ORDER = [v[1] for v in COMMODITY.values()]
r2 = lambda x: round(x, 2)

def seasonal_index(obs):
    by_year = defaultdict(dict)
    for (y, m), p in obs:
        if INDEX_YEARS[0] <= y <= INDEX_YEARS[1]:
            by_year[y][m] = p
    ratios = defaultdict(list)
    for y, months in by_year.items():
        avg = st.mean(months.values())
        for m, p in months.items():
            ratios[m].append(p / avg)
    idx = [{"index": r2(st.mean(ratios[m])), "n_years": len(ratios[m])} if ratios[m] else None for m in range(1, 13)]
    have = [(i, v["index"]) for i, v in enumerate(idx) if v]
    peak = max(have, key=lambda t: t[1])[0] + 1 if have else None
    dip = min(have, key=lambda t: t[1])[0] + 1 if have else None
    return idx, len(by_year), peak, dip

rows = list(csv.DictReader(open(SRC)))
per_market = Counter(x["market"] for x in rows)
keep_markets = {m for m, n in per_market.items() if n >= MIN_MARKET_ROWS}
markets = {}
for x in rows:
    if x["market"] in keep_markets and x["market"] not in markets:
        markets[x["market"]] = {"name": x["market"], "region": x["admin1"].title(), "lat": float(x["latitude"]), "lon": float(x["longitude"])}

groups = defaultdict(list)
for x in rows:
    if x["market"] not in keep_markets or x["commodity"] not in COMMODITY or x["currency"] != "GHS":
        continue
    cid, label = COMMODITY[x["commodity"]]
    groups[(cid, label, x["market"], x["unit"], x["pricetype"])].append(x)

old = json.load(open(OUT)) if os.path.exists(OUT) else {"crops": {}}
crops, excluded_total, examples = {}, 0, []
for (cid, label, mk, unit, ptype), g in groups.items():
    g.sort(key=lambda x: x["date"])
    obs = [((int(x["date"][:4]), int(x["date"][5:7])), float(x["price"]), x["priceflag"]) for x in g]
    keep, out = [], []
    for i, (ym, p, flag) in enumerate(obs):
        nb = [o[1] for o in obs[max(0, i - 6):i] + obs[i + 1:i + 7]]
        if len(nb) >= 4 and p > FACTOR * st.median(nb):
            out.append({"year": ym[0], "month": ym[1], "price": p, "priceflag": flag, "neighbour_median": r2(st.median(nb))})
        else:
            keep.append((ym, p))
    if len(keep) < MIN_OBS:
        continue
    idx, n_years, peak, dip = seasonal_index(keep)
    last = keep[-1][0]
    recent = [p for (y, m), p in keep if (last[0] * 12 + last[1]) - (y * 12 + m) < 12]
    unit_txt = f"{unit} ({ptype})"
    s = {"crop_label": label, "market": mk, "unit": unit_txt, "pricetype": ptype, "currency": "GHS",
         "first": f"{keep[0][0][0]}-{keep[0][0][1]:02d}", "last": f"{last[0]}-{last[1]:02d}", "n_obs": len(keep),
         "index_years": n_years, "index": idx, "peak_month": peak, "dip_month": dip,
         "recent_avg": r2(st.mean(recent)), "recent_n": len(recent),
         "latest": [{"year": y, "month": m, "price": p} for (y, m), p in keep[-12:]],
         "source": SOURCE, "source_url": SOURCE_URL}
    if out:
        s["excluded"] = out; excluded_total += len(out)
        if cid == "cassava" and mk == "Ejura": examples.append(out)
    crops.setdefault(cid, {"series": []})["series"].append(s)

for cid, c in crops.items():
    c["series"].sort(key=lambda s: (s["market"], s["pricetype"] != "Wholesale", LABEL_ORDER.index(s["crop_label"]), -s["n_obs"]))
    # one "main" series per market: wholesale first, then the label most markets share, then most observations
    lab_count = Counter(s["crop_label"] for s in c["series"] if s["index_years"] >= 2)
    best = {}
    for s in c["series"]:
        if s["index_years"] < 2 or not s["peak_month"]:
            continue
        k = (s["pricetype"] == "Wholesale", lab_count[s["crop_label"]], s["index_years"], s["n_obs"])
        if s["market"] not in best or k > best[s["market"]][0]:
            best[s["market"]] = (k, s)
    for s in c["series"]:
        s["main"] = best.get(s["market"], (None, None))[1] is s
        s["thin"] = s["index_years"] < 4
    # the unit most main series share, so markets can be compared like for like
    mains = [s for s in c["series"] if s["main"]]
    if mains:
        cu = Counter((s["crop_label"], s["unit"]) for s in mains).most_common(1)[0][0]
        c["compare"] = {"crop_label": cu[0], "unit": cu[1]}
    c["markets"] = sorted({s["market"] for s in mains})

# keep MoFA SRID 2025 and dated quotes (GCX etc.) from the previous file
for cid, oc in old.get("crops", {}).items():
    c = crops.setdefault(cid, {"series": [], "markets": []})
    c["srid2025"] = [{**x, "market": x.get("market", "Techiman")} for x in oc.get("srid2025", [])]  # MoFA SRID 2025 file is Techiman only
    c["other_quotes"] = oc.get("other_quotes", [])
for c in crops.values():
    c.setdefault("srid2025", []); c.setdefault("other_quotes", [])

used = sorted({s["market"] for c in crops.values() for s in c["series"]})
out_json = {
    "notes": [
        "Seasonal index method: each month's price divided by that year's average for the same series, averaged over 2015-2023. It shows timing, not today's price.",
        "WFP/HDX observations end in July 2023.",
        f"Markets: the {len(used)} WFP markets with long monthly series (2006-2023). {len([m for m, n in per_market.items() if n < MIN_MARKET_ROWS])} other markets have only 2-4 survey rows and are left out.",
        "Prices between markets are compared like for like only: same crop label and unit, average of the last 12 months of data in each market.",
        "MoFA SRID 2025 file covers Techiman only (22 Jun-15 Oct 2025) and has no unit column; values are consistent with GHS per kg.",
        "There is no HDX groundnut series; groundnut prices come only from MoFA SRID 2025 (Techiman).",
        f"Outliers excluded: a WFP/HDX observation more than 3x the median of its neighbours (6 observations before and 6 after, same series) is left out of charts and seasonal stats (raw CSV unchanged; each excluded row is listed under 'excluded'). {excluded_total} rows excluded, e.g. Ejura cassava 91 kg wholesale Apr-Jun 2023 (GHS 2,034 / 2,034 / 2,025 vs a usual GHS 400-800).",
    ],
    "srid_source": old.get("srid_source", {"name": "MoFA SRID Agricultural Commodity Prices", "url": "https://srid.mofa.gov.gh/node/18"}),
    "source": {"name": SOURCE, "url": SOURCE_URL},
    "index_years": list(INDEX_YEARS),
    "markets": [markets[m] for m in used],
    "crops": crops,
}
json.dump(out_json, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(used), "markets:", ", ".join(used))
for cid, c in sorted(crops.items()):
    print(f"{cid:11s} series={len(c['series']):3d} markets={len(c.get('markets', [])):2d} compare={c.get('compare')} srid={len(c['srid2025'])} quotes={len(c['other_quotes'])}")
print("excluded", excluded_total, "size", os.path.getsize(OUT))
