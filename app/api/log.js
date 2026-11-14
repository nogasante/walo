/*
 * Walo client log: POST /api/log with a small JSON object from js/log.js.
 * Prints one line per event to the server log, keeping only whitelisted short fields
 * (event name, screen, picker kind, file type and size, timings, browser family). No photos, words or locations.
 */
"use strict";
const KEEP = { ev: 32, owner: 16, kind: 10, type: 40, msg: 120, os: 10, br: 10, ver: 6, sid: 8, route: 12, stage: 20 };
const NUM = ["size", "ms", "out", "mem", "w", "h"];

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let raw = "";
  try {
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) break; }
    const j = JSON.parse(raw.slice(0, 4096)), out = {};
    for (const [k, n] of Object.entries(KEEP)) if (typeof j[k] === "string" && j[k]) out[k] = j[k].replace(/[^\w .:/+-]/g, "").slice(0, n);
    for (const k of NUM) if (Number.isFinite(j[k])) out[k] = Math.round(j[k] * 100) / 100;
    if (out.owner) out.owner = out.owner.split(":")[0]; // the screen, never a field id
    if (out.ev) console.log("walo-log " + JSON.stringify(out));
  } catch { /* bad body: ignore */ }
  res.statusCode = 204; res.end();
};
