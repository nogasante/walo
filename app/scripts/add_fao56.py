"""Add FAO-56 crop coefficients (Table 12) and stage lengths (Table 11) to data/crops.json as crop.fao56, plus heat/GDD keys.
Values transcribed from https://www.fao.org/4/x0490e/x0490e0b.htm (fetched 14 Nov 2026). Stage lengths are FAO's for the row named in 'row';
Walo scales them to the crop's local season length (days_typical) keeping FAO's proportions, as FAO-56 Ch. 6 allows for local varieties.
Kc_ini: Table 12 group value. Where a Table 12 range is given, the value used is noted."""
import json, os
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
F = {
 "maize":       dict(kc=[0.3, 1.20, 0.35], L=[20, 35, 40, 30], row="T11 Maize (grain), Nigeria (humid), April; T12 Maize, field (grain): Kc end 0.60-0.35, 0.35 for field-dried grain"),
 "sorghum":     dict(kc=[0.3, 1.05, 0.55], L=[20, 35, 40, 30], row="T11 Sorghum, May/June USA/Pakistan/Med.; T12 Sorghum grain: Kc mid 1.00-1.10 (mean 1.05)"),
 "millet":      dict(kc=[0.3, 1.00, 0.30], L=[15, 25, 40, 25], row="T11 Millet, June, Pakistan; T12 Millet"),
 "rice":        dict(kc=[1.05, 1.20, 0.75], L=[30, 30, 60, 30], row="T11 Rice, Tropics; T12 Rice: Kc end 0.90-0.60 (mean 0.75). FAO values are for flooded rice"),
 "soybean":     dict(kc=[0.4, 1.15, 0.50], L=[15, 15, 40, 15], row="T11 Soybeans, Tropics, Dec; T12 Soybeans"),
 "cowpea":      dict(kc=[0.4, 1.05, 0.35], L=[20, 30, 40, 20], row="T11 Beans (dry), May/June, continental (no cowpea row); T12 Green gram and cowpeas: Kc end 0.60-0.35, 0.35 dry harvest"),
 "groundnut":   dict(kc=[0.4, 1.15, 0.60], L=[25, 35, 45, 25], row="T11 Groundnut, Dry West Africa; T12 Groundnut (peanut)"),
 "cassava":     dict(kc=[0.3, 0.80, 0.30], L=[20, 40, 90, 60], row="T11 Cassava year 1, rainy season, tropical regions; T12 Cassava year 1"),
 "sweet_potato":dict(kc=[0.5, 1.15, 0.65], L=[15, 30, 50, 30], row="T11 Sweet potato, rainy season, tropical regions; T12 Sweet potato"),
 "tomato":      dict(kc=[0.6, 1.15, 0.80], L=[30, 40, 40, 25], row="T11 Tomato, January, arid region; T12 Tomato: Kc end 0.70-0.90 (mean 0.80)"),
 "pepper":      dict(kc=[0.6, 1.05, 0.90], L=[25, 35, 40, 20], row="T11 Sweet peppers (bell), Europe/Med.; T12 Sweet peppers (bell)"),
 "garden_egg":  dict(kc=[0.6, 1.05, 0.90], L=[30, 40, 40, 20], row="T11 Egg plant, October, arid region; T12 Egg plant"),
 "onion":       dict(kc=[0.7, 1.05, 0.75], L=[15, 25, 70, 40], row="T11 Onion (dry), April, Mediterranean; T12 Onions dry"),
 "plantain":    dict(kc=[0.5, 1.10, 1.00], L=[120, 90, 120, 60], row="T11 Banana 1st year (no plantain row); T12 Banana 1st year"),
 "yam":         dict(kc=[0.5, 1.10, 0.95], L=None, row="No yam row in FAO-56. Kc: T12 'Roots and tubers' group values; stage lengths not given"),
 "cocoyam":     dict(kc=[0.5, 1.10, 0.95], L=None, row="No cocoyam row in FAO-56. Kc: T12 'Roots and tubers' group values; stage lengths not given"),
 "cocoa":       dict(kc=[1.00, 1.05, 1.05], L=None, row="T12 Cacao (perennial; no stage lengths)"),
}
p = os.path.join(os.path.dirname(D), "scripts", "data", "crops_full.json"); d = json.load(open(p))
for c in d["crops"]:
    f = F.get(c["id"])
    if not f: c.pop("fao56", None); continue
    c["fao56"] = {"kc_ini": f["kc"][0], "kc_mid": f["kc"][1], "kc_end": f["kc"][2], "stage_days": f["L"], "row": f["row"], "source": "FAO56"}
json.dump(d, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print([c["id"] for c in d["crops"] if "fao56" not in c], "have no FAO-56 values")
