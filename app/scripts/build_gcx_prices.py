#!/usr/bin/env python3
"""Build data/exchange.json from the Ghana Commodity Exchange's public market data feed.

Why: MoFA SRID's public price CSV has not been refreshed since November 2025 (its page still says
"Last updated: 11/07/2025" and the file ends 31 October 2025), and WFP/HDX stopped at July 2023.
GCX still publishes its closing traded prices, and its feed is public.

Usage:
    python3 build_gcx_prices.py

Source: https://sserp-gcx-webservices-default-rtdb.firebaseio.com/<id>/marketdata.json (the feed
gcx.com.gh itself reads). Prices are GH₵ per metric tonne for a grade of the commodity, traded at a
named GCX warehouse, with the trade date.

Only warehouses whose code we could confirm against GCX's own published closing-price notices are
kept (Tamale GT, Kumasi GKU, Sandema GS). Anything else in the feed is ignored rather than guessed.
"""
import json, os, sys, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "exchange.json")
FEED = "https://sserp-gcx-webservices-default-rtdb.firebaseio.com/7fc5499a-eccb-4bab-aa52-6ac0269a9dc3/marketdata.json"

# warehouse code (start of the symbol) -> the town on our map, only the ones GCX's own notices confirm
WAREHOUSES = {
    "GT": ("Tamale", 9.4052, -0.8424),
    "GKU": ("Kumasi", 6.68, -1.62),
    "GS": ("Sandema", 10.7350, -1.5680),
}

# GCX commodity -> our crop id. Yellow maize is a different grade from the white maize people eat,
# so it is kept out; the app's "maize" line means white maize.
COMMODITIES = {
    "White Maize": ("maize", "White maize, Grade 2"),
    "Yellow Soya Bean": ("soybean", "Soya bean"),
    "White Soya Bean": ("soybean", "Soya bean"),
}


def date_of(s):
    try:
        return datetime.datetime.strptime(s, "%d-%b-%Y").date()
    except Exception:
        return None


def pick_warehouse(symbol):
    # longest code first: GKU before GK, GTU before GT
    for code in sorted(WAREHOUSES, key=len, reverse=True):
        if symbol.startswith(code):
            return code, WAREHOUSES[code]
    return None, None


def main():
    with urllib.request.urlopen(FEED, timeout=60) as r:
        data = json.load(r)
    prices = data["closing_prices"]["data"]
    crops, markets = {}, {}
    for symbol, row in prices.items():
        crop = COMMODITIES.get(row.get("Commodity"))
        day = date_of(row.get("LastTradeDate", ""))
        if not crop or not day:
            continue
        code, where = pick_warehouse(symbol)
        if not where:
            continue
        name, lat, lon = where
        try:
            per_kg = float(row["ClosingPrice"]) / 1000.0
        except (KeyError, TypeError, ValueError):
            continue
        if not (0.1 < per_kg < 200):  # a plausible GH₵/kg; drops the zero and junk rows
            continue
        cid, label = crop
        best = crops.setdefault(cid, {"label": label, "mk": {}})["mk"].get(name)
        if best and best["d"] >= day.isoformat():
            continue  # a newer trade is already stored for this crop and warehouse
        crops[cid]["mk"][name] = {"v": round(per_kg, 2), "d": day.isoformat(), "symbol": symbol}
        markets[name] = {"lat": lat, "lon": lon}

    out = {
        "source": {
            "name": "Ghana Commodity Exchange (GCX) closing traded prices",
            "url": "https://www.gcx.com.gh/market-data",
            "feed": FEED,
            "note": "Traded prices for a grade of the commodity at a GCX warehouse, GH₵ per metric tonne in the feed and per kilogram here. This is an exchange trade at a warehouse, not a retail market price.",
        },
        "fetched": datetime.date.today().isoformat(),
        "unit": "GH₵ per kg",
        "warehouses_confirmed": list(WAREHOUSES),
        "markets": markets,
        "crops": crops,
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}")
    for cid, c in crops.items():
        for name, v in sorted(c["mk"].items()):
            print(f"  {cid:9s} {name:10s} {v['v']:6.2f}/kg  {v['d']}  {v['symbol']}")


if __name__ == "__main__":
    sys.exit(main())
