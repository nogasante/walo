# Walɔ: design process (redesign, 14 November 2026)

*Team Simply Zero · NASA Space Apps Challenge 2026 · Field Shift · Kumasi*

The first version of Walɔ (built the morning of 14 Nov) put every number on screen: month grids, crop timing tables, three long rotation cards, several price tables per crop and a long list of warnings. The team's verdict: "overwhelming" and "hacked". This document records how we redesigned it, step by step. The scope did not change (Ejura-Sekyedumase only; maize, cowpea, groundnut, cassava only; Calendar, Market, Plant Doctor; voice-first).

> Sections 1-13 record how the design got here. **§13b describes the current app (v12).** §14 is the methods. Paths in those sections name the files as they were then; the current tree is in `README.md`.

---

## 1. Who we design for

### Primary persona: Ama, smallholder farmer in Ejura
- 41, farms about 3 acres near Ejura town. Grows maize every season and some cowpea; tried groundnut once.
- Reads a little English and some Twi; prefers to *listen*. Uses a shared low-cost Android phone with a cracked screen.
- Looks at the phone outside, in bright sun, often with one hand while holding a hoe or a child.
- Pays for data in small bundles; network drops in the field.
- Her real questions: *"When do I plant so the rain doesn't fail me?"*, *"When do I sell so the traders don't cheat me?"*, *"Is now a good time?"*
- Trusts the extension officer and neighbours more than an app. Walɔ must **support** her judgement, never order her around.

**Design consequences:** big tap targets, high contrast, one answer per screen in very few words, a Read-aloud button on every answer, icons and crop pictures to recognise things without reading, small page weight, works offline after the first visit.

### Secondary persona: Kofi, Space Apps judge
- Has about 3 minutes during the pitch and maybe 1 minute with the live link.
- Scores Impact, Creativity, Validity, Relevance, Presentation.
- Wants to see quickly: *Is NASA data really used? Is it honest? Does it answer the Field Shift brief (compare rotations, support farmer judgement)?*

**Design consequences:** NASA data is visible on every answer (a source line plus one chart), rotation comparison is on the Plant screen, evidence/risks/gaps are one tap away, sources and AI use are on one About page.

---

## 2. Jobs to be done: one key question per screen

| Screen | Job | The ONE question it answers | Answer format |
| --- | --- | --- | --- |
| Home | Tell Walɔ my crop | "Which crop are you growing?" | 4 big picture tiles |
| **Plant** (Calendar) | Plan sowing | "When should I plant *maize*?" | "Plant in March-April" + rain chart |
| **Sell** (Market) | Time the sale | "When does *maize* sell best?" | "Sell in June" + price-pattern chart |
| **Check** (Plant Doctor) | Sanity-check a month | "Is *April* a good time to plant *maize*?" | Green/amber/red status + 3 numbers |
| About | Trust | "Where does this come from?" | Facts, data limits, sources, AI use |

Secondary job on Plant: *"Should I keep planting maize after maize, or follow it with a legume?"*, the Field Shift rotation comparison, shown as three short plan cards below the answer.

---

## 3. Information architecture and user flow

> Superseded by §12 (v8): two equal ways in (place → what to plant now; crop → where it grows best) and three tabs.

```
Home (pick crop) ──► Plant ◄──► Sell ◄──► Check ◄──► About
   ▲                  │  bottom tab bar (Plant · Sell · Check · About)
   └── crop pill (top right) "Maize ▾" goes back to change crop
```

- **Two levels only.** Home → a job screen. No nested menus.
- **Crop is chosen once** and remembered (localStorage); the crop pill in the top bar shows it and changes it.
- **Bottom tab bar** (thumb zone) with icon + English word + Twi word: Plant/Dua, Sell/Tɔn, Check/Hwɛ, About.
- **Progressive disclosure:** each answer card shows the answer, one chart, a source line and the Read-aloud button. Everything else (exact rainfall, rules, sources, confidence, 2026 values) is behind **"Why?"**. Rotation evidence/risks/gaps are behind **"Evidence"**. Data gaps live in **About → What we don't know yet**.
- **Deep links** for the pitch: `#/plant/maize`, `#/sell/maize`, `#/check/maize/4`, `#/about`.

Typical flow (3 taps): open Walɔ → tap Maize → see "Plant in March-April" → tap Sell → "Sell in June".

---

## 4. Design principles

