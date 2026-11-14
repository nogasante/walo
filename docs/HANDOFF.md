# Handoff

Status on **14 November 2026**, after the live deploy `dpl_CHUzrfUQkVGaUMReutssEamCsPrJ` (service worker cache `walo-v22`). The hackathon build is English only. Team Simply Zero. Live site: [https://walo-simply-zero.vercel.app](https://walo-simply-zero.vercel.app). Vercel project name: **walo-simply-zero**. Supabase project ref: **yceufknddlcrezefaivi** (`https://yceufknddlcrezefaivi.supabase.co`).

Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_PIPELINE.md](DATA_PIPELINE.md), [METHODS.md](METHODS.md), [app/README.md](../app/README.md), [app/DESIGN.md](../app/DESIGN.md) (the English-only note is at the end of the v12.7 section), and [app/AI_USE.md](../app/AI_USE.md).

## What is in this repository

`app/` matches that deploy. `data/app.json` → `languages.enabled` is `["en"]`.

- `js/twi.js` exports `twiOn()`. It is false, so the EN/Twi chip, Twi crop names, Twi Listen, and Twi Talk do not render. On load, `apply()` removes a saved `walo.lang` of `tw` and the on-phone Twi phrase cache, then leaves the page in English.
- `api/twi.js` returns 404 for every request while `"tw"` is not in `languages.enabled`. Khaya is not called. `KHAYA_API_KEY` can stay set; it is unused until the flag changes.
- `data/i18n-tw.json` is kept (126 of 222 labels, `reviewed_by_twi_speaker` false). It is not in the `walo-v22` precache.
- Get help and the offline chip are unchanged in behaviour: Gemini first, person handover hidden while `support.phone` is empty, Offline chip and “Needs internet” tags from `js/net.js`. The helper’s facts now say Walo is in English for now.

To turn the existing Twi path back on later: finish and review the labels, then add `"tw"` to `languages.enabled`. Do not do that for the hackathon. `app/README.md` and `app/AI_USE.md` say the same thing.

`app/.vercelignore` still excludes `scripts/`. Prices in `data/market.json` still end in July 2023.

## What already works

- Place → what to plant now, and crop → where it grows best, for 17 towns and 19 crops.
- Start planting, My farm, Sell, Plant Doctor (when `GEMINI_API_KEY` is set), Get help’s AI path, and the Offline chip.
- English Listen, using the phone’s own voice.

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
- If the service-worker file list changes, change the `CACHE` string in `sw.js` (now `walo-v22`) so old caches are deleted.
- Before a data rebuild, read [DATA_PIPELINE.md](DATA_PIPELINE.md). After an `agro.json` rebuild, check Ejura maize onset against [METHODS.md](METHODS.md) (20th percentile 15 March, median 2 April, 80th percentile 26 April).
- Run `python3 proof/walo_proof.py --help`, parse every JSON file, and `node --check` the JavaScript before you push. The proof script’s full NASA run needs a network.
- Secrets: the only key that belongs in git is the Supabase publishable key already in `data/app.json`. A scan of this import found that key and no others.

## Pitch material

[presentation/walo-checkin-v2.pptx](../presentation/walo-checkin-v2.pptx) is the check-in deck. The “ten years ago versus recently” comparison belongs in the talk. The proof script prints it. The app does not.
