# Changelog

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
