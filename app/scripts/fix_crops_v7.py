"""v7 data fixes on top of build_crops.py output (data/crops.json). Re-runnable (idempotent).

Each change is sourced; window 'src' says where it comes from, 'best': True keeps the Best-guess label.
"""
import json, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(HERE, "scripts", "data", "crops_full.json")
d = json.load(open(P))
C = {c["id"]: c for c in d["crops"]}

NEW_SOURCES = {
    "FAO_CWR": {"title": "FAO Irrigation Water Management Training Manual No. 3 (Brouwer & Heibloem, 1986), Ch. 2, Table 2: approximate seasonal crop water needs (sorghum/millet 450–650 mm per growing period)", "publisher": "FAO", "url": "https://www.fao.org/4/u3160e/u3160e04.htm"},
    "FAO_LW_SORGHUM": {"title": "FAO Land & Water, Crop information: Sorghum (water requirement of a 110–130-day crop 450–650 mm)", "publisher": "FAO", "url": "https://www.fao.org/land-water/databases-and-software/crop-information/sorghum/en/"},
    "ANSAH_2023": {"title": "Ansah, Appiah-Twumasi & Tsiboe (2023). Starchy staples production shortfalls in Ghana: technical inefficiency effects outweigh technological differences across ecologies. PLOS ONE 18(4): e0284780 (cocoyam grown largely in the Transition and Forest zones)", "publisher": "PLOS ONE", "url": "https://doi.org/10.1371/journal.pone.0284780"},
    "BANGOR_SARI_MILLET": {"title": "Transplanting sorghum and pearl millet in Ghana, project final update (on-station trials at CSIR-SARI Manga, Upper East; farmers' normal sowing of early millet 2 June)", "publisher": "Bangor University / CSIR-SARI / MoFA", "url": "http://transplanting.bangor.ac.uk/ghanafinalupdate.PDF"},
    "GNA_SARI_MILLET_WA": {"title": "Farmers in Upper West Region evaluate millet genotypes in Wa (SARI/ICRISAT trial sown 17 and 24 July)", "publisher": "Ghana News Agency via ModernGhana", "url": "https://www.modernghana.com/news/245333/farmers-in-upper-west-region-evaluate-millet-genotypes-in-wa.html"},
    "IITA_PLANTAIN": {"title": "Swennen (1990). Plantain cultivation under West African conditions: a reference manual (plant through the rainy season but not in its last months; bunches 9–12 months after planting)", "publisher": "IITA", "url": "https://www.iita.org/wp-content/uploads/2016/05/Plantain-cultivation-under-West-African-conditions-a-reference-manual.pdf"},
    "MADE_VEG_2015": {"title": "Vegetables Market Diagnostics (tomato, garden egg, okra, watermelon): rain-fed garden egg and okra production March–September in the south incl. Brong Ahafo", "publisher": "DFID Market Development in Northern Ghana (MADE), 2015", "url": "https://ghana-made.org/wp-content/uploads/2015/11/Vegetables-Market-Dignostics.pdf"},
    "KUGBE_OKRA_2019": {"title": "Kugbe, Salifu & Sam (2019). Growth and yield of okra as affected by planting date and weeding regime in Northern Ghana. Journal of Agriculture and Crops 5(4): 43–47 (sown 17 Jun–15 Jul; planting date had no significant effect on yield)", "publisher": "Academic Research Publishing Group", "url": "https://doi.org/10.32861/jac.54.43.47"},
    "IFPRI_CHILI_2021": {"title": "Vigneri, Kolavalli, Agandin & Moyo (2021). Production and marketing of chili in the Brong-Ahafo area of Ghana. GSSP Working Paper 55 (71% plant in the major season, April–July)", "publisher": "IFPRI", "url": "https://cgspace.cgiar.org/server/api/core/bitstreams/3046b564-967f-422a-9035-a855464cfe8d/content"},
    "MOFA_IFPRI_CHILI_2020": {"title": "Ghana's chili market. MoFA-IFPRI Market Brief No. 4, April 2020 (rain-fed chili production May–November)", "publisher": "MoFA / IFPRI", "url": "https://cgspace.cgiar.org/server/api/core/bitstreams/7fae63ba-edb7-4100-9cb1-854f6277d81f/content"},
}
d["sources"].update(NEW_SOURCES)

