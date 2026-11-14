"""v8: add FAO Rain forest (F) and Coastal savanna (C) zones for the 17 bundled places.
Run after build_crops.py and fix_crops_v7.py. Re-runnable.
Sources: FAO Crop Calendar by_zone entries in walo-crops.json (dates where FAO has them; zone-only where FAO
lists the zone without dates) + FAO AEZ region text (crops named for each zone)."""
import json, os, sys, copy
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import re
MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
def months(rng):  # same parser as build_crops.py (importing it would re-run the build)
    m = re.findall(r"(\d+)\s+([A-Z][a-z]{2})", rng)
    if len(m) != 2: return []
    a, b = MON[m[0][1]], MON[m[1][1]]
    out, x = [], a
    while True:
        out.append(x)
        if x == b: break
        x = x % 12 + 1
    return out
P = os.path.join(HERE, "scripts", "data", "crops_full.json")
KB = os.path.join(os.path.dirname(HERE), "walo-crops.json")
d = json.load(open(P))
kb = {c["id"]: c for c in json.load(open(KB))["crops"]}
C = {c["id"]: c for c in d["crops"]}
d["zones"] = {"F": "Rain forest zone", "T": "Transitional zone", "G": "Guinea savanna zone", "C": "Coastal savanna zone"}
places = json.load(open(os.path.join(HERE, "data", "places.json")))["places"]
for pid, p in places.items():
    d["location_zone"][pid] = p["zone"]
AEZ_TEXT = {"F": {"cocoa", "cassava", "plantain", "cocoyam"},
            "G": {"rice", "millet", "sorghum", "yam", "maize", "groundnut"}}
for cid, c in C.items():
    bz = kb.get(cid, {}).get("planting_windows", {}).get("fao_calendar", {}).get("by_zone", {}) if cid in kb else {}
    for z in ("F", "C"):
        c["zones"].pop(z, None); c["windows"].pop(z, None)
        e = bz.get(d["zones"][z])
        if isinstance(e, list) and e:
            c["zones"][z] = "FAO crop calendar lists this zone"
            c["windows"][z] = [{"label": s.get("label") if s.get("label") and not s["label"].lower().startswith("rain") else None,
                                "sow_text": s["sowing"], "harvest_text": s["harvest"],
                                "sow": months(s["sowing"]), "harvest": months(s["harvest"]),
                                "all_year": bool(s.get("all_year")), "days": s.get("growing_period_days"),
                                "src": "FAO Ghana crop calendar", "best": False} for s in e]
        elif isinstance(e, str):
            c["zones"][z] = "FAO crop calendar lists this zone (no dates)"
        if cid in AEZ_TEXT.get(z, ()) and z not in c["zones"]:
            c["zones"][z] = "FAO names this crop for the zone (zone description)"
    # plantain: IITA rule is West-Africa-wide; reuse for forest as best guess
    if cid == "plantain" and "F" in c["zones"]:
        w = copy.deepcopy(c["windows"]["T"][0]); w["best"] = True
        w["src"] = "IITA plantain manual rule (West Africa), applied to the forest's major season"
        c["windows"]["F"] = [w]
    # zone confidence for places without a team rating
    cz = {}
    lv = {"High": 3, "Medium": 2, "Low": 1}
    inv = {3: "High", 2: "Medium", 1: "Low"}
    cf = c.get("confidence", {})
    if "T" in c["zones"]:
        cz["T"] = inv[max(lv.get(cf.get("ejura"), 1), lv.get(cf.get("techiman"), 1))]
    if "G" in c["zones"]:
        cz["G"] = cf.get("tamale", "Low")
    for z in ("F", "C"):
        if z in c["zones"]:
            cz[z] = "Medium" if any(not w.get("best") for w in c["windows"].get(z, [])) else "Low"
        if cid in AEZ_TEXT.get(z, ()) and cz.get(z) == "Low":
            cz[z] = "Medium"  # FAO's zone description names this crop for the zone
    c["confidence_zone"] = cz
d["ranking"]["confidence_rule"] = ("Ejura, Techiman and Tamale use the team's per-crop rating. Other places: Transitional → the higher of "
    "Ejura/Techiman; Guinea savanna → Tamale; Rain forest / Coastal savanna → Medium if FAO gives dated windows for that zone, else Low; at least Medium where FAO's zone description names the crop. "
    "Places outside FAO's zone text (Dambai) are ranked on NASA climate only and marked Best guess.")
json.dump(d, open(P, "w"), ensure_ascii=False, indent=1)
for cid, c in C.items():
    print(cid, {z: (len(c["windows"].get(z, [])), c["confidence_zone"].get(z)) for z in c["zones"]})
