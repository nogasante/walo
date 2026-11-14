/* Shared Gemini call for /api/diagnose and /api/help (files starting with "_" are not served as routes).
   The key comes from process.env.GEMINI_API_KEY in the caller; nothing the farmer sent is logged here. */
"use strict";
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash"]; // used only if the model list call fails; GEMINI_MODEL env overrides
let modelCache = null;

/* Pick current Flash vision models from the live model list (newest first, stable before preview, one older stable and one Lite as fallbacks; no image/tts/live variants). */
async function models(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL, ...FALLBACK_MODELS];
  if (modelCache && Date.now() - modelCache.t < 6 * 3600e3) return modelCache.list;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: ctl.signal }).finally(() => clearTimeout(t));
    const j = await r.json();
    const ver = (n) => { const m = /gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? +m[1] : 0; };
    const list = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /^gemini-[\d.]+-flash(-lite)?(-preview[-\d]*)?$|^gemini-flash(-lite)?-latest$/.test(n))
      .sort((a, b) => ver(b) - ver(a) || /preview/.test(a) - /preview/.test(b));
    const full = list.filter((n) => !/lite/.test(n) && n !== "gemini-flash-latest"), lite = list.filter((n) => /lite/.test(n) && !/preview/.test(n));
    // fastest first: the newest stable Lite model (answers a photo in a few seconds), then the newest stable Flash,
    // the rolling alias and one older stable Flash: when the newest models are busy (503) an older one usually answers
    const stable = full.filter((n) => !/preview/.test(n) && ver(n) >= 2.5);
    const pick = [lite[0] || (list.includes("gemini-flash-lite-latest") ? "gemini-flash-lite-latest" : null), stable[0] || full[0], list.includes("gemini-flash-latest") ? "gemini-flash-latest" : null, stable[stable.length - 1]].filter(Boolean);
    if (pick.length) { modelCache = { t: Date.now(), list: [...new Set(pick)] }; return modelCache.list; }
  } catch { /* fall through */ }
  return FALLBACK_MODELS;
}

async function gemini(key, parts, { schema, budgetMs, temperature = 0.2 }) {
  const tried = [], t0 = Date.now();
  const queue = (await models(key)).map((m) => ({ m, think: true }));
  while (queue.length) {
    const { m: model, think } = queue.shift();
    const left = budgetMs - (Date.now() - t0); if (left < 5000) break;
    // short limit on the first (fast) model so a stuck call falls through quickly
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), Math.min(tried.length ? 16000 : 12000, left));
    // keep "thinking" short so a photo check answers in seconds (Gemini 3: thinkingLevel; 2.5: thinkingBudget)
    const thinking = !think ? undefined : /^gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : /^gemini-[3-9]/.test(model) ? { thinkingLevel: "low" } : undefined;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 8192, ...(thinking ? { thinkingConfig: thinking } : {}) } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        tried.push(`${model}: ${r.status} ${(j.error && j.error.status) || ""}`.trim());
        if ([401, 403].includes(r.status)) break;
        if (r.status === 400 && thinking && /think/i.test((j.error && j.error.message) || "")) queue.unshift({ m: model, think: false });
        if ((r.status === 503 || r.status === 429) && !queue.some((q) => q.retry)) queue.push({ m: model, think, retry: true }); // one late retry of the first busy model
        continue;
      }
      const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.filter((p) => !p.thought).map((p) => p.text || "").join("");
      try { return { model: j.modelVersion || model, data: JSON.parse(text) }; } catch { tried.push(`${model}: bad JSON (${((j.candidates || [])[0] || {}).finishReason || "?"})`); }
    } catch (e) { tried.push(`${model}: ${e.name === "AbortError" ? "timeout" : "network"}`); } finally { clearTimeout(t); }
  }
  const err = new Error(tried.join("; ") || "no model"); err.tried = tried; throw err;
}

module.exports = { gemini };
