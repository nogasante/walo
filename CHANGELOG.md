# Changelog

## 2026-11-14 — first run, a real sign-in door, and looking stops moving the farm

Cache `walo-v28`.

### Added

- **First run** (`#/welcome`, `js/screens/welcome.js`): one screen asking *where is your farm*, then *what do you mainly grow*, with **Use my location** and a town list. No town is chosen for her. It only appears when no place has ever been chosen and there is no real field to read one from — an existing farmer never sees it.
- **Sign-in door**: the backup screen is now **"Sign in or back up"**, and the first-run screen links to it, so a farmer with a new phone can find her way back to her fields. Nothing was added to accounts: it is still an email plus a one-time code, and it is still optional.

### Changed

- Tapping a town in *Where my crop grows best* used to call `setPlace()` — browsing moved her farm. It now shows that town's answer inside the sheet, with **Make this my farm** as the only thing that changes anything.
- The backup card on My farm reads **"Sign in or back up — your email is enough, no password"**.

### Not changed

- `farmPlace()` already kept a GPS field's own `place`, so a GPS farm was never turned into Ejura; the fallback only touches fields with no location at all. The remaining Ejura default in `store.place()` is now unreachable for a real farmer, because first run always sets a place.

## 2026-11-14 — country becomes data

First step toward running outside Ghana. No country names are left in the code that change behaviour;
Ghana's numbers were copied into the new file unchanged, so its answers are identical. Cache `walo-v26`.

### Added

- `data/countries.json`: accepted coordinates, currency, onset search windows (with hemisphere), zone names, map, source labels, language, and a `status` gate so an unreviewed country can never be selected.
- `api/_country.js`: the same bbox check for `/api/forecast` and `/api/diagnose`, so the server accepts exactly the countries the app offers.
- `docs/EXPANSION.md`: what a country owns, what is still Ghana-only, and the three countries worth proving first.

### Changed

- `js/data.js` exposes `country()`, `currency()`, `inCountry()`, `onsetRules()`; `zoneName()` prefers the country's zones.
- Sell prints the country's currency instead of the `GHS` literal; `js/screens/crop.js` and `about.js` take their labels from the country; Plant Doctor and Get help name the country from the coordinate instead of saying Ghana.
- `scripts/build_agro.js` reads the country's onset windows, so the data pipeline and the phone cannot disagree.
- "Use my location" refuses a point outside every supported country with a plain message instead of silently using a Ghanaian town.

### Not changed

- The season windows for a southern-hemisphere country are a config entry now, but no such country exists yet: `crops.json` is still keyed by Ghana's zones, `nearestTown()` still searches every town, and the map is still Ghana's outline. See EXPANSION.md.

## 2026-11-14 — recover the deployed voice chat into the repo

Production was ahead of this repository. A bot on another computer built the Get help
hands-free voice chat and deployed it from that computer with the Vercel CLI, so the
feature existed only in that build and in that machine's folder. Recovered from the
live site into the repo, then re-applied the review fixes on top of it.

### Added

- `js/screens/help.js`: hands-free voice chat (one tap listens, the phone speaks the answer, then it listens again), with Stop, silence limits, mic-blocked and offline fallbacks, and an iPhone tap-to-continue path. `voiceOn()` is exported so a re-render does not cut off speech.
- `data/app.json` → `support.voice` (`silent_turns`, `gap_ms`, `max_speak_ms_per_char`) and the `.vc-*` styles in `styles.css`.

### Changed

- Service worker cache is `walo-v25`: the recovered files changed, so phones on `walo-v24` must drop the old cache.
- `js/main.js` carries both the voice-chat guard and the newer service-worker update check.

### Not recovered

- The My farm change the other bot described (days since sowing, progress bar, days to harvest on each field card) was never deployed and is not in this repository. `farm.js` and `home.js` here are unchanged, so that work still exists only on that computer.

## 2026-11-14 — review fixes

Changes after a code and data review. Service worker cache `walo-v23`.

### Added

- `supabase/schema.sql`: the `fields` table, its four row-level-security policies, the private `field-photos` bucket with per-owner policies, and `public.walo_ai_hit()` for the daily AI cap. Previously these existed only as dashboard state, so they could not be reviewed or restored.
- `app/api/_budget.js`: the shared daily AI cap, used by `api/diagnose.js` and `api/help.js`. The cap (400 calls a day) is a constant inside the SQL function. Missing SQL or an unreachable Supabase returns null and leaves the per-IP limits in charge.

### Changed

- `sw.js` caches each file on its own instead of `addAll`, so one missing file no longer fails the whole install and removes offline support; failures are reported to `/api/log` as `sw_missing`. `js/main.js` checks for a new version on return to the screen and hourly.
- The answer card in `js/ui.js` is no longer `role="button"` with a Listen button nested inside it. It keeps tap-to-open for sighted users, and "Why?" is now a real `<button>` with a 44 px target, which fixes the nested interactive controls for screen readers.
- "Dry season now" on `#/now` is decided by the place's growing period, not by one crop's water balance; a water-limited month that is still in the growing period now says "Plant only if you can water".
- Sell states the price vintage in the answer ("Prices to 2023") and names the newest price in the data (July 2023) in the note under it. The About page says the same.
- `app/DESIGN.md` §4 corrected: it claimed no web fonts, no photos and about 130 KB for an app that ships 2.1 MB.

## 2026-11-14

First public history of Walo, Simply Zero’s NASA Space Apps Challenge 2026 entry (Field Shift, Kumasi).

### Added

- The mobile web app under `app/`: static client, serverless functions, bundled NASA, FAO, and price data, and the data-pipeline scripts.
- NASA POWER proof script in `proof/`, check-in deck in `presentation/`, and per-crop sources in `docs/walo-crops-sources.md`.
- Repository guide: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA_PIPELINE.md`, `docs/METHODS.md`, `docs/HANDOFF.md`, `CONTRIBUTING.md`, `LICENSE` (MIT for code), `.env.example`, `.gitignore`.

### Notes

- `app/js/screens/help.js` was not in the source archive. `app/js/main.js` imports it. The file was copied from the live deployment so the app boots.
- `app/styles.css`, `app/sw.js`, `app/js/screens/home.js`, `app/js/screens/about.js`, and `app/js/screens/doctor.js` were a few lines behind the live site (offline chip, Get help links, service-worker precache). Those five files were copied from the live deployment. No file under `app/data/` was changed.
- `proof/walo_proof.py` also looks in `../app/data` for the bundled climate.
- `app/.vercelignore` excludes `scripts/` so builders are not deployed. The live site already does not serve them.

## 2026-11-14 — Twi, offline, Get help

`app/` replaced with the build deployed as `dpl_9N6fgjj6Xw7MQV4pcQELVu2MnWLt` (service worker `walo-v21`).

### Added

- GhanaNLP Khaya through `api/twi.js` (translate v2, TTS, ASR, quota backoff) and the EN/Twi chip. `data/i18n-tw.json` has 126 of 222 labels.
- Offline chip and “Needs internet” tags (`js/net.js`).
- AI-first Get help (`api/help.js`, `api/_gemini.js`). Talk to a person stays hidden while `support.phone` is empty.

## 2026-11-14 — English only

`app/` replaced with deploy `dpl_CHUzrfUQkVGaUMReutssEamCsPrJ` (service worker `walo-v22`).

### Changed

- `data/app.json` → `languages.enabled` is `["en"]`. That flag gates `js/twi.js`. `api/twi.js` returns 404. The EN/Twi chip and Twi messages are gone, and a saved Twi preference is cleared on load. `data/i18n-tw.json` stays in the repo for after the hackathon.
