# Walo: what to plant, where, and when (Ghana)

**Team Simply Zero · NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data · Kumasi**

Walo ("helper" in Ga) is a phone-first web app for smallholder farmers. It opens straight on the task:

- **What to plant now** in my place (a town, or the phone's location).
- **Where my crop grows best** (pick a crop → best towns on a Ghana map).
- **Sick plant?** Plant Doctor: one photo + recent NASA weather → an AI answer.
- **My farm**: a field from planting to harvest (stage from NASA temperatures), today's task, when to sell.

Home has photo cards for each way in. Each answer screen has a photo band (field, crop or market) and gives **one answer**: an icon, one plain sentence, a Listen button (phone's English voice) and a quiet source line ("NASA data", "NASA data + forecast", "Price data", "AI answer"). Tapping the answer opens **Why?**: 1–3 plain sentences, with the numbers and sources folded under **Details**. No charts or tables on the main screens.

Live: https://walo-simply-zero.vercel.app

## Screens (v12, 14 Nov 2026)

| Route | Screen | Data |
| --- | --- | --- |
| `#/` | Home: What to plant now · Where my crop grows best · Sick plant? · My fields | — |
| `#/now` | One answer for the place this week (Plant after the rain on <day> / Wait: rain not here yet / Dry season now / Not planting time), then the crops in order | NASA POWER onset of rains + FAO-56, Meteomatics 10-day forecast, FAO calendar |
| `#/crop/<crop>` | Plant <crop> now / in <month> / wait; grows well / can grow / poorly here; Start planting; Where else it grows best (map + towns) | NASA POWER, EcoCrop, FAO-56 |
| `#/start[/<crop>]` | Start planting: crop → field photo (optional, stays on the phone) → when (today / another day, never in the future / plan for the next window) | — |
| `#/farm[/<id>]` | My fields; one field: stage pictures, harvest date, today's task, one alert, sell line near harvest, Add photo / Check plant / Sell | NASA POWER daily (growing degree days), NASA MODIS NDVI (in Why?) |
| `#/sell/<crop>[/<field>]` | "Usually best in June, at Ejura market (2 km)"; for a field: "Store if you can: prices usually rise by <month>" or "Sell soon after harvest"; data years and unit always shown | WFP/HDX 2015–2023 seasonal index, MoFA SRID 2025 |
| `#/doctor/<crop>[/<field>]` | Plant Doctor: three ways in, **Take photo / Talk / Type** (photo, words, or both). Staged progress with Cancel → answer, today's step, visible warning, Listen. With words only the AI may ask one short question first; when unsure it asks for one named photo | Google Gemini (server), NASA POWER daily |
| `#/backup` | Optional "Back up my fields": email → one-time code → "Your fields are backed up"; Sign out keeps the fields on the phone | Supabase (Auth + Postgres + Storage) |
| `#/about` | Data sources, limits, AI use, credits (behind the (i) on Home) | — |

Tabs: **Home · My farm · Sell · Doctor**. The place chip in the top bar changes the place anywhere. On a wide screen the app sits in a phone-width column.

## Methods (equations in DESIGN.md §14)

- **Suitability class** S1/S2/S3/S3−/N: EcoCrop temperature × rain (Ramirez-Villegas et al. 2013; FAO 1976 classes), capped by the FAO-56 water balance (WRSI, Frère & Popov 1979) at the usual onset. Shown as "Grows well / Can grow / Grows poorly".
- **Onset of rains:** Sivakumar (1988) on NASA POWER daily rain 1991–2025; 20th/50th/80th percentiles (Stern et al. 1982). The same rule is applied to the 10-day forecast: if the forecast has no planting rain, Walo says "Wait: rain not here yet", so the climatology and the forecast never disagree on screen.
- **Heat:** days above the crop's critical temperature at flowering (maize/rice 35 °C, Sánchez et al. 2014).
- **Field stage:** growing degree days (McMaster & Wilhelm 1997) from NASA POWER daily since planting; FAO-56 stage lengths.
- **Selling:** WFP seasonal price index for the nearest market with data; "store" only if the usual price within `sell.store_window_months` after harvest is at least `sell.store_gain_min` above the harvest month.
- Every threshold is in `data/rules.json` with its source; values with no single standard are marked `default: true` with a note.

## Files

```
index.html, styles.css            page shell; design tokens at the top of styles.css
js/main.js                        router (location.hash), top bar, tabs
js/data.js                        the one data layer: loads data/*.json, all decisions (uses lib/agro.js + data/rules.json)
js/store.js                       state on the phone: place, crop, fields (localStorage), photo storage (IndexedDB)
js/ui.js                          components: answer card + Why? sheet, Listen, buttons, rows, bottom sheet
js/screens/*.js                   home, now, crop, farm, start, sell, doctor, about, pickers, words
js/photo.js                       the one photo path (Plant Doctor, Add photo, Start planting): two static inputs in index.html opened by <label for> (gallery has no capture), file copied into memory at once, instant preview, resize with a time limit, HEIC fallback, "phone closed Walo" notice
js/twi.js                         DORMANT (languages.enabled = en): Twi (GhanaNLP Khaya via api/twi.js): EN/Twi chip, swaps page words (data/i18n-tw.json, then on-the-fly), Twi Listen, Twi Talk
js/net.js                         online/offline (navigator.onLine + failed /api or outside calls): Offline chip, [data-net] "Needs internet" tags
js/screens/help.js                Get help: AI helper (api/help.js) first, Call/WhatsApp to data/app.json support.phone second
js/log.js                         tiny client log (event names, sizes, types, browser family; no photos, words or places) -> api/log.js
js/sync.js                        optional backup: Supabase sign-in by email code, local-first sync (push on change, pull on sign-in, newest copy wins)
js/util.js, js/icons.js           helpers; Lucide icons (ISC)
lib/supabase.js                   supabase-js 2.119.0 UMD (MIT, licenses/supabase-js-MIT.txt), loaded only when backup is used
lib/agro.js                       methods (FAO-56 ET0/WRSI, onset, EcoCrop, GDD); shared with scripts/build_agro.js
api/diagnose.js                   Plant Doctor (Vercel function): photo(s) + NASA POWER 14-day weather -> Gemini -> strict JSON
api/forecast.js                   Meteomatics 10-day forecast proxy, cached 3 h
api/twi.js                        GhanaNLP Khaya: translate (v2 en-tw / tw-en), TTS v1 (tw, CDN-cached wav), ASR v3 (twi); limits, timeouts, no content logs
api/help.js, api/_gemini.js       Get help (Gemini, data/help.json facts); shared Gemini model choice for diagnose + help
api/_budget.js                    daily AI cap across all instances (public.walo_ai_hit in supabase/schema.sql); falls back to the per-IP limits
sw.js, manifest.json, icon.svg    offline cache (walo-v23, exactly the shipped files; /api/ never cached; each file cached on its own so one miss cannot break install), Add to Home Screen
data/app.json                     settings: default place/crop, endpoints, Plant Doctor photo size, demo field, zone names
data/rules.json                   every method threshold + its source
data/places.json                  17 towns: coordinates, region, FAO zone
data/agro.json                    NASA POWER daily 1991–2025 summaries per town (ET0, Peff, onset percentiles, hot days)
data/ndvi.json                    NASA MODIS MOD13Q1 NDVI per town (2016–2025 + latest), via Planetary Computer
data/crops.json                   19 crops: zones, windows with sources, EcoCrop ranges, FAO-56 Kc and stage lengths, tasks
data/market.json                  one price series per market and crop (20 WFP markets) + MoFA SRID 2025
data/credits.json, ghana-map.json photo credits; Ghana outline (Natural Earth)
scripts/                          data builders and their full outputs (not deployed)
```

## Server set-up (Vercel environment variables, never in the code or the zip)

| Variable | Used by |
| --- | --- |
| `GEMINI_API_KEY` | `api/diagnose.js` (optional `GEMINI_MODEL` to pin a model) |
| `METEOMATICS_USER`, `METEOMATICS_PASS` | `api/forecast.js` |
| `KHAYA_API_KEY` | `api/twi.js` (GhanaNLP Khaya; Twi, dormant while `languages.enabled` is English only) |

`GEMINI_API_KEY` is also used by `api/help.js`.

Without them the app still works: Plant Doctor says it is not set up, and "Plant now" uses NASA climatology only. Photos (all screens, `js/photo.js`, settings in `data/app.json` → `photo`) are resized on the phone to 768 px JPEG (quality 0.7). For Plant Doctor, if the browser cannot open a photo (some HEIC photos), the original is sent when it is under 2.4 MB (Gemini reads HEIC); otherwise the farmer is asked for a JPG. Talk uses the browser's speech recognition (en-GH, then en-US) and is hidden where the browser has none. The server logs only counts, sizes and types of each check, never the photo or words; the server tries the fastest Flash-Lite model first (12 s limit), then Flash models, within 38 s; the phone gives up at 45 s and has a Cancel button. 8 checks per 10 min per IP. Plant Doctor shows no weather claim (weather cannot name a disease); the server still gives the AI recent NASA weather as background only. Crop lists for a place (Plant now, Start planting) are grouped by when you can plant: plant now, plant now if you can water, plant soon (within `crop_groups.soon_months`), later this year, and a folded "Doesn't grow well here" (`data/app.json` → `crop_groups`).

## Optional backup (Supabase project `walo`, free plan)

Walo works fully without an account. "Back up my fields" (My farm, About) signs in with a one-time code sent by email, then copies fields and their photos to Supabase so they come back on a new phone.

- **Client:** only the project URL and the *publishable* key, in `data/app.json` (`backup`). Both are meant to be public; access is controlled by row-level security. No service-role key anywhere.
- **Data:** table `public.fields` (`user_id` default `auth.uid()`, `id` = the field's uid, `data` jsonb, `deleted`, `updated_at`; primary key `(user_id, id)`), RLS on, four policies `auth.uid() = user_id`, no access for `anon`. Photos in the private bucket `field-photos` under `<user id>/<field uid>/<photo>.jpg` (2 MB, jpeg/webp/png), with policies that only allow a user's own folder.
- **Sync:** fields stay in localStorage and photos in IndexedDB. Changes are pushed 1.5 s later; on sign-in everything is pulled; when both sides changed, the newest `updated` wins; a removed field is pushed as `deleted` and its photos are removed. The demo field is never uploaded.
- **Dashboard settings needed (Supabase → Authentication):** (1) Email Templates → *Magic Link* and *Confirm signup*: add `{{ .Token }}` so the email shows the 6-digit code (until then the email has a sign-in link, which also works); (2) URL Configuration → Site URL `https://walo-simply-zero.vercel.app` and add it to Redirect URLs; (3) SMTP Settings → a custom SMTP sender (for example a free Resend or Brevo account), because the built-in sender is rate-limited and meant for testing. Phone (SMS) codes would need a paid SMS provider (Twilio, MessageBird, Vonage or Textlocal) set under Providers → Phone.

## Regenerate the data

```
python3 scripts/build_crops.py      # scripts/data/crops_full.json from walo-crops.json (also rewrites data/credits.json)
python3 scripts/fix_crops_v7.py     # sourced fixes
python3 scripts/fix_crops_v8.py     # Rain forest + Coastal savanna zones, zone confidence
python3 scripts/add_fao56.py        # FAO-56 Kc + stage lengths
python3 scripts/build_markets.py    # scripts/data/market_full.json: 20 WFP markets, seasonal index, outliers listed
python3 scripts/finalize_data.py    # writes the app's data/crops.json, data/market.json, data/places.json (only what the app reads)
python3 scripts/fetch_agro.py       # NASA POWER daily 1991-2025 for the 17 towns -> /tmp/agro
node scripts/build_agro.js          # -> data/agro.json (lib/agro.js + data/rules.json)
python3 scripts/build_ndvi.py       # NASA MODIS NDVI via Planetary Computer -> data/ndvi.json
```

## Run locally

```
python3 -m http.server 8000   # then open http://localhost:8000 (the /api functions need `vercel dev`)
```

## Limits

- NASA POWER cells are about 50 km wide: town scale, not field scale. Methods describe the usual year; the 10-day forecast is the only "this year" input.
- FAO gives fewer dated windows for the Rain forest and Coastal savanna zones, so more answers there are best guesses.
- Prices: WFP/HDX to July 2023 for 20 markets; MoFA SRID 2025 for one market and without units. Distances are straight-line.
- EcoCrop ranges are global. NDVI at town points includes built-up land. Plant Doctor is AI and can be wrong.
- Backup: email codes need the dashboard settings above; there is no phone-number sign-in yet. Only one phone should edit the same field at a time (the newest change wins).
- English only for now (`data/app.json` → `languages.enabled: ["en"]`). The Twi code (`js/twi.js`, `api/twi.js`, `data/i18n-tw.json`, GhanaNLP Khaya) is dormant: no chip, nothing sent to Khaya, `/api/twi` returns 404. To re-enable after the hackathon: refill the Khaya quota, complete the labels with `scripts/build_i18n_tw.py`, have a Twi speaker check them, then add "tw" to `languages.enabled`. The Khaya free quota ran out after about 100 calls on 14 Nov. Listen uses the phone's own English voice.
- Offline: What to plant, crop pages, My farm and Sell work from the offline copy; Plant Doctor, forecast, Talk, Get help, backup and "Use my location" show "Needs internet".
- Get help's person option is hidden until `support.phone` is set in `data/app.json`. The demo field is made-up data and is tagged "Demo".

Licence: Apache 2.0.

**Focus on the farmer's own crops (v12.6).** Sell (`#/sell`) opens on the farmer's own fields: one photo card per field (main crop first) with its harvest, store-or-sell-now advice tied to that harvest, the nearest market to that field, the price years and unit; one field opens straight on it; no fields shows "Add your field to see when to sell". "Check another crop" is a small option at the bottom. "My main crop" (`js/store.js` mainCrop: a choice, or auto = the crop of most of your fields) is shown on Home with today's one line, can be changed on Home or About, and is where Sell, Plant Doctor and crop pages open. With backup on, it syncs as one settings row (`data/app.json` → `backup.settings_id`).