def addsrc(c, *ids):
    for i in ids:
        if i not in c["sources"]:
            c["sources"].append(i)

def win(sow, harvest, sow_text, harvest_text, src, label=None, best=False, **kw):
    return dict(label=label, sow_text=sow_text, harvest_text=harvest_text, sow=sow, harvest=harvest, all_year=False, src=src, best=best, **kw)

# (1) Sorghum: Ghana rainfall instead of EcoCrop's 700 mm cap
s = C["sorghum"]
s["rain_gh"] = {"abs_min": 300, "opt_min": 750, "opt_max": 1300, "abs_max": None,
                "text": "FAO's Ghana crop calendar grows sorghum in zones with 750–1,000 mm (Guinea savanna) and 1,000–1,300 mm (Transitional) of rain a year; FAO puts its water need at 450–650 mm per season.",
                "sources": ["FAO_CROPCAL", "FAO_CWR", "FAO_LW_SORGHUM"]}
s["facts"] = [f for f in s["facts"] if f.get("label") != "Rain in Ghana"] + [{"label": "Rain in Ghana", "value": s["rain_gh"]["text"], "sources": s["rain_gh"]["sources"]}]
addsrc(s, "FAO_CWR", "FAO_LW_SORGHUM")

# (2) Cocoyam: Transition zone (Ansah et al. 2023); window borrowed from FAO Rain forest zone (best guess)
c = C["cocoyam"]
c["zones"] = {"T": "Grown largely in the Transition and Forest zones (Ansah et al. 2023)"}
c["windows"] = {"T": [win([4, 5, 6], [11, 12], "1 Apr – 30 Jun", "10 Nov – 20 Dec", "FAO calendar for the Rain forest zone next door (no Transitional entry)", best=True, borrowed="Rain forest zone", days="210 - 280")]}
c["window_notes"]["T"] = ["Cocoyam is grown largely in Ghana's Transition and Forest zones. [ANSAH_2023]", "FAO has no Transitional-zone entry; Walo uses FAO's Rain forest window (sow 1 Apr – 30 Jun, harvest 10 Nov – 20 Dec) as a best guess. [FAO_CROPCAL]"]
c["confidence"].update({"ejura": "Medium", "techiman": "Medium"})
addsrc(c, "ANSAH_2023")

# (3) Planting windows
m = C["millet"]
m["windows"] = {"G": [win([6, 7], [8, 9, 10], "early Jun – late Jul", "Aug – Oct", "CSIR-SARI trials and farmers' sowing dates, northern Ghana")]}
m["window_notes"]["G"] = ["Farmers' normal sowing of early millet: 2 June (Upper East, SARI Manga station). [BANGOR_SARI_MILLET]", "SARI/ICRISAT millet trials in Wa sown 17 and 24 July. [GNA_SARI_MILLET_WA]", "Early millet matures in 65–70 days. [MILLET_AJPS_2021]"]
addsrc(m, "BANGOR_SARI_MILLET", "GNA_SARI_MILLET_WA")

p = C["plantain"]
p["windows"] = {"T": [win([4, 5, 6], [1, 2, 3, 4, 5, 6], "Apr – Jun", "Jan – Jun (next year)", "IITA plantain manual rule (plant in the rains, not the last months) with the major season start")]}
p["window_notes"]["T"] = ["Plant through the rainy season but not in its last months; mid-season planting gives off-season bunches and better prices. [IITA_PLANTAIN]", "Bunches come 9–12 months after planting. [IITA_PLANTAIN]"] + [n for n in p["window_notes"].get("T", []) if "PLANTAIN_GH_2007" in n]
p["days_typical"] = 300
p["days_text"] = "Bunches 9–12 months after planting (IITA manual)."
addsrc(p, "IITA_PLANTAIN")

