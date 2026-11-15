#!/usr/bin/env python3
"""Build scripts/data/prices-world.json from OCHA's Humanitarian API (HDX HAPI) market prices.

Why this file exists: Walo's Ghana prices come from MoFA SRID plus the Ghana Commodity Exchange,
because WFP's Ghana series stops in July 2023. Every other country has no such source, but HAPI
republishes WFP market prices for a single schema across countries: market, coordinates, commodity,
currency, the unit the market actually sells in, retail or wholesale, and a monthly reference
period. One endpoint therefore replaces one bespoke file per country.

Usage:
    python3 build_hapi_prices.py --email you@example.org [--months 13] [--countries NGA,KEN]

HAPI wants an app_identifier on every call. It is NOT a secret: HAPI's own
/api/v2/encode_app_identifier returns base64("<app name>:<email>"), and that is all it is. Pass the
email you want HAPI's usage logs to show, or set HAPI_APP_IDENTIFIER to a ready-made identifier.
Never commit a token.

What it writes (scripts/data/prices-world.json), per country, in the country's own currency:
    markets: "Market (Admin1)" -> {lat, lon}
    crops:   crop id -> {label, mk: {"Market (Admin1)": {r|w: {v, d, unit, price, flag}}}}
`v` is the price per kilogram, converted from the unit the market publishes ("2.5 KG", "400 G",
"100 KG", "MT"). A market that sells by the litre, bunch, piece or tuber is left out rather than
converted, because those are not masses. Where the same market reports both retail and wholesale,
both are kept under `r` and `w`.

Nothing here is loaded by the app yet: a country only appears in Walo when countries.json marks it
live, and that needs its planting windows sourced. This file is the price half of that.
"""
import argparse, base64, collections, datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "prices-world.json")
BASE = "https://hapi.humdata.org/api/v2/food-security-nutrition-poverty/food-prices-market-monitor"

AFRICA = ("DZA AGO BEN BWA BFA BDI CPV CMR CAF TCD COM COG COD CIV DJI EGY GNQ ERI SWZ ETH GAB GMB "
          "GHA GIN GNB KEN LSO LBR LBY MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA RWA STP SEN SYC SLE "
          "SOM ZAF SSD SDN TZA TGO TUN UGA ZMB ZWE").split()

# HAPI / WFP commodity -> our crop id. Matched after lowercasing and dropping a bracketed qualifier,
# so "Maize (white)" and "Maize (white, dry)" both land on maize. Anything that is a processed form of
# the crop (flour, meal, gari, bread, oil) is not the crop a farmer sells, so those are refused below.
CROPS = {
    "maize": "maize", "rice": "rice", "sorghum": "sorghum", "millet": "millet",
    "groundnut": "groundnut", "groundnuts": "groundnut", "groundnut (shelled)": "groundnut",
    "soya bean": "soybean", "soya beans": "soybean", "soybean": "soybean", "soybeans": "soybean",
    "cassava": "cassava", "yam": "yam", "plantain": "plantain", "cocoyam": "cocoyam",
    "cocoa": "cocoa", "cocoa (beans)": "cocoa", "cashew nut": "cashew", "cashew nuts": "cashew",
    "tomato": "tomato", "tomatoes": "tomato", "onion": "onion", "onions": "onion",
    "pepper": "pepper", "peppers": "pepper", "okra": "okra",
    "sweet potato": "sweet_potato", "sweet potatoes": "sweet_potato",
    "cowpeas": "cowpea", "cowpea": "cowpea", "beans (niebe)": "cowpea", "beans (niebe, white)": "cowpea",
    "beans (niebe, red)": "cowpea", "niebe": "cowpea",
}
# never the crop itself: flour, meal, gari, bread, oil, roasted/fresh cobs, seed, and generic "beans"
REFUSE = ("flour", "meal", "gari", "bread", "oil", "roasted", "green", "fresh maize", "seed", "chips",
          "starch", "dough", "boiled", "cooked")
