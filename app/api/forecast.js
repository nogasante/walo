/*
 * Walo forecast: GET /api/forecast?lat=..&lon=..
 * Next 10 days, daily rain (precip_24h:mm) and daily max temperature (t_max_2m_24h:C) from the Meteomatics Weather API.
 * Credentials come from process.env.METEOMATICS_USER / METEOMATICS_PASS on the server only. NASA POWER stays Walo's
 * source for climatology and history; this is only the short-range forecast layer.
 */
"use strict";
const { inCountry } = require("./_country.js"); // accepted coordinates come from data/countries.json
const DAYS = 10, TTL_S = 10800; // 3 h; Meteomatics free tier: 1000 queries/day
const mem = new Map();

module.exports = async (req, res) => {
  const send = (code, obj, cache) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", cache || "no-store"); res.end(JSON.stringify(obj)); };
  const q = new URL(req.url, "http://x").searchParams, lat = Number(q.get("lat")), lon = Number(q.get("lon"));
  if (!inCountry(lat, lon)) return send(400, { ok: false, error: "Location outside the area Walo covers" });
  const user = process.env.METEOMATICS_USER, pass = process.env.METEOMATICS_PASS;
  if (!user || !pass) return send(503, { ok: false, error: "Forecast not set up" });
  const la = lat.toFixed(2), lo = lon.toFixed(2), key = `${la},${lo}`;
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < TTL_S * 1000) return send(200, hit.body, `public, s-maxage=${TTL_S}, stale-while-revalidate=3600`);
  // precip_24h at 00Z of day D+1 = rain that fell on day D (UTC; Ghana is UTC+0)
  const d0 = new Date(); d0.setUTCHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const start = new Date(d0.getTime() + 864e5), end = new Date(d0.getTime() + DAYS * 864e5);
  const url = `https://api.meteomatics.com/${iso(start)}--${iso(end)}:P1D/precip_24h:mm,t_max_2m_24h:C/${la},${lo}/json?model=mix`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") } });
    if (!r.ok) return send(502, { ok: false, error: `Forecast service ${r.status}` });
    const j = await r.json(), get = (p) => ((((j.data || []).find((x) => x.parameter === p) || {}).coordinates || [])[0] || {}).dates || [];
    const rain = get("precip_24h:mm"), tmax = get("t_max_2m_24h:C");
    const days = rain.map((x, i) => ({ date: new Date(new Date(x.date).getTime() - 864e5).toISOString().slice(0, 10), rain_mm: Math.round(x.value * 10) / 10, tmax_c: tmax[i] ? Math.round(tmax[i].value * 10) / 10 : null }));
    const body = { ok: true, source: "Meteomatics Weather API (model mix)", source_url: "https://www.meteomatics.com/", lat: +la, lon: +lo, issued: new Date().toISOString(), days };
    mem.set(key, { t: Date.now(), body }); if (mem.size > 500) mem.clear();
    return send(200, body, `public, s-maxage=${TTL_S}, stale-while-revalidate=3600`);
  } catch (e) {
    return send(504, { ok: false, error: "Forecast service did not answer" });
  } finally { clearTimeout(t); }
};