o = C["okra"]
o["zones"]["G"] = "Field trials in northern Ghana (Kugbe et al. 2019)"
o["windows"] = {"T": [win([3, 4, 5, 6, 7], [5, 6, 7, 8, 9], "Mar – Jul", "May – Sep", "MADE vegetable market study: rain-fed okra March–September in the south")],
                "G": [win([6, 7], [8, 9], "mid Jun – mid Jul", "Aug – Sep", "Field trial, northern Ghana (Kugbe et al. 2019)")]}
o["window_notes"]["T"] = ["Rain-fed okra production runs March–September in the south. [MADE_VEG_2015]", "FAO lists okra all year in the Rain forest zone with irrigation. [FAO_CROPCAL]"]
o["window_notes"]["G"] = ["Trial sowings 17 June, 1 July and 15 July (2013, 2015); planting date did not change yield significantly. [KUGBE_OKRA_2019]"]
addsrc(o, "MADE_VEG_2015", "KUGBE_OKRA_2019")

pe = C["pepper"]
pe["windows"] = {"T": [win([4, 5, 6, 7], [8, 9, 10, 11], "Apr – Jul", "Aug – Nov", "Brong-Ahafo chili survey (IFPRI 2021) and MoFA-IFPRI chili brief", label="Major season")]}
pe["window_notes"]["T"] = ["71% of Brong-Ahafo chili farmers plant in the major season (April–July); major-season plantings yielded more. Some plant in the minor season (August–November). [IFPRI_CHILI_2021]", "Rain-fed chili production runs May–November. [MOFA_IFPRI_CHILI_2020]"]
addsrc(pe, "IFPRI_CHILI_2021", "MOFA_IFPRI_CHILI_2020")

g = C["garden_egg"]
g["windows"] = {"T": [win([3, 4, 5, 6], [6, 7, 8, 9], "Mar – Jun", "Jun – Sep", "MADE vegetable market study: rain-fed garden egg March–September incl. Brong Ahafo")]}
g["window_notes"]["T"] = ["Rain-fed garden egg production runs March–September in Central, Greater Accra, Brong Ahafo, Eastern and Volta. [MADE_VEG_2015]"] + g["window_notes"].get("T", [])
addsrc(g, "MADE_VEG_2015")

# (4) Onion: keep FAO sowing; harvest worked out from MoFA durations (FAO harvest date dropped as inconsistent)
on = C["onion"]
on["windows"] = {"T": [win([8, 9, 10, 11], [12, 1, 2, 3], "10 Aug – 10 Nov", "Dec – Mar", "FAO sowing dates; harvest worked out from MoFA durations", days="110 - 135")]}
on["window_notes"]["T"] = ["FAO calendar: sow 10 Aug – 10 Nov; best grown in the dry season. [FAO_CROPCAL]", "Harvest worked out by Walo: about 4 weeks in the nursery plus 80–105 days after transplanting [MOFA_ONION] gives December–March. FAO's own harvest date (30 Sep – 10 Oct) comes before its sowing ends, so Walo does not use it."]
on["days_typical"] = 120
on["days_text"] = "About 4 weeks nursery + 80–105 days after transplanting (MoFA)."

# Mark FAO windows that came from build_crops.py
for cr in d["crops"]:
    for z, ws in cr["windows"].items():
        for w in ws:
            w.setdefault("src", "FAO Ghana crop calendar")
            w.setdefault("best", False)

d["ranking"]["rules"] = [
    "Rain: yearly rain inside the crop's ideal range +2; inside its possible range +1; outside 0. Ranges from EcoCrop (global), or a Ghana figure where EcoCrop disagrees with Ghana practice (sorghum)",
    "Temperature: yearly average temperature inside the EcoCrop ideal range +1; hottest month's average daily high above the crop's EcoCrop maximum −1",
    "Season: seasonal crops whose shortest growing time fits inside the run of wet months +1",
    "Calendar: a sourced Ghana planting calendar for this zone (FAO or a Ghana study) +1; borrowed or best-guess windows do not count",
]
json.dump(d, open(P, "w"), ensure_ascii=False, indent=1)
print("ok", len(d["sources"]), "sources")