GENERIC_BEANS = {"beans", "beans (dry)", "beans (red)", "beans (white)", "beans (sugar)", "beans (sugar-red)",
                 "beans (kidney)", "beans (fava)", "beans (fava, dry)", "beans (fava, egyptian)",
                 "beans (haricot, red)", "beans (haricot, white)"}

MASS = {"KG": 1.0, "KGS": 1.0, "G": 0.001, "GR": 0.001, "GRAM": 0.001, "GRAMS": 0.001, "MT": 1000.0, "T": 1000.0}


def crop_of(name):
    raw = " ".join((name or "").lower().split())
    if raw in GENERIC_BEANS:
        return None  # "Beans" in one country is cowpea, in another it is a dry bean we do not model
    if raw in CROPS:
        return CROPS[raw]
    base = raw.split("(")[0].strip()
    if raw in CROPS or base in CROPS:
        if any(w in raw for w in REFUSE):
            return None
        return CROPS.get(raw) or CROPS.get(base)
    return None


def kg_of(unit):
    """The mass one published unit stands for, or None when the market does not sell by mass."""
    u = " ".join((unit or "").upper().split())
    if not u:
        return None
    parts = u.replace("KGS", "KG").split()
    if len(parts) == 1:
        return MASS.get(parts[0])
    try:
        n = float(parts[0])
    except ValueError:
        return None
    m = MASS.get(parts[1]) if len(parts) > 1 else None
    return n * m if m else None


def identifier(app, email):
    env = os.environ.get("HAPI_APP_IDENTIFIER")
    if env:
        return env.strip()
    if not email:
        sys.exit("need --email (HAPI attributes calls to an app name and email) or HAPI_APP_IDENTIFIER")
    return base64.b64encode(f"{app}:{email}".encode()).decode()


