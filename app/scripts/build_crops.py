"""Build data/crops.json (app crop system) from walo-crops.json (team crop knowledge base).

Every value shown in the app comes from walo-crops.json with its source ids; 'not confirmed' stays 'not confirmed'.
Also extends data/market.json with the extra crops that have WFP/HDX or MoFA SRID price rows.
Run: python3 scripts/build_crops.py  (paths via env WALO_CROPS, WALO_APP)
"""
import json, os, re, sys
APP = os.environ.get("WALO_APP", "/workspace/walo-app")
SRC = os.environ.get("WALO_CROPS", "/workspace/walo-crops.json")
PICKED = "/workspace/img-src/v5/picked.json"
K = json.load(open(SRC))
OLD = {c["id"]: c for c in json.load(open(f"{APP}/scripts/crops_v4_base.json"))["crops"] if "stages" in c and c.get("rules")}
MON = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
ZONES = {"T": "Transitional zone", "G": "Guinea savanna zone"}
LOCZONE = {"ejura": "T", "techiman": "T", "tamale": "G"}
TREE = {"cocoa", "cashew"}
EXCLUDE = {"shea": "Wild parkland tree: not a planting recommendation (walo-crops.json confidence: low)."}
# zone membership added by hand only where the file's own text names the region (cited)
ZONE_EXTRA = {"cocoa": {"T": "COCOBOD manual lists Ashanti and Brong-Ahafo among cocoa regions"}}
PHOTO_POS = {"cocoyam": "50% 50%", "cocoa": "50% 50%"}

def months(rng):
    m = re.findall(r"(\d+)\s+([A-Z][a-z]{2})", rng)
    if len(m) != 2: return []
    a, b = MON[m[0][1]], MON[m[1][1]]
    out, x = [], a
    while True:
        out.append(x)
        if x == b: break
        x = x % 12 + 1
    return out

def level(conf, loc):
    """Per-location High/Medium/Low from strings like 'high (Tamale) / low (Ejura, Techiman)'."""
    segs = [s.strip() for s in conf.split("/")]
    parsed = []
    for s in segs:
        m = re.match(r"(high|medium|low(?:-medium)?)\s*(?:\((.*)\))?\s*(.*)", s, re.I)
        if not m: continue
        lv = {"high": "High", "medium": "Medium", "low": "Low", "low-medium": "Low"}[m.group(1).lower()]
        q = ((m.group(2) or "") + " " + (m.group(3) or "")).lower()
        locs = set()
        if "tamale" in q or "north" in q: locs.add("tamale")
        if "ejura" in q: locs.add("ejura")
        if "techiman" in q: locs.add("techiman")
        if "transition" in q: locs |= {"ejura", "techiman"}
        parsed.append((lv, locs, "elsewhere" in q))
    for lv, locs, _ in parsed:
        if loc in locs: return lv
    for lv, locs, els in parsed:
        if els: return lv
    if len(parsed) == 1 and not parsed[0][1]: return parsed[0][0]
    order = ["Low", "Medium", "High"]
    return min((p[0] for p in parsed), key=order.index) if parsed else "Low"

def nc(field):
    v = field.get("value") if isinstance(field, dict) else field
    return v in (None, "", "not confirmed") or str(v).startswith("not confirmed")

def days_typical(c):
    v = c["days_to_maturity"].get("value", "")
    if nc(c["days_to_maturity"]): return None
    m = re.search(r"(\d+)\s*[--]\s*(\d+)\s*d", v)
    return round((int(m.group(1)) + int(m.group(2))) / 2) if m else None

def zones_of(c):
    fao = c["planting_windows"].get("fao_calendar", {}).get("by_zone", {})
    pw = " ".join(k for k in c["planting_windows"] if k != "fao_calendar")
    z = {}
    for k, name in ZONES.items():
        if name in fao: z[k] = "FAO crop calendar lists this zone"
    if re.search(r"transition", pw): z.setdefault("T", "Ghana planting guidance for the transition zone")
    if re.search(r"north|guinea", pw): z.setdefault("G", "Ghana planting guidance for the north / Guinea savanna")
    if re.search(r"all (agro-)?ecological zones|all regions", c["zones_ghana"].get("value", ""), re.I):
        z.setdefault("T", "grown in all zones of Ghana"); z.setdefault("G", "grown in all zones of Ghana")
    for k, why in ZONE_EXTRA.get(c["id"], {}).items(): z.setdefault(k, why)
    return z

