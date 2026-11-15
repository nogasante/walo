# Build data/i18n-tw.json once: Walɔ's fixed English labels -> Twi with GhanaNLP Khaya, through our own /api/twi
# (run tools/walo_twi_serve.js locally, or point at the deployed site). Strings already in the file are kept, so a re-run only pays for new labels.
# Input: a JSON list of English labels (collected from the running app by tools/walo_i18n_collect.py).
# Town names and brand names stay as they are. Output is MACHINE-TRANSLATED and needs a Twi speaker's check.
import json, sys, urllib.request, os
SRC, API = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8813/api/twi")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "i18n-tw.json")
places = json.load(open(os.path.join(os.path.dirname(__file__), "..", "data", "places.json")))["places"].values()
KEEP = {p["name"] for p in places} | {"Walɔ", "NASA POWER", "NASA MODIS", "NASA data", "Meteomatics", "MoFA SRID", "GhanaNLP Khaya", "Microsoft Planetary Computer",
        "WFP Ghana food prices (HDX)", "Place names © OpenStreetMap contributors", "Twi", "Demo", "name@example.com", "power.larc.nasa.gov", ". Map: Natural Earth.", "Photos (Wikimedia Commons)"}
labels = [s for s in json.load(open(SRC)) if len(s) > 1]
old = json.load(open(OUT)).get("strings", {}) if os.path.exists(OUT) else {}
out = {s: old[s] for s in labels if s in old}
for s in labels:
    if s in KEEP: out[s] = s
todo = [s for s in labels if s not in out]
for i in range(0, len(todo), 40):
    part = todo[i:i + 40]
    req = urllib.request.Request(API + "?action=translate", data=json.dumps({"texts": part, "to": "tw"}).encode(), headers={"Content-Type": "application/json"})
    j = json.load(urllib.request.urlopen(req, timeout=120))
    for s, t in zip(part, j.get("out") or []):
        if t: out[s] = t
doc = {"_note": "MACHINE-TRANSLATED by GhanaNLP Khaya (en-tw), needs a Twi speaker's check. Built by scripts/build_i18n_tw.py. Keys are Walɔ's English labels.",
       "source": "GhanaNLP Khaya AI API, translation v2 en-tw", "reviewed_by_twi_speaker": False, "strings": dict(sorted(out.items()))}
json.dump(doc, open(OUT, "w"), indent=1, ensure_ascii=False)
print(len(labels), "labels,", len(todo), "sent,", len(out), "in file,", len(labels) - len(out), "missing")
