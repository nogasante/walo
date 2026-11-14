/*
 * Server-side country facts, shared by /api/forecast and /api/diagnose.
 *
 * The phone's copy is app/data/countries.json (loaded by js/data.js). Serverless functions cannot
 * read a file the browser fetched, so they require the same JSON directly: one source of truth,
 * two ways of reading it.
 *
 * A coordinate is accepted when it falls inside ANY enabled country. With one country this behaves
 * exactly as the old hardcoded Ghana box did.
 */
"use strict";
const CFG = require("../data/countries.json");

const list = () => Object.entries(CFG.countries).filter(([, c]) => c.status === "live");

const inCountry = (lat, lon) =>
  list().some(([, c]) => {
    const [latMin, latMax] = c.bbox.lat, [lonMin, lonMax] = c.bbox.lon;
    return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
  });

/* the country a point belongs to (first match), or the default country for prompts with no point */
function countryAt(lat, lon) {
  const hit = list().find(([, c]) => {
    const [latMin, latMax] = c.bbox.lat, [lonMin, lonMax] = c.bbox.lon;
    return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
  });
  return hit ? { id: hit[0], ...hit[1] } : defaultCountry();
}

const defaultCountry = () => ({ id: CFG.default, ...CFG.countries[CFG.default] });

module.exports = { inCountry, countryAt, defaultCountry, list };