def windows(c):
    fao = c["planting_windows"].get("fao_calendar", {})
    out = {}
    for k, name in ZONES.items():
        e = fao.get("by_zone", {}).get(name)
        if isinstance(e, list) and e:
            out[k] = [{"label": s.get("label") if s.get("label") and not s["label"].lower().startswith("rain") else None,
                       "sow_text": s["sowing"], "harvest_text": s["harvest"],
                       "sow": months(s["sowing"]), "harvest": months(s["harvest"]),
                       "all_year": s["sowing"].startswith("1 Jan - 31 Dec"),
                       "days": s.get("growing_period_days")} for s in e]
    return out

def notes(c):
    """Sourced planting-window text per zone (MoFA/APNI/etc.), shown under Why."""
    res = {"T": [], "G": []}
    for k, v in c["planting_windows"].items():
        if k == "fao_calendar" or not isinstance(v, dict) or nc(v): continue
        t = f"{v['value']} [{', '.join(v.get('sources', []))}]"
        if re.search(r"transition|forest", k): res["T"].append(t)
        if re.search(r"north|guinea", k): res["G"].append(t)
        if k in ("note", "west_africa_general"): res["T"].append(t); res["G"].append(t)
    return res

FACTS = [("days_to_maturity", "Days to harvest"), ("rainfall", "Rain needs"), ("temperature", "Temperature"),
         ("heat_stress", "Heat stress"), ("drought_tolerance", "Drought"), ("soil", "Soil"),
         ("pests_diseases", "Pests & diseases"), ("yields_ghana", "Yields in Ghana")]
picked = json.load(open(PICKED))
crops = []
for c in K["crops"]:
    cid = c["id"]
    if cid in EXCLUDE: continue
    old = OLD.get(cid, {})
    tw = c.get("twi", {})
    twi_ok = not nc(tw) and not re.search(r"not confirmed|not .*-specific", tw.get("note", "") or "", re.I)
    e = c.get("ecocrop") or {}
    dt = old.get("days_typical") or days_typical(c)
    kind = "tree" if cid in TREE else "seasonal"
    img = old.get("img") or f"img/{cid.replace('_', '-')}.webp"
    crop = {
        "id": cid, "name": c["english"].split(" (")[0], "scientific": c["scientific"], "kind": kind,
        "img": img, "pos": old.get("pos") or PHOTO_POS.get(cid, "50% 50%"),
        "twi": tw["value"] if twi_ok else None,
        "confidence_text": c["confidence"],
        "confidence": {l: level(c["confidence"], l) for l in LOCZONE},
        "zones": zones_of(c), "windows": windows(c), "window_notes": notes(c),
        "days_typical": dt if kind == "seasonal" else None,
        "days_text": c["days_to_maturity"]["value"],
        "eco": {"temp_c": e.get("temp_c"), "rain_mm_annual": e.get("rain_mm_annual"), "cycle_days": e.get("crop_cycle_days")} if e else None,
        "facts": [{"label": lab, "value": c[f].get("value", "not confirmed") if isinstance(c.get(f), dict) else "not confirmed",
                   "sources": c[f].get("sources", []) if isinstance(c.get(f), dict) else [], "note": c[f].get("note") if isinstance(c.get(f), dict) else None}
                  for f, lab in FACTS],
        "price_note": c.get("price_note"),
        "dry_harvest": old.get("dry_harvest", False), "heat_sensitive_stage": old.get("heat_sensitive_stage"),
        "stages": old.get("stages"),
    }
    if not crop["stages"] and kind == "seasonal" and dt:
        pests = next((f["value"] for f in crop["facts"] if f["label"] == "Pests & diseases" and not nc(f)), None)
        crop["stages"] = [
            {"at": 0, "name": "Plant", "action": "Plant when the soil is moist"},
            {"at": 0.12, "name": "Establishing", "action": "Fill gaps and weed early"},
            {"at": 0.4, "name": "Growing", "action": "Keep weeds down and scout the field" + (f" (watch for: {pests.split(';')[0].split('.')[0]})" if pests else "")},
            {"at": 1, "name": "Harvest", "action": "Harvest when mature"}]
        crop["stages_generic"] = True
    srcs = set()
    for f in crop["facts"]: srcs |= set(f["sources"])
    if crop["windows"]: srcs.add("FAO_CROPCAL")
    if e: srcs.add("ECOCROP")
    crop["sources"] = sorted(srcs)
    crops.append(crop)

