# Handoff

Status on **14 November 2026**, after the live deploy `dpl_CHUzrfUQkVGaUMReutssEamCsPrJ` (service worker cache `walo-v26`). The hackathon build is English only. Team Simply Zero. Live site: [https://walo-simply-zero.vercel.app](https://walo-simply-zero.vercel.app). Vercel project name: **walo-simply-zero**. Supabase project ref: **yceufknddlcrezefaivi** (`https://yceufknddlcrezefaivi.supabase.co`).

Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_PIPELINE.md](DATA_PIPELINE.md), [METHODS.md](METHODS.md), [app/README.md](../app/README.md), [app/DESIGN.md](../app/DESIGN.md) (the English-only note is at the end of the v12.7 section), and [app/AI_USE.md](../app/AI_USE.md).

## What is in this repository

`app/` matches that deploy. `data/app.json` → `languages.enabled` is `["en"]`.

- `js/twi.js` exports `twiOn()`. It is false, so the EN/Twi chip, Twi crop names, Twi Listen, and Twi Talk do not render. On load, `apply()` removes a saved `walo.lang` of `tw` and the on-phone Twi phrase cache, then leaves the page in English.
- `api/twi.js` returns 404 for every request while `"tw"` is not in `languages.enabled`. Khaya is not called. `KHAYA_API_KEY` can stay set; it is unused until the flag changes.
- `data/i18n-tw.json` is kept (126 of 222 labels, `reviewed_by_twi_speaker` false). It is not in the `walo-v26` precache.
- Get help and the offline chip are unchanged in behaviour: Gemini first, person handover hidden while `support.phone` is empty, Offline chip and “Needs internet” tags from `js/net.js`. The helper’s facts now say Walo is in English for now.

To turn the existing Twi path back on later: finish and review the labels, then add `"tw"` to `languages.enabled`. Do not do that for the hackathon. `app/README.md` and `app/AI_USE.md` say the same thing.

`app/.vercelignore` still excludes `scripts/`. Prices in `data/market.json` still end in July 2023.

## What already works

- Place → what to plant now, and crop → where it grows best, for 17 towns and 19 crops.
- Start planting, My farm, Sell, Plant Doctor (when `GEMINI_API_KEY` is set), Get help’s AI path, and the Offline chip.
- English Listen, using the phone’s own voice.

## Review fixes, 14 November 2026

These came out of a code and data review, and are done:

1. **The Supabase schema is in the repo.** `supabase/schema.sql` now holds the `fields` table, its four row-level-security policies, the private `field-photos` bucket and its four per-owner policies, and the AI budget. Apply it once in the Supabase SQL editor. Before this file it was dashboard-only state that could not be reviewed or restored.
2. **A hard daily cap on AI calls.** `public.walo_ai_hit()` counts calls in Postgres and returns `allowed`. The cap (400 a day) is a constant inside the function, so the browser cannot raise it. `api/_budget.js` calls it from `api/diagnose.js` and `api/help.js`; the per-IP limits still run first. If the SQL is missing or Supabase does not answer, the check returns null and the app keeps answering on the per-IP limits alone. Trade-off: anyone who can call the function can spend the day's budget.
3. **Offline install can no longer fail as a whole.** `sw.js` caches each file with `Promise.allSettled` and reports the failures; cache is `walo-v26`. `js/main.js` re-checks for a new version on return to the screen and hourly.
4. **The answer card is no longer a button.** It keeps a tap-to-open for sighted users, but `role="button"`, `tabindex` and the nested-control problem are gone; "Why?" is a real `<button>` with a 44 px target. TalkBack and VoiceOver now get one focusable control.
5. **"Dry season now" comes from the place, not a crop.** `js/screens/now.js` asks the place's growing period (`rain >= 0.5 ET0` this month). When the month is in the growing period but crops are still water-limited, the answer says "Plant only if you can water" instead.
6. **Price vintage is in the answer, not only a footnote.** Sell says "Prices to <year>" in the answer, and the note under it names the newest price in the data (July 2023) and says to ask at the market. The About page says the same.
7. **Docs corrected.** `DESIGN.md` §4 no longer claims "~130 KB, no web fonts, no images except inline SVG" for an app that ships 2.1 MB. Cache versions and file lists across README, ARCHITECTURE, app/README and this file are current.

8. **The deployed voice chat is back in git.** Production was ahead of this repo: a bot on another computer built the Get help hands-free voice chat and deployed it with the Vercel CLI, so it existed only in that build. It was recovered from the live site into `js/screens/help.js`, `js/styles.css`, `js/main.js` and `data/app.json`, and the review fixes were re-applied on top. Cache is `walo-v26`.

9. **Country is data, not code.** `data/countries.json` now owns the accepted coordinates, the currency, the onset search windows, zone names, the map and source labels. `js/data.js` exposes `country()`, `currency()`, `inCountry()`, `onsetRules()`; `api/_country.js` does the same check on the server, so `/api/forecast` and `/api/diagnose` refuse anything Ghana's box does not cover. Ghana's numbers were copied into the file unchanged, and the server check was tested: a Ghana point reaches the handler, Nairobi and London get 400. Read [EXPANSION.md](EXPANSION.md) before adding a country — the honest list of what is still Ghana-only is in there, and `nearestTown()` crossing borders is the first thing that will bite.

