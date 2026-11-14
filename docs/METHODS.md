# Methods

This is the calculation the app uses. The long design record is [app/DESIGN.md](../app/DESIGN.md); the equations are that file’s section 14. Every constant the code reads is in [app/data/rules.json](../app/data/rules.json) or on the crop in [app/data/crops.json](../app/data/crops.json) (`eco` from FAO EcoCrop, `fao56` from FAO-56 Tables 11 and 12). The implementation is [app/lib/agro.js](../app/lib/agro.js). It runs in `scripts/build_agro.js` for the 17 towns and in the browser for “Use my location”.

NASA POWER daily, AG community, complete years **1991–2025**, supplies precipitation (`PRECTOTCORR`), mean temperature (`T2M`), maximum and minimum (`T2M_MAX`, `T2M_MIN`), relative humidity (`RH2M`), wind at 2 m (`WS2M`), and shortwave radiation (`ALLSKY_SFC_SW_DWN`). Monthly climatology is the mean over complete years. Town cells are about 50 km across. The methods describe a usual year. The 10-day forecast is the only “this year” weather input.

Values marked `default: true` in `rules.json` have no single published standard. They are Walo’s labelled choice.

## 1. Reference evapotranspiration

FAO-56 Penman-Monteith, daily, soil heat flux G = 0 (source `FAO56`, Allen et al. 1998, Eq. 6):

```
ET0 = [0.408 Δ (Rn − G) + γ · 900/(T + 273) · u2 · (es − ea)] / [Δ + γ (1 + 0.34 u2)]
```

Pressure and the psychrometric constant follow Eq. 7–8. Saturation vapour pressure follows Eq. 11–12. Actual vapour pressure uses mean relative humidity (Eq. 19). Net shortwave uses albedo 0.23 (Eq. 38). Net longwave follows Eq. 39 with clear-sky radiation from Eq. 37 and extraterrestrial radiation from Eq. 21–25. If humidity, wind, or radiation is missing, the code uses Hargreaves (Eq. 52).

Check recorded in DESIGN.md: extraterrestrial radiation for FAO-56 Example 8 (20°S, 3 September) is 32.2 MJ m⁻² d⁻¹, matching FAO. Example 18 ET0 is 3.79 mm/d against FAO’s 3.9, because Walo uses mean relative humidity and FAO’s worked example uses maximum and minimum.

## 2. Effective rain

USDA Soil Conservation Service method, as in FAO CROPWAT (source `USDA_SCS`):

```
Peff = P (125 − 0.2 P) / 125    when P ≤ 250 mm/month
Peff = 125 + 0.1 P              otherwise
```

## 3. Growing period

A month is in the growing period when rain is at least half of ET0 (FAO Agro-ecological Zones, source `FAO_AEZ`). A month is humid when rain exceeds ET0. Humid months feed the “harvest month is usually wet” warning for crops that need a dry harvest.

## 4. Onset of rains

Sivakumar (1988), with the 20th / 50th / 80th percentile dates across years from Stern, Dennett and Dale (1982). Searching from a start date, onset is the first day d where:

- rain on day d is at least 1 mm (`wet_day_mm`)
- rain over d, d+1, and d+2 is at least 20 mm (`rain_mm` over `rain_days`)
- no run longer than 7 dry days (under 1 mm) occurs in the next 30 days

Search windows in `rules.json`:

- Major season: 1 March–31 July. `default: true`. Sivakumar searched from 1 May in the Sahel. Walo starts on 1 March so forest and transition onsets are not missed. Many forest onsets fall in early March and depend on that choice.
- Minor season: 15 August–31 October, only in the bimodal zones F, T, and C. `default: true`.

“Plant now”, inside a calendar planting month:

- before the 20th-percentile date → wait for the planting rain
- from that date through the median → plant after a good rain
- after the median → plant now
- if the FAO-56 water index for sowing today is below 60 → only with watering
- outside the window → plant in the named month

## 5. Forecast check

When `/api/forecast` returns 10 daily values (`precip_24h`, `t_max_2m_24h` from Meteomatics), the same 1 mm and 20 mm / 3 day test is applied to those days. The 30-day dry-spell test cannot be done with 10 days, so the sentence stays “after the rain on &lt;weekday&gt;”, not “safe”. If the forecast contains no planting rain, every crop that is otherwise in its window says to wait. Offline, or if the function is not configured, Walo uses the NASA climatology only and says so in Why?.

## 6. Crop water and WRSI

Frère and Popov (1979), with stage lengths and Kc from FAO-56. Stage lengths scale to the crop’s local season length, keeping FAO’s proportions. Crop evapotranspiration on day d is Kc(d) times that month’s ET0, spread over the days of the month. A soil store starts empty (`default: true`, 100 mm). It fills with effective rain and cannot exceed 100 mm. Actual use is the minimum of crop need and what is in the store.