# photos for new crops -> credits.json
cred = json.load(open(f"{APP}/data/credits.json"))
have = {i["id"] for i in cred["images"]}
for k, x in picked.items():
    cid = k.replace("_", "-")
    if cid in have: continue
    cred["images"].append({"id": cid, "file": f"img/{cid}.webp", "use": f"{k.replace('_', ' ').title()} crop photo",
        "title": x["title"].replace("File:", "").rsplit(".", 1)[0], "author": x["author"], "license": x["lic"],
        "license_url": x["license_url"], "source_url": x["page"], "changes": "Cropped/resized and converted to WebP for the app"})
json.dump(cred, open(f"{APP}/data/credits.json", "w"), indent=1, ensure_ascii=False)

out = {
    "note": "Built by scripts/build_crops.py from walo-crops.json (team crop knowledge base). Values keep their source ids; 'not confirmed' means no source was found. EcoCrop ranges are global, not Ghana-specific.",
    "generated_from": K["meta"].get("generated"),
    "zones": {k: v for k, v in ZONES.items()}, "location_zone": LOCZONE, "district_notes": K["meta"]["districts"],
    "excluded": [{"id": k, "why": v} for k, v in EXCLUDE.items()],
    "ranking": {
        "base": 1, "max": 5,
        "rules": [
            "Rain: yearly rain inside the crop's EcoCrop ideal range +2; inside its possible range +1; outside 0",
            "Temperature: yearly average temperature inside the EcoCrop ideal range +1; hottest month's average daily high above the crop's EcoCrop maximum −1",
            "Season: seasonal crops whose shortest growing time fits inside the run of wet months +1",
            "Calendar: FAO's Ghana crop calendar has a planting season for this zone +1",
        ]},
    "sources": K["sources"],
    "crops": crops,
}
json.dump(out, open(f"{APP}/scripts/data/crops_full.json", "w"), indent=1, ensure_ascii=False)

# ---- market: add extra crops using the same method as build_data.py ----
sys.path.insert(0, f"{APP}/scripts")
import build_data as bd
bd.CROP_MAP.update({"Yam": "yam", "Yam (puna)": "yam", "Yam (white)": "yam", "Sorghum": "sorghum", "Millet": "millet",
    "Rice (local)": "rice", "Rice (local, non-perfumed)": "rice", "Soybean": "soybean",
    "Plantain (apentu)": "plantain", "Plantain (apem)": "plantain", "Cocoyam": "cocoyam"})
ids = sorted(set(bd.CROP_MAP.values()))
_orig = bd.build_market
src = open(f"{APP}/scripts/build_data.py").read()
m = bd.build_market.__code__
# re-run build_market with the extended crop list
import types
code = src[src.index("def build_market"):src.index("# ---------------------------------------------------------------------------\n# 3.")]
code = code.replace('["maize", "cowpea", "groundnut", "cassava"]', repr(ids))
ns = dict(bd.__dict__); exec(code, ns)
mk = ns["build_market"]()
old_mk = json.load(open(f"{APP}/data/market.json"))
for c4 in ["maize", "cowpea", "groundnut", "cassava"]:
    assert json.dumps(mk["crops"][c4]["series"]) == json.dumps(old_mk["crops"][c4]["series"]), c4
for k, v in mk["crops"].items():
    if k not in old_mk["crops"]: old_mk["crops"][k] = v
json.dump(old_mk, open(f"{APP}/data/market.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("crops", len(crops), "market crops", list(old_mk["crops"]))