### Deployment is not wired to git

The live site is deployed by hand from that other computer (`vercel --prod` with Root Directory `app`), not by pushing to `main`. A push here does not change production. To ship: run `vercel --prod` from `app/` on a machine with the Vercel CLI, or reconnect the project to GitHub so `main` deploys.

Lost unless recovered from that computer: the My farm field-card change (days since sowing, progress bar, days to harvest). It was described but never deployed and is not in this repository.

Still open, in priority order: **refresh the price data** (it ends July 2023, and Sell is the screen with money at stake), then the items below.

## Still to do

Do these in this order. Do not invent a phone number, a translation, or a new key value in the repo. Leave `languages.enabled` as `["en"]` until after the hackathon.

1. **Languages, after the hackathon.** Build a language picker for Twi, Ga, Ewe, Fante, and Dagbani through GhanaNLP Khaya. Pre-translate each language, and show it only when that language’s text is complete and a speaker of that language has reviewed it. The half-finished Twi dictionary (126 of 222 labels) is the reason the chip is off: a partial machine translation was worse than clean English. `scripts/build_i18n_tw.py` is the Twi label builder; Khaya’s free quota refills about 16 Nov 2026, 15:00 GMT. Keep `reviewed_by_twi_speaker` false until a Twi speaker signs off. The same bar applies to Ga, Ewe, Fante, and Dagbani before any of them appears in the picker.

2. **Set `support.phone`.** When the team has a number, put it in `data/app.json` under `support.phone` and `support.whatsapp` as international digits with no plus (shape `233XXXXXXXXX`). Until then the person option correctly says the help line is coming soon. Do not invent a number.

3. **Real-phone camera and gallery re-test.** `js/photo.js` and the two inputs in `index.html` (`#walo-camera` has `capture`, `#walo-gallery` does not). Screens open them with `<label for>`. On a low-cost Android phone, test Plant Doctor, Add photo, and Start planting: take a picture, pick one from the gallery, and background the browser while the camera is open. `api/log.js` records event names and sizes only.

4. **Supabase OTP dashboard, project `yceufknddlcrezefaivi`.** The table, bucket, and row-level security are already in place. Still set:
   - Authentication → URL configuration: Site URL `https://walo-simply-zero.vercel.app`, and that origin in Redirect URLs.
   - Email templates for Magic Link and Confirm signup: include `{{ .Token }}` so the email shows the 6-digit code. Until then the mail has a link, which also signs the farmer in.
   - A custom SMTP sender if the built-in mailer rate limit gets in the way.
   - Never copy the service-role key into the repo, into `app.json`, or into the browser.

5. **Rotate keys after the hackathon.** Replace `GEMINI_API_KEY`, `METEOMATICS_USER`, `METEOMATICS_PASS`, and `KHAYA_API_KEY` in the Vercel project, and rotate the Supabase keys in the dashboard. The publishable key in `app/data/app.json` is public by design; if it is rotated, update that file in the same change. Do not commit the new secret values.

## Small things to fix when you are already editing that copy

- `data/help.json` tells the helper the NASA record is 2001–2024. The climate files use 1991–2025 (`data/app.json` → `periods.agro`). Correct that sentence the next time you edit the helper’s facts. It was left unchanged so this import did not alter data values.
- `app/README.md` still ends with “Licence: Apache 2.0.” The repository license is MIT (`LICENSE`). Leave the app README unless the team wants that sentence updated. It was imported with the app.
- `scripts/build_crops.py` and `scripts/fix_crops_v8.py` need `walo-crops.json` and other files that were not in the archive. Do not re-run them on a clone. `scripts/data/crops_full.json` is the crop artifact.

## How to continue without breaking the product

- Keep decisions in `js/data.js` and `lib/agro.js`. Screens should ask those modules, not reimplement a threshold.
- New thresholds go in `data/rules.json` with a source, or with `default: true` and a note.
- One answer on a screen: icon, one sentence, Listen, a quiet source line. Charts and tables stay off the main screens.
- If the service-worker file list changes, change the `CACHE` string in `sw.js` (now `walo-v26`) so old caches are deleted. Install now caches each file separately and reports any failure to `/api/log` as `sw_missing`, so a renamed file shows up in the log instead of silently removing offline support.
- Before a data rebuild, read [DATA_PIPELINE.md](DATA_PIPELINE.md). After an `agro.json` rebuild, check Ejura maize onset against [METHODS.md](METHODS.md) (20th percentile 15 March, median 2 April, 80th percentile 26 April).
- Run `python3 proof/walo_proof.py --help`, parse every JSON file, and `node --check` the JavaScript before you push. The proof script’s full NASA run needs a network.
- Secrets: the only key that belongs in git is the Supabase publishable key already in `data/app.json`. A scan of this import found that key and no others.

## Pitch material

[presentation/walo-checkin-v2.pptx](../presentation/walo-checkin-v2.pptx) is the check-in deck. The “ten years ago versus recently” comparison belongs in the talk. The proof script prints it. The app does not.
