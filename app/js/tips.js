/* Weather-timed actions for one planted field. Nothing is said unless the 10-day forecast
   supports it, and nothing is said when there is no forecast (offline): a guess about rain
   is worse than silence. */
import { forecastFor } from "./data.js";
import { fmt } from "./util.js";

export function fieldTips(pr) {
  const fc = forecastFor(pr.p);
  if (!fc || !fc.days || !fc.days.length) return [];
  if (pr.d < 0) return []; // not planted yet: #/now already answers "when to plant"
  const days = fc.days.slice(0, 5);
  const rain = days.map((d) => d.rain_mm || 0);
  const next2 = rain.slice(0, 2).reduce((a, b) => a + b, 0);
  const next3 = rain.slice(0, 3).reduce((a, b) => a + b, 0);
  const dry3 = next3 < 1;
  const done = pr.frac >= 1, nearDone = pr.frac >= 0.85;
  const out = [];

  if (!done) {
    if (pr.si <= 2 && next2 >= 15)
      out.push({ ic: "cloud-rain", k: "Before the rain", text: `${fmt(next2)} mm of rain is coming in the next two days. If you have fertiliser, put it on now.` });
    else if (next2 >= 25)
      out.push({ ic: "cloud-rain", k: "Heavy rain coming", text: `Do not spray today: ${fmt(next2)} mm would wash it off.` });
    else if (dry3 && pr.si >= 1)
      out.push({ ic: "droplets", k: "Dry days", text: "No rain at your field for three days. Water if you can." });
  }
  if (nearDone) {
    if (dry3)
      out.push({ ic: "sun", k: "Harvest window", text: "Dry days ahead: cut it and dry it in the sun, spread thin. Grain left damp grows mould, and that mould can poison people." });
    else if (next3 >= 15)
      out.push({ ic: "triangle-alert", k: "Rain before harvest", text: "Rain is coming. If it is ripe, cut it now and dry it under cover: damp grain grows mould that can poison people." });
  }
  return out.slice(0, 2);
}
