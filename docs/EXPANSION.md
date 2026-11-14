# Expanding Walo beyond Ghana

Status on **14 November 2026**. Ghana is the only country Walo runs in. The code no longer contains a
country, so what remains is data and review — not a rewrite. This file records exactly where the line
is, so nobody has to rediscover it.

## What already works anywhere

`app/lib/agro.js` is the reason this is feasible. FAO-56 reference evapotranspiration and the water
balance (WRSI), the Sivakumar (1988) onset rule, EcoCrop suitability and growing degree days are all
latitude-and-weather methods, not Ghanaian ones. NASA POWER covers every point in Africa on the same
~50 km grid the app already uses. The screen model (one answer, Why?, Listen, offline) is
culture-neutral too.

## What a country now owns

`app/data/countries.json`. Nothing below is in code any more:

| Field | What it decides | Ghana today |
| --- | --- | --- |
| `bbox` | Which coordinates the app and the two AI routes accept | lat −5..16, lon −10..6 |
| `currency` | The money on Sell | `GHS` |
| `onset.major_search` / `minor_search` | Where to look for each rainy season | 1 Mar–31 Jul, minor 15 Aug–31 Oct in zones F/T/C |
| `onset.hemisphere` | Recorded so a wrong window is a reviewable mistake | `north` |
| `zones` | Zone letters → names shown in Why? and About | F/T/G/C (FAO Ghana AEZ) |
| `map` | Which outline the crop map draws | `ghana-map` |
| `sources` | Labels on crop-calendar and price sources | FAO Ghana, WFP Ghana, MoFA SRID |
| `language` | Interface language for that country | `en` |
| `status` | `live` or `draft` — only `live` is selectable | `live` |
| `checked_by_local` | Whether someone who farms there has read it | `true` |

The server reads the same file through `app/api/_country.js`, so `/api/forecast` and
`/api/diagnose` accept exactly the countries the phone shows. Verified: a Ghana coordinate reaches
the handler, a Nairobi coordinate and a London coordinate are both refused with 400.

### The season windows are the important part

The old code searched for the major season from 1 March, which is right for Ghana and wrong for most
of the continent. In Zambia, Malawi and Tanzania the planting rains arrive **November–January**; the
app would not have crashed, it would have said *"Wait: rain not here yet"* in the middle of the
planting season. A confident wrong answer is the worst failure this app can produce.

Because the windows are now per country, that is a config entry, not a code change. `rules.json`
still holds the physical rule (≥ 1 mm day, ≥ 20 mm over 3 days, no dry run over 7 days in 30) with
its citation; the country holds when to look.

## What is still Ghana-only

Do not add a second country until each of these is addressed for it.

1. **Crop windows are keyed by Ghana's zones.** `data/crops.json` → `windows` uses `C/F/G/T` and
   `confidence` per Ghana zone. A new country needs its own zone vocabulary and its own windows,
   ideally fetched from FAO's per-country calendar API (the endpoint the pipeline already calls takes
   a country code: `/api/v1/countries/GH/aez` → `/api/v1/countries/ZM/aez`).
2. **`nearestTown()` crosses borders.** It searches every town in `places.json`, so a point in Uganda
   would resolve to a Ghanaian town. Towns must carry a `country`, and the search must be scoped.
3. **The map is Ghana's outline** (`data/ghana-map.json`, Natural Earth).
4. **Prices.** `data/market.json` is 20 WFP Ghana markets ending July 2023, in GHS, plus MoFA SRID
   2025. Each country needs its own series, currency and market list, and `unitText()` in `js/data.js`
   only knows Ghana's units ("100 KG", "Bunch", "100 Tubers", "Piece").
5. **Language.** English only (`languages.enabled: ["en"]`).
6. **`help.json`** knowledge and the support number are Walo-the-Ghana-project facts.

## The three countries worth proving first

Pick countries that break *different* assumptions, not three easy ones:

| Country | What it tests |
| --- | --- |
| Zambia or Malawi | Southern hemisphere: planting rains Nov–Jan; "plant now" must follow |
| Kenya or Uganda | Equatorial bimodal: two onsets whose dates move year to year |
| Senegal or Côte d'Ivoire | Francophone, different AEZ naming, different price series |

If the method is honest in those three, it is honest anywhere POWER reaches. If it is not, you find
out on three countries instead of fifty-four.

## Adding a country

Data work:

1. `countries.json`: add the country with `status: "draft"`.
2. `places.json`: add towns carrying `country`, and scope `nearestTown`.
3. Fetch NASA POWER daily 1991–2025 per town (`scripts/fetch_agro.py`) and run
   `node scripts/build_agro.js` — it already reads the country's onset windows.
4. FAO per-country crop calendar → `crops` windows for that country's zones.
5. WFP/HDX price series for that country → `market` data, currency and units.
6. A country outline for the map.

Then the gate:

7. A person who farms there reads the answers and signs it off.
8. Flip `status` to `"live"` and set `checked_by_local: true`.
9. Bump the service-worker `CACHE` string so phones pick it up.

There is deliberately no step 10 in code. If adding a country requires editing JavaScript, the
parameterisation has slipped and that is worth fixing rather than working around.

## Two things we will not do

- **Bulk machine translation of the interface.** Already learned once: 126 of 222 Twi labels was
  worse than clean English, and the chip was switched off. Same rule for every new language.
- **EcoCrop-derived planting windows presented as sourced.** The "Best guess" path exists and is
  labelled. A continent where almost every country is "Best guess" is not an expansion, it is a map
  with numbers on it.
