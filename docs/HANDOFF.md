# Handoff

Status on **14 November 2026**. Team Simply Zero. Live site: [https://walo-simply-zero.vercel.app](https://walo-simply-zero.vercel.app). Vercel project name: **walo-simply-zero**. Supabase project ref: **yceufknddlcrezefaivi** (`https://yceufknddlcrezefaivi.supabase.co`).

Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_PIPELINE.md](DATA_PIPELINE.md), [METHODS.md](METHODS.md), [app/README.md](../app/README.md), [app/DESIGN.md](../app/DESIGN.md) section 13b and section 14, and [app/AI_USE.md](../app/AI_USE.md).

## What is in this repository

The archive imported into `app/`, `proof/`, and `presentation/` is the app as it stood on 14 Nov 2026. Data files under `app/data/` are byte-for-byte the archive. They were not regenerated.

The archive was a few files behind the live deployment. These were copied from the live site so a clone matches what farmers open, and so `js/main.js` can load:

- `app/js/screens/help.js` was missing. `main.js` imports it. Without the file the app does not boot.
- `app/styles.css`, `app/sw.js`, `app/js/screens/home.js`, `app/js/screens/about.js`, and `app/js/screens/doctor.js` differed by the offline chip, the Get help entry points, the precache list (`js/net.js`, `js/screens/help.js`, `data/help.json`), and the Plant Doctor offline alert. Hashes match the live URLs.

`proof/walo_proof.py` also looks in `../app/data`, so from this layout it finds the bundled climate. The older search paths are still there. [proof/HOW_TO_USE.md](../proof/HOW_TO_USE.md) now says the folder is `proof`.

`app/.vercelignore` excludes `scripts/`. The live site already returns 404 for `/scripts/`. The phone reads `data/*.json` only.

## What already works

- Place → what to plant now, and crop → where it grows best, for 17 towns and 19 crops, from NASA POWER 1991–2025, FAO calendars, FAO-56, and EcoCrop.
- Start planting, My farm (stage from growing degree days), Sell on the farmer’s own fields.
- Plant Doctor (photo, talk, or type) when `GEMINI_API_KEY` is set.
- Optional email-code backup when the Supabase dashboard settings below are done.
- English Listen. Twi toggle is wired. The strings are machine translated.
- Service worker `walo-v21`. Offline sheet lists what still works.
- Get help screen (`#/help`) and the offline chip. The help line itself is not configured.

## Still to do

Do these in this order. Do not invent a phone number, a price, or a Twi wording.

1. **Real-phone camera and gallery re-test.** The path is `js/photo.js` plus the two inputs in `index.html` (`#walo-camera` has `capture`, `#walo-gallery` does not). Screens open them with `<label for>`. Test Plant Doctor, Add photo on a field, and the Start planting photo, on a low-cost Android phone: take a picture, pick one from the gallery, and background the browser while the camera is open. The client log (`js/log.js` → `api/log.js`) records event names and sizes only. Read the Vercel logs for `walo-log` lines if a phone fails.

2. **Offline chip and Get help, on that same phone.** Confirm the Offline chip, the grey “Needs internet” tag, Get help from Home and About, Talk and Type, and Cancel. Get help is Gemini via `/api/help` with `data/help.json`. When the model is unsure, or the farmer asks for a person, the screen offers Call and WhatsApp only if `data/app.json` → `support.phone` or `support.whatsapp` is set. Both are empty strings. The screen then says a help line is coming soon. When the team has a number, set it in international digits with no plus (example shape `233XXXXXXXXX`). Leave it empty until then.

3. **Twi.** Set `KHAYA_API_KEY` on the Vercel project. Translation, voice, and speech-to-text go through `api/twi.js` to GhanaNLP Khaya. `data/i18n-tw.json` is machine output and `reviewed_by_twi_speaker` is false. A Twi speaker needs to review the fixed labels, the crop names, and a sample of spoken answers before the team calls Twi ready. Town names and “Walo” stay as they are. Do not flip the reviewed flag until that person has signed off. Crop-name gaps are listed in [walo-crops-sources.md](walo-crops-sources.md).

4. **Supabase dashboard, project `yceufknddlcrezefaivi`.** The table, bucket, and RLS policies are already created (see [app/README.md](../app/README.md), “Optional backup”). Still set in the dashboard:
   - Authentication → URL configuration: Site URL `https://walo-simply-zero.vercel.app`, and that origin in Redirect URLs.
   - Authentication → Email Templates, both Magic Link and Confirm signup: include `{{ .Token }}` so the email shows the 6-digit code. Until that token is in the template, the mail contains a link, which also signs the farmer in.
   - A custom SMTP sender if the built-in mailer rate limit gets in the way. SMS sign-in is not set up and needs a paid provider. Do not add it unless the team asks.
   - Never copy the service-role key into the repo, into `app.json`, or into the browser.

5. **Prices stop in July 2023.** `data/market.json` says so on screen. MoFA SRID 2025 covers Techiman only and has no unit column. A newer series means a new HDX (or SRID) file, then `scripts/build_markets.py` and `scripts/finalize_data.py`. The raw CSV is not in this repo. See [DATA_PIPELINE.md](DATA_PIPELINE.md). Do not type prices in by hand.

6. **Connect this GitHub repository** to Vercel project `walo-simply-zero` if it is not already connected. Root Directory **`app`**. Environment names: `GEMINI_API_KEY`, `METEOMATICS_USER`, `METEOMATICS_PASS`, `KHAYA_API_KEY`, and optional `GEMINI_MODEL`. Then redeploy and open the live URL on a phone.

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
