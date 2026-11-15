/*
 * Walɔ daily AI budget, shared by /api/diagnose and /api/help.
 *
 * The count lives in Postgres (supabase/schema.sql -> public.walo_ai_hit()), not in the memory of a
 * serverless instance, so the cap holds across cold starts and across instances. The cap itself is a
 * constant inside that SQL function: this file holds only the publishable key, and the browser can
 * call the same function, so a cap sent from here would be a cap an attacker chooses.
 *
 * If the SQL has not been applied yet, or Supabase is slow or down, this returns null and the caller
 * keeps its own in-memory limit. Walɔ never stops answering because the counter is unavailable.
 */
"use strict";
const BACKUP = require("../data/app.json").backup;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function callRpc() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(`${BACKUP.url}/rest/v1/rpc/walo_ai_hit`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: BACKUP.key,
        Authorization: `Bearer ${BACKUP.key}`,
      },
      body: "{}",
    });
    if (!r.ok) return null; // 404 = function not installed yet; anything else = treat as unavailable
    const j = await r.json();
    const row = Array.isArray(j) ? j[0] : j;
    if (!row || typeof row.allowed !== "boolean") return null;
    return { allowed: row.allowed, used: Number(row.used) || 0, cap: Number(row.cap) || 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* One AI call takes one hit. Returns { allowed, used, cap }, or null when the budget is unavailable. */
async function takeAiHit() {
  for (let attempt = 0; attempt < 2; attempt++) {
    const v = await callRpc();
    if (v) return v;
    if (attempt === 0) await wait(150); // one quick retry: a cold Supabase connection is not an outage
  }
  return null;
}

module.exports = { takeAiHit };
