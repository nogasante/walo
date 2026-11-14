# Handoff

Status on **14 November 2026**, after the live deploy `dpl_9N6fgjj6Xw7MQV4pcQELVu2MnWLt` (service worker cache `walo-v21`). Team Simply Zero. Live site: [https://walo-simply-zero.vercel.app](https://walo-simply-zero.vercel.app). Vercel project name: **walo-simply-zero**. Supabase project ref: **yceufknddlcrezefaivi** (`https://yceufknddlcrezefaivi.supabase.co`).

Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_PIPELINE.md](DATA_PIPELINE.md), [METHODS.md](METHODS.md), [app/README.md](../app/README.md), [app/DESIGN.md](../app/DESIGN.md) section 13b and section 14, and [app/AI_USE.md](../app/AI_USE.md) (v12.7 is the Twi, offline, and Get help note).

## What is in this repository

`app/` matches that deploy. Twi, the offline chip, and Get help are in the tree:

- `api/twi.js` calls GhanaNLP Khaya (translate v2 en-tw and tw-en, TTS, ASR). `KHAYA_API_KEY` stays on the server. HTTP 403 and 429 start a backoff and the phone is told Twi is resting.
- `data/i18n-tw.json` holds **126 of 222** fixed labels. Khaya’s free quota ran out while `scripts/build_i18n_tw.py` was running. It refills about **16 Nov 2026, 15:00 GMT**. `reviewed_by_twi_speaker` is false. Labels that are missing stay in English, or are translated on the phone once Khaya answers.
- `api/help.js` and `api/_gemini.js` are the Gemini support chat. `js/screens/help.js` reads `D.help` (loaded with the other JSON). “Talk to a person” is `tel:` and `wa.me` from `data/app.json` → `support.phone` / `support.whatsapp`. Both are empty, so the screen says a help line is coming soon.
- `js/net.js` plus the top-bar Offline chip and the “Needs internet” tags. Plant now says it is using the last saved forecast when one exists, and usual weather when it does not.

`app/.vercelignore` still excludes `scripts/`. Prices in `data/market.json` still end in July 2023.

## What already works

- Place → what to plant now, and crop → where it grows best, for 17 towns and 19 crops.
- Start planting, My farm, Sell, Plant Doctor (when `GEMINI_API_KEY` is set).
- Get help’s AI path, the Offline chip, and the EN/Twi chip.
- English Listen. Twi Listen and Talk when Khaya has quota and the key is set.

## Still to do

Do these in this order. Do not invent a phone number, a Twi spelling, or a new key value in the repo.

1. **Finish the Twi labels after the quota refill, then get a native-speaker review.** Around 16 Nov 2026 15:00 GMT, run `scripts/build_i18n_tw.py` against a label list and a running `/api/twi` (see [DATA_PIPELINE.md](DATA_PIPELINE.md)). The script keeps strings already in `data/i18n-tw.json`, so the re-run should only spend quota on the missing labels. Leave `reviewed_by_twi_speaker` false until a Twi speaker has checked the fixed labels, the crop names, and a sample of spoken answers. Town names and “Walo” stay in English.

2. **Hide “Talk in Twi” while the quota is out.** Plant Doctor (`js/screens/doctor.js`) and Get help (`js/screens/help.js`) show “Tap and talk in Twi” whenever `asrReady()` is true. That flag means the key is configured and the browser can record. It stays true during a Khaya 403/429. While `js/twi.js` is inside `restUntil` (or the status call says Twi is resting), hide that button and keep Type. The local rest is `data/app.json` → `twi.rest_ms` (10 minutes). That is not the provider’s refill clock.

3. **Set `support.phone`.** When the team has a number, put it in `data/app.json` under `support.phone` and `support.whatsapp` as international digits with no plus (shape `233XXXXXXXXX`). Until then the person option correctly says the help line is coming soon. Do not invent a number.

4. **Real-phone camera and gallery re-test.** `js/photo.js` and the two inputs in `index.html` (`#walo-camera` has `capture`, `#walo-gallery` does not). Screens open them with `<label for>`. On a low-cost Android phone, test Plant Doctor, Add photo, and Start planting: take a picture, pick one from the gallery, and background the browser while the camera is open. `api/log.js` records event names and sizes only.

5. **Supabase OTP dashboard, project `yceufknddlcrezefaivi`.** The table, bucket, and row-level security are already in place. Still set:
   - Authentication → URL configuration: Site URL `https://walo-simply-zero.vercel.app`, and that origin in Redirect URLs.
   - Email templates for Magic Link and Confirm signup: include `{{ .Token }}` so the email shows the 6-digit code. Until then the mail has a link, which also signs the farmer in.
   - A custom SMTP sender if the built-in mailer rate limit gets in the way.
   - Never copy the service-role key into the repo, into `app.json`, or into the browser.

6. **Rotate keys after the hackathon.** Replace `GEMINI_API_KEY`, `METEOMATICS_USER`, `METEOMATICS_PASS`, and `KHAYA_API_KEY` in the Vercel project, and rotate the Supabase keys in the dashboard. The publishable key in `app/data/app.json` is public by design; if it is rotated, update that file in the same change. Do not commit the new secret values.

## Small things to fix when you are already editing that copy

- `data/help.json` tells the helper the NASA record is 2001–2024. The climate files use 1991–2025 (`data/app.json` → `periods.agro`). Correct that sentence the next time you edit the helper’s facts. It was left unchanged so this import did not alter data values.
- `app/README.md` still ends with “Licence: Apache 2.0.” The repository license is MIT (`LICENSE`). Leave the app README unless the team wants that sentence updated. It was imported with the app.
- `scripts/build_crops.py` and `scripts/fix_crops_v8.py` need `walo-crops.json` and other files that were not in the archive. Do not re-run them on a clone. `scripts/data/crops_full.json` is the crop artifact.

## How to continue without breaking the product

- Keep decisions in `js/data.js` and `lib/agro.js`. Screens should ask those modules, not reimplement a threshold.
- New thresholds go in `data/rules.json` with a source, or with `default: true` and a note.
- One answer on a screen: icon, one sentence, Listen, a quiet source line. Charts and tables stay off the main screens.
- If the service-worker file list changes, change the `CACHE` string in `sw.js` (now `walo-v21`) so old caches are deleted.
- Before a data rebuild, read [DATA_PIPELINE.md](DATA_PIPELINE.md). After an `agro.json` rebuild, check Ejura maize onset against [METHODS.md](METHODS.md) (20th percentile 15 March, median 2 April, 80th percentile 26 April).
- Run `python3 proof/walo_proof.py --help`, parse every JSON file, and `node --check` the JavaScript before you push. The proof script’s full NASA run needs a network.
- Secrets: the only key that belongs in git is the Supabase publishable key already in `data/app.json`. A scan of this import found that key and no others.

## Pitch material

[presentation/walo-checkin-v2.pptx](../presentation/walo-checkin-v2.pptx) is the check-in deck. The “ten years ago versus recently” comparison belongs in the talk. The proof script prints it. The app does not.