```
WRSI = 100 · Σ AET / Σ ETc
```

Classes: at least 80 enough rain, 60–80 some stress, 50–60 serious stress, below 50 likely failure. WRSI is used for the suitability class only when the season is 200 days or shorter. Cassava and plantain are longer than the index was built for. Their water numbers can be shown. They do not change the class.

## 7. Climate suitability

EcoCrop limits (absolute minimum, optimum minimum, optimum maximum, absolute maximum) produce a score that is 0 outside the absolute limits, 1 inside the optimum, and linear between. Temperature suitability is the best, over 12 possible start months, of the worst month in a season of `round(mean cycle length / 30)` months. Rain suitability uses **annual** rain against EcoCrop’s annual rain limits.

That annual comparison is a deliberate deviation. Ramirez-Villegas et al. (2013) use seasonal rain. The EcoCrop table states the limits as annual totals. Using seasonal rain marked rice and garden egg unsuitable everywhere, so Walo compares annual with annual. Sorghum uses FAO’s Ghana rainfall instead of EcoCrop’s 700 mm cap (see `fix_crops_v7.py` and the crop record’s `rain_gh`).

Suitability is temperature score times rain score. Classes (`default: true`; FAO 1976 names the classes and does not give these cut-offs):

| Score | Class | Words on screen |
| --- | --- | --- |
| ≥ 0.8 | S1 | Grows well |
| ≥ 0.6 | S2 | Grows well |
| ≥ 0.4 | S3 | Can grow |
| ≥ 0.2 | S3− | Grows poorly |
| below 0.2 | N | Grows poorly |

The class the farmer sees is the lower of the EcoCrop class and the WRSI class, for seasonal crops that have FAO-56 coefficients.

## 8. Heat

Maize and rice: days with maximum temperature above 35 °C during the FAO-56 mid-season (flowering) stage (Sánchez, Rasmussen and Porter, 2014). Other crops use the top of the EcoCrop optimum range, and the screen’s source line does not cite a crop-specific paper for that threshold. `heat.hot_day_c` is 35. The agro file also stores counts of days above each whole degree from 24 to 40 so a threshold can change without a new NASA download.

## 9. Growing degree days and field stage

McMaster and Wilhelm (1997), method 2. For maize the base is 10 °C and the upper cut-off is 30 °C. Other crops use the EcoCrop absolute minimum as the base and no upper cut-off.

```
GDD = (min(max(Tmax, Tb), Tu) + min(max(Tmin, Tb), Tu)) / 2 − Tb
```

Progress is growing degree days since sowing, divided by the degree days the FAO-56 stages need in a normal year at that place. Days not yet in the POWER record use the climatology. “Harvest and sell” starts at the late-season stage. Crops without FAO-56 stage lengths use the mean split of the Table 11 rows Walo transcribed (initial 18%, development 25%, mid 37%, late 21%).

## 10. Greenness

MODIS/Terra MOD13Q1 v6.1 NDVI, 250 m, 16-day, via Planetary Computer. Median in a box about 3 km by 3 km around the town point. “About as green as usual” means the latest composite is within 0.05 of the 2016–2025 mean for that month (`default: true`). Town centres (Kumasi, Accra, Tamale) read low because the box is mostly built up. Forest composites in July and August are often cloudy.

## 11. Selling

For a field, the sentence starts from its own harvest month. “Store if you can” requires the usual price, within `sell.store_window_months` (6, `default: true`) after harvest, to be at least `sell.store_gain_min` (0.10, `default: true`) above the harvest month on the WFP seasonal index. A crop with no series falls back to about 3 months after harvest (`default: true`). Another market is mentioned only inside 150 km and only when its last-12-months average, same crop and unit, is at least 15% above the nearest market (both defaults). The years (2015–2023) and the unit stay on screen. Distances are straight-line.

## Ejura maize check

From DESIGN.md section 14, transition zone, major onset: 20th percentile 15 March, median 2 April, 80th percentile 26 April. That window is March–April, the same as the FAO Ghana calendar and the MoFA district page. Sown at the median onset: water need 323 mm, effective rain 325 mm, deficit 26 mm, WRSI 92 (enough rain), about 4 days above 35 °C at flowering. Minor season, median late August: WRSI 100.

Reported surprises, left visible in Why? rather than tuned away:

- Kumasi maize is only S3. Annual rain is about 1,460 mm, above EcoCrop’s optimum maximum of 1,200 mm. EcoCrop ranges are global.
- Rice WRSI is low in most towns. FAO-56 Kc values are for flooded paddy. Walo’s water balance assumes rain-fed conditions.
- Forest onsets cluster at the 1 March search start. Minor-season onsets cluster in late August.