1. **One answer first.** Every screen leads with a single sentence of at most 5 words (e.g. "Sell in June").
2. **One primary action per screen:** Read aloud. (Plant also offers "Check a month" as a secondary, outlined button.)
3. **Big targets:** every button, tab and month chip is ≥ 48 px tall (tabs 64 px, crop tiles 164 px). Checked automatically in the test script (no target under 44 px).
4. **Sunlight contrast:** dark ink #17231a on warm paper #f6f1e7 (≈15:1); muted text ≈7:1; no light-grey body text.
5. **Icons + few words:** crop illustrations, tab icons, status icons; plain words ("Too dry to plant", "Wait", "Ask your extension officer").
6. **Colour never alone:** status uses colour band + icon + word (Yes / Wait / Not now / Ask first).
7. **Plain language:** "usual rain", "days over 35 °C", "soil: Moist" instead of PRECTOTCORR, GWETROOT. Variable names only in Sources.
8. **Honest but quiet:** gaps are disclosed once, in the right place (Why? / About), not as banners on every card.
9. **Support, not replace:** every check ends with "look at your own farm and ask your extension officer"; plans say "Walɔ shows the evidence; you decide".
10. **Fast and offline:** no frameworks and no build step; one self-hosted variable font, and real photos instead of decorative diagrams; the service worker caches exactly the shipped files. The shipped payload is about 2.1 MB, of which 1.7 MB is photography, 244 KB is data and 32 KB is the font. (This replaces the "~130 KB, no web fonts, no images except inline SVG" figure from v1, and restates §9's ~1.1 MB: both were true of the version they described, not of the current app.)

---

## 5. Visual system

- **Palette (earthy):** paper #f6f1e7 · surface #ffffff · ink #17231a · muted #4e5a50 · primary green #1d5e37 · soil brown #8a5a2b · maize gold #e8b33a (focus ring, "this month") · rain blue #3b78b5.
  Status: good #1d6b3a on #e2f2e4 · wait #8a4b00 on #fff0d1 · bad #a3221a on #fde5e1 · ask #27508f on #e3ecf8.
- **Type:** system font stack (no download). One scale (×1.25): 13 · 15 · 17 (body) · 21 · 28 (question) · 34 (answer).
- **Spacing:** 4-px base: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- **One card component:** white, 18 px radius, soft shadow, 24/16 padding. *Answer card* = card + 6 px status band on top + status badge + big answer + sub-line + chart + source line + actions + Why?.
- **Crop art:** four hand-made flat SVGs in the same style and palette (maize cob, cowpea pod with black-eyed beans, groundnut shell, cassava root). No emoji mix.
- **Charts:** max one per screen, inline SVG, month initials, highlighted bars only where it matters (planting months green; best price month green, lowest red with % labels).

---

## 6. Usability self-review (Nielsen's 10 heuristics) and fixes

| # | Heuristic | Problem in v1 | Fix in v2 |
| --- | --- | --- | --- |
| 1 | Visibility of system status | No sign of which crop/month was selected; "this month" unclear | Crop pill in top bar; selected month chip filled green; gold dot + dark pill marks this month; active tab highlighted |
| 2 | Match with the real world | Variable names (GWETROOT), "seasonal index 1.25" | "Soil: Moist (0.6)", "25% above the year's average", "Plant in March-April" |
| 3 | User control & freedom | Long scroll, no way back to crop choice | Crop pill returns home; tab bar always visible; Read aloud toggles to Stop |
| 4 | Consistency & standards | Mixed emoji, pills, tables and card styles | One card component, one badge style, one chart style, one icon set |
| 5 | Error prevention | Crop with no data (cassava timing, groundnut prices) showed empty tables | Explicit "Ask your extension officer" / "No Ejura price history yet" answers with the nearest real data |
| 6 | Recognition over recall | Text-only crop buttons | Picture tiles with English + Twi names; icons on tabs |
| 7 | Flexibility & efficiency | Everything always expanded | Deep links for pitching; details on demand; crop remembered between visits |
| 8 | Aesthetic & minimalist design | 4 tables + 3 long cards per tab, warnings everywhere | One answer + one chart per screen; gaps moved to About |
| 9 | Help users recover from errors | Blank page if data failed to load | Clear "Could not load Walɔ's data" card with what to do |
| 10 | Help & documentation | Methods hidden in README | "Why?" on every answer explains the rule and the source in plain words; About lists sources |

Also checked: no JavaScript console errors on any screen (Playwright, Chrome, 390×844); all interactive targets ≥ 44 px (script check); keyboard focus ring visible (gold); `prefers-reduced-motion` respected; images are `aria-hidden` with text labels next to them.

---

## 7. What we cut or hid (and why)

- **Cut:** 12-month grid with per-month detail panel, crop timing table for all crops at once, latest-price tables, SRID 2025 tables, dated news quotes on screen, district "coming later" chip in the header. *Too much for one decision.*
- **Hidden behind Why? / Evidence:** exact rainfall per month, rule thresholds, 2026 values, confidence notes, last recorded price, GCX quote, rotation evidence/risks/gaps.
- **Moved to About:** headline NASA facts, data limits, full source list, AI use.
- **Kept and made visible:** NASA POWER rain chart on Plant, NASA numbers on Check, NASA source line on every answer, the three-plan comparison.

## 8. Next steps (not built)

- Record Twi voice clips for each answer (team members who speak Twi) and play them instead of English speech; have a native speaker check every Twi label (Akwaaba, Dua, Tɔn, Hwɛ, Aburo, Adua, Nkateɛ, Bankye).
- Photo check of sick plants (needs an AI vision key on the server).
- Test with 3-5 Ejura farmers: can they find "when to plant maize" in under 30 seconds without help?

---

## 9. Visual redesign v3 (14 Nov 2026, after team feedback: "looks basic", "feels generic")

**Team concept (their idea):** most farm apps give generic, country-wide advice. Walɔ uses NASA data for the farmer's own location. The UI now leads with that:

- **Location first.** Home opens on a full-bleed farm photo, then a **"Your farm" card**: Ghana map (Natural Earth outline) with a pin on Ejura, coordinates 7.39° N, 1.36° W (the exact NASA POWER query point) and SRTM elevation 224 m, plus one line: "Walɔ reads NASA data for this point, not a national average."
- **Generic advice vs. Walɔ** card on every Plant screen. One row each for Where, Rain, Change, Heat and Soil, with generic advice on the left and the Ejura value on the right. Values used: 1,242 mm/yr, 579 mm Apr-Jul, 399 mm Sep-Nov, +68 mm/decade in the minor season, 75 days above 35 °C, sandy loam pH 6.5. Every value is read live from `data/climate.json`. The generic column is qualitative only (no invented numbers). The Why? section notes the ~50 km POWER grid.
- **Real photography:** 8 openly licensed Wikimedia Commons photos from Ghana (crops, market, farmers). Used for photo headers, 4:5 crop cards with gradient overlays and plan thumbnails. Credited in `data/credits.json` and About → Sources.
- **Type and icons:** Plus Jakarta Sans variable font (self-hosted woff2, 27 KB) and Lucide icons, both bundled.
- **Components:** answer card overlaps the photo header (elevated, gradient status band), status chips, pill buttons, floating glass bottom bar with icon + English + Twi, segmented market switch, stat tiles with coloured icon tiles, rounded-gradient bar charts with value labels and a "now" marker.
- **Motion:** 0.38 s fade-up between screens, rotating chevrons on Why?, a pulse on the map pin. All motion is disabled under `prefers-reduced-motion`.
- **Performance:** about 1.1 MB total, mostly photos (each WebP ≤ 140 KB). Below-the-fold images are lazy-loaded, and the service worker caches the whole app for offline use.

## 10. v4 restructure: location first, crops from a data file (14 Nov 2026)

The team's pitch: *tell Walɔ where your farm is; it finds the best crops for that place, gives the planting, selling and checking advice, and keeps track of your farms from seed to harvest.*

**Flow.** First visit → **Where is your farm?** (`#/where`): "Use my location" or pick Ejura-Sekyedumase (main pilot), Tamale or Techiman. → **Home**: farm card with map pin, **Best crops here**, My farms summary. → per crop **Plant / Sell / Check**. → **Farms** tab. Bottom nav: Home (Fie) · Plant (Dua) · Sell (Tɔn) · Check (Hwɛ) · Farms (Mfuo).

**Locations.**
- Ejura: `data/climate.json` (1991-2025), sourced crop calendar, soil, SRTM, rotation evidence, markets Ejura/Kumasi/Techiman.
- Tamale, Techiman: `data/locations.json`, built by `scripts/build_locations.py` with the same NASA POWER parameters and method (method re-checked: it reproduces Ejura's 1,242 mm / 579 / 399 / 75 hot days / +68 mm per decade exactly). Tamale has no price data; Techiman uses Techiman market.
- My location: the phone calls the NASA POWER daily API (PRECTOTCORR, T2M_MAX, GWETROOT, 2016-2025, CORS allowed) and summarises it like the districts; saved in localStorage. Ten years is too short for trends, so none are shown. If the call fails, Walɔ keeps the saved district.

**Crops are data, not code.** `data/crops.json` holds each crop's name, Twi word, photo, typical duration, minimum wet-run length, harvest-needs-dry flag, scoring rules, growth stages and sources. Adding a crop = adding an entry (plus a credited photo); the code does not change.

**Ranking rules of thumb (v4; replaced by the published methods in §14).**
- Wet month: rain ≥ 80 mm and root-zone soil wetness ≥ 0.50. Hot month: average daily high > 35 °C or ≥ 10 days above 35 °C.
- Metrics per place: longest run of wet months, number of rainy seasons (rain peaks in that run separated by a dip of at least 15 %), rain in that run, hot months in the run, hot days a year, number of wet months.
- Each crop starts at 1 and adds or loses points per its rules in `crops.json`; capped 1-5. The "How is this ranked?" panel lists every rule that fired with its points.
- Results (Nov 2026): Ejura cowpea 5, groundnut 4, maize 3, cassava 3 · Tamale cowpea 4, groundnut 4, maize 3, cassava 2 · Techiman cowpea 4, groundnut 4, maize 3, cassava 3.

**Planting months outside Ejura** are derived: the first months of the wet run (and of the second season after the dip) that leave enough wet months for that crop. Shown with "Rule of thumb from NASA rain; confirm locally".

**My farms.** Name, crop, planting date, place; stored only in localStorage. Stage timeline from typical durations in `crops.json`, next job and date, expected harvest, and NASA hints from that place's usual months (dry month now, wet harvest for dry-harvest crops, heat at maize flowering). Full tracking is "coming later".

## 11. v5-v6: 19 sourced crops, planting flow, direct answers, less text (14 Nov 2026)

**Crops.** `data/crops.json` is now generated by `scripts/build_crops.py` from the team's crop knowledge base (`walo-crops.json`, 20 crops, every value with source ids). Shea is excluded (wild tree); cocoa and cashew are tree crops. Crops are shown only for the location's FAO agro-ecological zone (Ejura, Techiman: Transitional; Tamale: Guinea savanna; my location: zone of the nearest district). Confidence (High/Medium/Low) comes from the knowledge base per district and is shown as a green/amber/grey dot. Unsourced facts read "not confirmed". Twi names appear only where the file has one, flagged "check with a Twi speaker". 15 new crop photos from Wikimedia Commons (credited in `data/credits.json` and About).

**Scoring (rules of thumb, 1-5; replaced in v10 by the published methods in §14).** Base 1; yearly NASA rain inside the crop's EcoCrop ideal range +2 (possible range +1); yearly mean temperature in the EcoCrop ideal range +1; hottest month's average high above the EcoCrop maximum −1; shortest growing time fits inside the run of wet months +1; FAO lists a planting season for the zone +1. EcoCrop ranges are global, not Ghana-specific (e.g. EcoCrop gives sorghum a 700 mm rain maximum, which pulls sorghum down even in Tamale).

**Planting windows.** FAO Ghana crop calendar per zone (e.g. cassava, Transitional: sow 30 Apr-31 Jul, harvest 10 Nov-10 Jan). Where FAO has no entry, Walɔ gives a **Best guess** from the place's NASA rain (start of each wet run long enough for the crop), marked with a grey dot and a "Best guess" chip. No screen tells the farmer to "ask" someone; the only judgment line is on About: "Walɔ supports, not replaces, your judgment."

**Selling.** Seasonal price patterns for 11 crops (WFP/HDX, same method as before). Places without a market series use the nearest market with data (Best guess). Crops without any price series get a Best guess: sell about three months after the usual harvest month (the dip-after-harvest pattern seen in Walɔ's price data), marked Best guess.

**Planting flow (hero feature).** Home → **Start planting** → 1 pick crop (ranked for the place) → 2 name the field and pick the place → 3 take a photo (`<input type=file accept=image/* capture=environment>`, downscaled to a 480 px JPEG in localStorage) → 4 plan: sow date (next FAO/best-guess window, editable "Planted already?"), harvest date (typical days), five-stage timeline Seed › Sprout › Growing › Flowering/Bulking › Harvest with dates, and NASA usual rain for the season. **Farm view**: progress ring, stage track, one "Today's task" card, alerts (wet harvest for dry-harvest crops, heat at maize flowering), NASA rain mini-bars, photo diary with "Add photo". A demo farm (maize, Ejura, sown 75 days ago, two Commons photos) is seeded on first visit.

**Less text.** One big answer per card plus chips, dots, rings and bars; everything else is behind "More". Compare-card and rotation plans sit in collapsible sections.

## 12. v8: one clear flow with two equal ways in (14 Nov 2026)

Team feedback: "it feels like we are putting everything anywhere and anyhow". The team's direction: *either select your location and the app tells you what to plant at the moment, or select the crop and the app tells you where to grow it.*

**Flow**

```
Home ─┬─ Pick your place ─► What to plant here NOW ─┐
      └─ Pick your crop  ─► Where it grows best ────┤ (tap a place)
                                                    ▼
                       Crop sheet ─► Start planting (crop · field · photo · plan) ─► My farm ─► Harvest & sell
Tabs: Home · My farms · Sell        (i) in the header: About & sources
```

**Decisions**

- The two ways in get **equal weight**: two cards of the same size, side by side, each with a photo, a gold icon and a 3-word title. Nothing else competes on Home except last place, last crop and My farms.
- **Path A answers "now".** Crops are grouped by what you can do this month (Plant now / Plant if you can water / Wait for steady rain / Plant later in <month>), then by fit, then by confidence, then by a finer score. The month's NASA rain (this month and next) sits on top so the reason is visible.
- **Path B uses a map.** Pins are placed by latitude/longitude on the Natural Earth outline and coloured by fit (1-5); the top three are labelled. Places outside the crop's FAO zones are white and listed separately, not ranked.
- **Both paths converge** on one crop sheet with one primary button (Start planting). The farm view replaces the old "Check month" screen with a This month card (NASA usual rain, hot days, soil wetness), and shows a **Harvest & sell** card from 85 % of the season.
- **Three tabs** instead of five: Plant/Check were folded into the paths and the crop sheet; About moved behind the (i).
- **Honesty kept:** Best guess labels and confidence dots; Dambai (outside FAO's zone text) is ranked on NASA climate only; zone-edge places (Ho, Sunyani) are flagged in the About notes; sources behind "More".
- **Checks:** headless screenshots of every route (390 × 844), no console errors, every link/button/map pin at least 48 px high, no "ask an extension officer" wording.

## 13. v9-v11: polish, markets everywhere, cleanup, published methods, forecast, greenness, Plant Doctor (14 Nov 2026)

- **Polish:** one answer per card, secondary facts in bottom sheets, 48 px tap targets, English Read aloud on every answer.
- **Sell is data-driven** from the 20 WFP/HDX markets: the nearest market with data to any place (GPS included), for any crop with a series; "Best guess" where there is none.
- **Cleanup:** every threshold moved to `data/rules.json` with its source (or `default: true` and a note when no standard exists); zone names moved to `data/app.json`; unused icons, CSS rules and stale copy removed; `sw.js` lists exactly the shipped files.
- **Forecast (Meteomatics)** and **greenness (NASA MODIS NDVI)** added as small, labelled extras. NASA POWER stays the core.
- **Plant Doctor:** up to 3 guided photos + NASA POWER weather for the last 14 days → Gemini on the server → one strict-JSON answer, labelled AI-generated, with a retake prompt for unclear photos.

## 13b. v12: rebuild for low-literacy farmers, no pitching (14 Nov 2026)

**Problem (team, after a hands-on test):** the app read like a technical dashboard (charts, mm, %, GHS tables), Sell and Plant Doctor overwhelmed, a "See the NASA proof" layer felt like selling, and some answers contradicted each other ("Plant now" while the forecast had no rain; "sell in June" on a field harvested in November).

**Rules we now follow**
1. **One answer per screen**: icon + one plain sentence + Listen + a quiet source line. Numbers only as everyday words (a month, a weekday, "2 km").
2. **Why? on tap**: 1-3 plain sentences; the numbers, methods and sources sit under Details for judges and extension staff.
3. **No pitching inside the app**: no intro slides, hero images, slogans or "10 years ago vs now" panels. Pictures are labels only (crop photos, stage icons, status icons). Pitch material belongs in the slides and video.
4. **Never contradict**: the onset rule is applied to the 10-day forecast; if there is no planting rain in it, every crop in its planting window says "Wait: rain not here yet". Without a forecast, Walɔ falls back to the usual onset and says so in Why?.
5. **Sell follows the field**: for a field, the advice starts from its own harvest date ("Harvest in late November. Prices usually rise by <month>: store if you can" or "sell soon after harvest"). The data years (2015-2023) and the unit (e.g. 100 kg bag) are always on screen; a far market shows its distance.
6. **Plant Doctor is fast and honest**: one photo first (resized to 768 px on the phone), staged progress with Cancel, the fastest model first; the warning "AI answer, can be wrong. Check with someone you trust before spending money" is always visible; the AI asks for one named extra photo only when unsure.
7. **Normal mobile sizes**: body 16 px, titles 22 px, 48 px buttons, 24 px icons, photos 168-184 px tall, 16-24 px spacing; tokens at the top of `styles.css`. Bottom tabs never cover content; on a wide screen the app sits in a phone-width column on the brand colour.

**Structure:** one router (`js/main.js`), one data layer (`js/data.js`), one state store (`js/store.js`), one component kit (`js/ui.js`), one file per screen (`js/screens/`). Six task screens (Home, Plant now, Crop, My farm, Sell, Plant Doctor) plus Start planting and About. Old code, data files, photos and scripts that the new design does not use were deleted; `sw.js` precaches exactly the shipped files.


**v12.1 (same day, team feedback "not lively enough", "liked the column cards", "no thick left border"):** photo column cards on Home (photo on top, round yellow icon badge, title + one line) with Plant Doctor as a wide photo card; a photo band behind each answer screen (field, crop or market photo) with the answer card overlapping it; small month bars (usual rain, or usual price) with the current month highlighted; crops as 2-column photo tiles with coloured status chips; fields as photo cards with a clean progress ring. Cards have no side stripes: status shows in the round icon badge or a chip. All photos are real Wikimedia Commons photos, credited in `data/credits.json`; the photo choices live in `data/app.json` (`photos`).

**v12.2 (14 Nov 2026, "logins?"): optional backup, never in the way.** Farmers lose or change phones, so fields should be able to follow them, but an account must never stand between Ama and an answer. Walɔ still opens straight to answers with no sign-in. A small "Back up my fields" row (cloud icon, one line) sits under the fields in My farm and in About. It is one screen with three states in plain words: *Back up my fields* (email box, "Send me a code", "No password") → *Type the code we sent* (big number box that the phone can fill from the email, "Send a new code", "Use another email") → *Your fields are backed up* (how many fields, last backup time, "Back up now", "Sign out", "Signing out keeps your fields on this phone"). We chose an email code because it needs no password to remember and costs nothing; SMS codes would suit farmers better but need a paid SMS provider. Errors are plain ("No internet. Try again when you are online.", "That code did not work"). Same cards, icon badges and buttons as the rest of the app; no side stripes.

**v12.3 (14 Nov 2026, real-phone test: "I took a picture but nothing happened"; "what if the farmer wants to talk or type"):** Plant Doctor now starts with three equal choices, **Take photo**, **Talk**, **Type**, as big picture buttons, plus "Choose a photo from the phone". Talk fills an editable text box, so a wrong word can be fixed before sending; where the browser cannot listen, the Talk button is not shown and the screen says "Type instead". With words only, the AI may ask **one** short question (shown as the answer card, with Listen) before answering; it never sends the farmer elsewhere. A picked photo shows at once with "Looking at your photo…", then the progress steps. Every failure has a plain message on the same screen (photo could not be opened, phone closed Walɔ while the camera was open, no microphone, offline, too slow). The same photo behaviour now applies to Add photo (My farm) and the Start planting photo: one shared photo path, the photo shows at once while it is saved, and "Choose a photo from the phone" is offered when the camera fails.

## 14. Methods

All constants below are read from `data/rules.json` (source ids in brackets) or from the crop record in `data/crops.json` (`eco` = FAO EcoCrop, `fao56` = FAO-56 Tables 11/12). The same code (`lib/agro.js`) runs in `scripts/build_agro.js` (bundled places) and on the phone (Use my location).

**Data.** NASA POWER daily, AG community, 1991-2025 at each place: PRECTOTCORR (P), T2M, T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN (Rs) [POWER]. Monthly climatology = mean over complete years.

**1. Reference evapotranspiration** [FAO56, Eq. 6]

  ET0 = [0.408 Δ (Rn − G) + γ · 900/(T + 273) · u2 · (es − ea)] / [Δ + γ (1 + 0.34 u2)],  G = 0 (daily)

with P = 101.3((293 − 0.0065 z)/293)^5.26, γ = 0.000665 P (Eq. 7-8); es = [e°(Tmax) + e°(Tmin)]/2, e°(T) = 0.6108 exp(17.27T/(T + 237.3)) (Eq. 11-12); ea = RHmean/100 · es (Eq. 19); Rns = (1 − 0.23) Rs (Eq. 38); Rnl from Eq. 39 with Rso = (0.75 + 2·10⁻⁵ z) Ra (Eq. 37) and Ra from Eq. 21-25. If RH, wind or radiation are missing: Hargreaves, ET0 = 0.0023 (T + 17.8) √(Tmax − Tmin) · 0.408 Ra (Eq. 52). *Check:* Ra for FAO-56 Example 8 (20°S, 3 Sep) = 32.2 MJ m⁻² d⁻¹ (FAO: 32.2); FAO Example 18 ET0 = 3.79 mm/d vs FAO's 3.9 (we use RH mean, FAO used RHmax/RHmin).

**2. Effective rain** [USDA_SCS]: Peff = P(125 − 0.2P)/125 for P ≤ 250 mm/month, else 125 + 0.1P.

**3. Growing period** [FAO_AEZ]: a month is in the growing period if P ≥ 0.5 · ET0; it is humid if P ≥ ET0 (used for "harvest month is usually wet").

**4. Onset of rains** [SIVAKUMAR88, STERN82]: searching from a start date, the onset is the first day d with P(d) ≥ 1 mm, Σ P(d..d+2) ≥ 20 mm, and no run of more than 7 days with P < 1 mm in the next 30 days. Major season search: 1 Mar-31 Jul; minor season: 15 Aug-31 Oct, only in the bimodal zones (forest, transition, coastal savanna) (`default: true`, see note in rules.json). Across 1991-2025 Walɔ stores the 20th, 50th and 80th percentile dates. "Plant now" (in a calendar planting month): before the p20 date → *Wait for the planting rain*; between p20 and the median → *Plant after a good rain*; after the median → *Plant now*; if the FAO-56 WRSI for sowing today is below 60 (serious stress or worse) → *Only with watering*; outside the window → *Plant in <month>*.

**5. Forecast check** [METEOMATICS]: when online, `/api/forecast` gives 10 daily values of precip_24h and t_max_2m_24h. The same onset rain rule (≥ 1 mm on day d, ≥ 20 mm over 3 days) is applied to the forecast days; before the median onset this changes "Wait for the planting rain" / "Plant after a good rain" to "Plant after the rain <date>". The 30-day dry-spell part cannot be checked with 10 days, so the answer stays "after the rain", not "safe". Offline or if the service fails, Walɔ uses the NASA climatology only.

**6. Crop water use and WRSI** [FAO56, FREREPOPOV]: stage lengths L_ini, L_dev, L_mid, L_late from FAO-56 Table 11, scaled to the local season length; Kc from Table 12, linear in the development and late stages (Eq. 66):

  ETc(d) = Kc(d) · ET0(month)/days,   S(d) = min(100 mm, S(d−1) + Peff(d)),   AET(d) = min(ETc(d), S(d)),
  WRSI = 100 · Σ AET / Σ ETc

with the soil store starting empty (100 mm bucket, `default: true`). WRSI ≥ 80 Enough rain, 60-80 some stress, 50-60 serious stress, < 50 likely failure. Used for seasonal crops of ≤ 200 days only.

**7. Climate suitability** [ECOCROP, FAO76]: for EcoCrop limits (Tabsmin, Toptmin, Toptmax, Tabsmax), a linear score f(T) = 0 outside the absolute limits, 1 inside the optimum, linear in between. Temperature suitability = max over the 12 start months of min over the n = round(mean cycle/30) months of f(Tmean). Rain suitability = f(annual P) with EcoCrop's annual rain limits (for sorghum, FAO's Ghana rainfall). **Deviation, and its correction in v49:** Ramirez-Villegas et al. (2013) compare season rain; the FAO EcoCrop database gives the limits as annual rainfall, and using season rain against those annual limits rated rice and garden egg "not suitable" everywhere, so Walɔ compared like with like (annual vs annual). That comparison failed the other way at a wet highland town (≈1,684 mm in the season), which scored below a dry one (≈408 mm) because both were measured against a 1,200 mm annual optimum. So where a crop has a sourced planting window in the zone, the rain side now comes from the FAO-56 water balance of that season (method 7 above, WRSI at the middle month of the window) and EcoCrop supplies the temperature class; the annual rain comparison is used only for a crop with no calendar there. WRSI dots follow the water class labels - ≥80 = 5, 50-79 = 3, below 50 = 1 - so a season under water stress can no longer read as "grows well". Suitability = temperature × rain → class S1 ≥ 0.8, S2 ≥ 0.6, S3 ≥ 0.4, S3− ≥ 0.2, else N (cut-offs `default: true`; FAO 1976 names the classes but gives no numbers). Shown class = lower of the EcoCrop class and the WRSI class.

**8. Heat stress** [SANCHEZ14]: maize and rice: days with Tmax > 35 °C during the FAO-56 mid-season (flowering) stage. Other crops: the top of the EcoCrop optimum range (labelled not cited).

**9. Crop stage on My farm** [MCMASTER97]: GDD = (min(max(Tmax, Tb), Tu) + min(max(Tmin, Tb), Tu))/2 − Tb (method 2); maize Tb = 10 °C, Tu = 30 °C; other crops Tb = EcoCrop absolute minimum. Progress = (GDD observed since sowing from NASA POWER daily + climatological GDD for days not yet in POWER) / GDD the FAO-56 stages need in a normal year at that place. "Harvest & sell" appears from the start of the late stage.

**10. Greenness** [MODIS]: NASA MODIS Terra MOD13Q1 v6.1 NDVI (250 m, 16-day) read through Microsoft Planetary Computer's STAC and statistics API (`scripts/build_ndvi.py`): median NDVI in a ~3 × 3 km box around each town point; monthly climatology = mean of 2016-2025 composites starting in that month; "latest" = newest composite. Latest within ±0.05 of the usual value for its month reads "About as green as usual" (`default: true`).

**Ejura check (maize, transition zone).** Major onset p20 15 Mar · median 2 Apr · p80 26 Apr → planting window Mar-Apr, the same as FAO's Ghana calendar and MoFA's district page. Sown at the median onset: water need 323 mm, effective rain 325 mm, deficit 26 mm, WRSI 92 (Enough rain), about 4 days > 35 °C at flowering. Minor season (median late Aug): WRSI 100.

**Surprises (reported, not hidden).**
- A cool, wet highland season can score S2 while a dry one scores S3: the first supplies its water need (WRSI 100) but its cool months lower the temperature class to 0.75, while the dry season falls to WRSI 53 in its short rains. Before v49 both were judged on annual rainfall, which put the drier place (677 mm a year) above the wetter one (1,844 mm a year).
- Rice WRSI is low almost everywhere: FAO-56 Kc values are for flooded paddy rice, while Walɔ assumes rain-fed upland.
- Cassava and plantain seasons are longer than WRSI was built for, so their water numbers are shown but not used for the class.
- Many forest-zone onsets land in early March, close to the 1 March search start, so they depend on that (labelled) choice. Minor-season onsets cluster in late August.
- NDVI at town points (Kumasi, Accra, Tamale) is low because the 3 km box is mostly built-up; forest July-August composites are cloud-affected.


### v12.5 notes
- Photo pickers: two inputs live in index.html; screens open them with `<label for>` (a real tap), never script `.click()`. Gallery input has `accept="image/*"` and no `capture`, so Android opens its photo picker. The asking screen is saved in sessionStorage before the picker opens; the file is copied into memory in the change handler.
- Plant Doctor makes no weather claim in the UI.
- Crop groups by planting time: small coloured pill headers (icon, title, count) with tiles under them; "Doesn't grow well here" is folded. No side stripes.

### v12.6 notes
- Sell opens on the farmer's own fields (photo cards: field name, "Your maize · Harvest late November", a coloured chip for store/sell now, "Usually best in June at Ejura market (2 km)", price years and unit). One field opens straight on it; no fields shows an empty state with Add a field.
- My main crop: a small card on Home (crop photo, one line for today, a Change pill); Sell, Plant Doctor and crop pages open on it. Change also in About.

### v12.7 notes
- **Twi:** one EN/Twi chip in the top bar. Screens stay written in English; `js/twi.js` swaps the words on the page (dictionary first, then Khaya, kept on the phone), so there is one source of truth and nothing to keep in sync. Farmer's own words, place names and source titles are marked `data-notw`. Listen in Twi uses Khaya's voice; if it fails Walɔ says so and reads in English.
- **Offline:** a dark "Offline" chip; anything that needs internet turns grey with a "Needs internet" tag and opens one plain sheet listing what still works. Plant now says "Using usual weather (no forecast offline)".
- **Get help:** one button on Home and About. AI first (short spoken-style answers, a link to the right screen), a person second (Call + WhatsApp with a prefilled summary) only when a help line number is set; otherwise "A help line with a real person is coming soon".

- **English only (later on 14 Nov):** the team switched languages off until after the hackathon (`languages.enabled: ["en"]`): a half-translated screen and quota errors were worse than clean English. The EN/Twi chip, Twi Talk and Twi Listen only appear when "tw" is enabled; a phone left in Twi mode is reset to English on load.

## 15. Field Shift: rotation, the shift itself, soil and her priority (15 Nov 2026)

The challenge asks for a decision tool that helps a farmer **explore crop rotations** with NASA observations, local soil, crop characteristics and farmer priorities. Walɔ answered *when* and *where* to plant; it had nothing to say about what follows a crop.

- **`#/next/<crop>` (and `#/next/<crop>/<field>`).** Three or four crops that could follow, always including the crop already in the field so "maize again" is compared and never hidden. Each is scored 0-100 from four parts: water (the FAO-56 water balance on NASA rain, deficit as a share of need, adjusted for a sandy, loam or clay soil), soil (legume nitrogen, ground cover left behind, a same-family penalty, a bonus for a cereal after a legume), money (whether a usual price pattern exists and whether it usually rises after harvest) and heat (very hot days while it flowers). The weights are her choice: **Soil**, **Water** or **Money** (`walo.priority`). Everything is in the Why? sheet, with crop traits labelled as extension rules of thumb (IITA/MoFA guides).
- **`#/shift`.** The same NASA POWER daily record split into **1991-2014** and **2015-2025** at her point: median onset day (method 4), mean rain in the country's major-season window, and mean days above 35 °C in it. `scripts/build_shift.py` builds `data/shift.json` for all 72 towns. The screen says what moved ("Rain starts 13 days earlier than in 1991-2014"), what it means for planting, a least-squares trend over every year 1991-2025 (days per decade, mm per decade, hot days per decade), and what it is not: two periods, not a forecast, on a ~50 km grid.
- **Soil.** `data/soil.json` gives every FAO zone its usual soil (forest and transition loam, savanna and coastal sandy, highland loam) with a plain note behind it, so the screen starts local instead of from a default. Her tap overrides it for good (`walo.soil`), and the screen says Walɔ cannot test her field.
- **Evidence.** "Did this help you decide?" on the rotation screen posts only the crop and the verdict to `/api/log` (`rot_help`), so the first farmer opinions become a count the team can read.
- **Links.** Home (a row and the taller planting card), the crop page ("What to plant after it") and the field page ("After harvest · What to plant next").
