# Contributing

Walo is Simply Zero’s NASA Space Apps Challenge 2026 entry. The people who use it are smallholder farmers on small Android phones. A change that looks clearer on a laptop and worse in sunlight is not an improvement.

## Setup

```bash
cd app
python3 -m http.server 8000
```

Functions need `vercel dev` from `app/` and the names in the repository `.env.example`. Put values in `app/.env`. That file is gitignored. Never commit a key, a password, or a service-role token. The Supabase publishable key in `app/data/app.json` is the exception: it is meant to be public, and row-level security is what protects the rows.

## What to run

```bash
python3 proof/walo_proof.py --help
python3 -c "import json,pathlib; [json.loads(p.read_text()) for p in pathlib.Path('app').rglob('*.json')]"
find app -name '*.js' -print0 | xargs -0 -n1 node --check
```

A full proof run (`python3 proof/walo_proof.py --place Ejura --crop maize`) needs a network and is the check to use when you change climate code or replace `data/agro.json`.

## Code

- Plain HTML, CSS, and JavaScript. No framework. Match the file you are editing.
- One screen module under `app/js/screens/`. Shared wording goes in `js/screens/words.js`. Shared decisions go in `js/data.js`.
- Photo picking goes through `js/photo.js`.
- Copy for farmers is short enough to hear aloud. Methods and citations go in the Why? sheet, in `data/rules.json`, or in `docs/`.
- If you add a file the app loads, add it to the `FILES` list in `app/sw.js` and change the `CACHE` name.

## Data

Do not hand-edit climate, crop, or price numbers. [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) says which script owns which file, and which scripts cannot be re-run because their inputs are not in this repository. Thresholds that are a choice rather than a published standard stay `default: true` in `data/rules.json`.

Twi strings in `data/i18n-tw.json` are machine translated. A Twi speaker reviews them. Do not mark `reviewed_by_twi_speaker` true on a machine re-run.

## Deploy

Vercel project `walo-simply-zero`, Root Directory `app`. See the README. `app/scripts/` is deploy-ignored on purpose.

## Docs to update when behaviour changes

- Farmer-facing behaviour: `app/README.md` and, if the layout changed, `app/DESIGN.md` section 13b.
- A new data source or a new builder: `docs/DATA_PIPELINE.md` and the source table in the root README.
- A new threshold or equation: `docs/METHODS.md` and `app/data/rules.json`.
- AI use: `app/AI_USE.md`.
- A finished gap from `docs/HANDOFF.md`: remove it there, and add a line to `CHANGELOG.md`.
