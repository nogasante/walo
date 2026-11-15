/*
 * Walɔ Get help: POST /api/help
 * In:  { messages: [{ role: "farmer" | "walo", text }] (last 8), ctx: { place, main_crop, fields: [{ crop, stage, harvest }], screen } }
 * Out: { ok, answer, unsure, wants_person, go, model, ai_generated: true }
 * An AI helper (Google Gemini) that knows Walɔ (data/help.json) and the farmer's own context. Short plain answers.
 * When it is unsure, or the farmer asks for a person, the phone offers the team's help line (data/app.json support.phone).
 * The key is read from process.env.GEMINI_API_KEY. Nothing the farmer says is logged.
 */
"use strict";
const HELP = require("../data/help.json");
const { gemini } = require("./_gemini.js");
const { takeAiHit } = require("./_budget.js"); // daily cap shared with /api/diagnose (supabase/schema.sql)
const { defaultCountry } = require("./_country.js"); // the country name comes from data/countries.json
const MAX_MSG = 8, MAX_CHARS = 600, BUDGET_MS = 20000;
const RATE = { windowMs: 10 * 60 * 1000, perIp: 20 };
const hits = new Map();
const GO = Object.keys(HELP.go);
const SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING", description: "1-3 short, plain sentences for a farmer who will hear it read aloud" },
    unsure: { type: "BOOLEAN", description: "true if you cannot answer well (outside Walɔ and farming, needs a person, account or money problem, an emergency, or you do not know)" },
    wants_person: { type: "BOOLEAN", description: "true if the farmer asks to talk to a person or a human" },
    go: { type: "STRING", enum: ["none", ...GO], description: "the one Walɔ screen that would help next, or none" },
  },
  required: ["answer", "unsure", "wants_person", "go"],
};
const s = (x, n) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "");

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "Use POST" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(503, { ok: false, error: "Help is not set up on the server." });
  const ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0].trim(), now = Date.now();
  const mine = (hits.get(ip) || []).filter((t) => t > now - RATE.windowMs);
  if (mine.length >= RATE.perIp) return send(429, { ok: false, error: "Many questions in a short time. Try again in a few minutes." });
  mine.push(now); hits.set(ip, mine); if (hits.size > 5000) hits.clear();

  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || !Array.isArray(b.messages)) return send(400, { ok: false, error: "Send JSON" });
  const msgs = b.messages.slice(-MAX_MSG).map((m) => ({ who: m && m.role === "walo" ? "Walɔ" : "Farmer", text: s(m && m.text, MAX_CHARS) })).filter((m) => m.text);
  if (!msgs.length || msgs[msgs.length - 1].who !== "Farmer") return send(400, { ok: false, error: "Say or type your question first." });
  // Daily cap across every server instance (supabase/schema.sql -> walo_ai_hit). Null means the SQL is
  // not applied yet, or Supabase is down: the per-IP limit above still applies and Walɔ keeps answering.
  const budget = await takeAiHit();
  if (budget && !budget.allowed) {
    res.setHeader("Retry-After", "3600");
    return send(429, { ok: false, error: "Walɔ has answered a lot of questions today. Try again tomorrow." });
  }
  const c = b.ctx && typeof b.ctx === "object" ? b.ctx : {};
  const fields = Array.isArray(c.fields) ? c.fields.slice(0, 6).map((f) => `${s(f.crop, 30)} (${s(f.stage, 30)}${f.harvest ? `, harvest ${s(f.harvest, 30)}` : ""})`).join("; ") : "";
  const text = `You are Walɔ's helper inside the Walɔ app, for smallholder farmers in ${defaultCountry().name}. Answer the farmer's last message.
What Walɔ is and does:
- ${HELP.knowledge.join("\n- ")}
This farmer: place ${s(c.place, 60) || "unknown"}; main crop ${s(c.main_crop, 30) || "not set"}; fields: ${fields || "none yet"}; screen open now: ${s(c.screen, 30) || "unknown"}.
Rules:
- 1-3 short sentences in simple English (it may be read aloud). No lists, no markdown.
- Answer yourself from what Walɔ knows and general good farming practice. Never tell the farmer to ask an extension officer, an expert or anyone else for the answer.
- For how-to questions, say exactly which button or screen to tap, and set "go" to that screen.
- For a sick plant, say Plant Doctor can look at a photo, and set go to "doctor".
- Do not invent prices, dates or numbers Walɔ does not have. No brand chemicals or doses; if a pesticide is truly needed: "ask the agro-shop for a product approved for that pest and follow the label".
- Set unsure=true when you cannot answer well, the question is outside farming and Walɔ, it is about an account, money or a complaint, or it is an emergency; then answer briefly and say a person from the Walɔ team can help.
- Set wants_person=true if the farmer asks for a person, a human, to call, or customer care.
Conversation:
${msgs.map((m) => `${m.who}: ${m.text}`).join("\n")}`;
  try {
    const g = await gemini(key, [{ text }], { schema: SCHEMA, budgetMs: BUDGET_MS, temperature: 0.3 }), d = g.data || {};
    return send(200, { ok: true, ai_generated: true, model: g.model, answer: s(d.answer, 500) || "Sorry, I did not get that. Say it another way.", unsure: !!d.unsure, wants_person: !!d.wants_person, go: GO.includes(d.go) ? d.go : "none" });
  } catch {
    return send(502, { ok: false, error: "The helper could not answer right now. Try again in a minute." });
  }
};