def fetch(app_id, params, tries=5):
    url = BASE + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"X-HDX-HAPI-APP-IDENTIFIER": app_id})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r).get("data", [])
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504):
                time.sleep(10 * (i + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (i + 1))
    return []


def country_rows(app_id, cc, start, end, limit=10000, max_pages=6):
    rows, offset = [], 0
    for _ in range(max_pages):
        page = fetch(app_id, {"location_code": cc, "start_date": start, "end_date": end,
                              "limit": limit, "offset": offset})
        rows += page
        if len(page) < limit:
            break
        offset += limit
        time.sleep(1.2)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", help="email HAPI should attribute Walo's calls to")
    ap.add_argument("--app", default="Walo", help="application name for the HAPI identifier")
    ap.add_argument("--months", type=int, default=13, help="how far back to keep prices")
    ap.add_argument("--countries", help="comma-separated ISO3 codes (default: every African country)")
    ap.add_argument("--app-country", help="also write the app's price file for this ISO3 code")
    ap.add_argument("--app-code", help="the two-letter id countries.json uses for --app-country, e.g. KE")
    args = ap.parse_args()

    app_id = identifier(args.app, args.email)
    today = datetime.date.today()
    start = (today - datetime.timedelta(days=args.months * 31)).isoformat()
    end = today.isoformat()
    codes = [c.strip().upper() for c in args.countries.split(",")] if args.countries else AFRICA

    out = {"source": {"name": "HDX HAPI, food prices market monitor (WFP market data)",
                      "url": "https://hapi.humdata.org/docs",
                      "dataset": "food-security-nutrition-poverty/food-prices-market-monitor"},
           "fetched": end, "window": [start, end],
           "about": ("WFP market prices republished by OCHA's Humanitarian API, one schema across "
                     "countries. Values are converted to the price per kilogram from the unit the "
                     "market publishes; markets that sell by the litre, bunch, piece or tuber are "
                     "left out because those are not masses. Crops are matched by name, and "
                     "processed forms (flour, meal, gari, oil) are never treated as the crop. A "
                     "country with no rows in the window is absent rather than carried forward."),
           "countries": {}}
    kept = collections.Counter()

    for i, cc in enumerate(codes, 1):
        rows = country_rows(app_id, cc, start, end)
        time.sleep(1.2)
        name, currency = None, None
        markets, crops = {}, {}
        for r in rows:
            cid = crop_of(r.get("commodity_name"))
            if not cid:
                continue
            kg = kg_of(r.get("unit"))
            if not kg:
                continue
            try:
                per_kg = float(r["price"]) / kg
            except (TypeError, ValueError, ZeroDivisionError):
                continue
            if not (0.001 < per_kg < 1e6):
                continue
            day = (r.get("reference_period_end") or "")[:10]
            if not day:
                continue
            name = r.get("location_name") or name
            currency = r.get("currency_code") or currency
            # HAPI's market name sometimes already ends with its county: "Eldoret town (Uasin Gishu)"
            mn = " ".join((r.get("market_name") or "").split())
            a1 = " ".join((r.get("admin1_name") or "").split())
            mk = mn if not a1 or f"({a1})" in mn else f"{mn} ({a1})"
            markets[mk] = {"lat": round(r["lat"], 4), "lon": round(r["lon"], 4)} if r.get("lat") is not None and r.get("lon") is not None else {}
            ent = crops.setdefault(cid, {"label": r.get("commodity_name"), "mk": {}})
            slot = ent["mk"].setdefault(mk, {})
            kind = "w" if (r.get("price_type") or "").lower().startswith("whole") else "r"
            cur = slot.get(kind)
            if cur and cur["d"] > day:
                continue  # a newer price for this market and type is already kept
            slot[kind] = {"v": round(per_kg, 2), "d": day, "unit": r.get("unit"),
                          "price": r.get("price"), "flag": r.get("price_flag")}
        if crops and markets:
            out["countries"][cc] = {"name": name, "currency": currency,
                                    "markets": dict(sorted(markets.items())),
                                    "crops": {c: {"label": v["label"], "mk": dict(sorted(v["mk"].items()))}
                                              for c, v in sorted(crops.items())}}
            kept[cc] = sum(len(v["mk"]) for v in crops.values())
            print(f"[{i:2d}/{len(codes)}] {cc} {name}: {len(crops)} crops, {len(markets)} markets, {kept[cc]} market-crop rows")
        else:
            print(f"[{i:2d}/{len(codes)}] {cc}: no usable rows")

    out["covered"] = sorted(out["countries"])
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {OUT}: {len(out['countries'])} countries, {sum(kept.values())} market-crop rows, {start}..{end}")

    if args.app_country:
        cc = args.app_country.upper()
        c = out["countries"].get(cc)
        if not c:
            sys.exit(f"{cc} has no usable rows in {start}..{end}; nothing written for the app")
        # the shape js/data.js priceNear reads: markets with coordinates, crops with r/w entries per market
        app_out = {"source": {"name": "WFP market prices via OCHA's HDX HAPI", "url": "https://hapi.humdata.org/docs"},
                   "fetched": end, "covered": [start, end], "unit": f"{c['currency']} per kg",
                   "about": ("WFP market prices republished by OCHA's Humanitarian API, converted to the price "
                             "per kilogram from the unit each market publishes. Markets selling by the litre, "
                             "bunch, piece or tuber are left out, and processed forms such as flour and meal "
                             "are never treated as the crop."),
                   "markets": {k: {"region": v.get("region", ""), "lat": v["lat"], "lon": v["lon"]}
                               for k, v in c["markets"].items() if v.get("lat") is not None},
                   "crops": c["crops"]}
        code = (args.app_code or cc[:2]).lower()
        path = os.path.join(HERE, "..", "data", f"prices-{code}.json")
        json.dump(app_out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"wrote {path}: {len(app_out['markets'])} markets, {len(app_out['crops'])} crops")


if __name__ == "__main__":
    main()
