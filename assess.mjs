// Shared by server.mjs (local) and api/assess.mjs (Vercel).
import { seedAssessment } from "./seed.mjs";

const KEY = process.env.ANTHROPIC_API_KEY;
const DEMO = process.env.DEMO === "1" || !KEY; // seeded example unless a key is set (DEMO=1 forces it)
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
export const mode = DEMO ? "seeded demo" : MODEL;

const SYSTEM = `You are a development acquisitions analyst in Victoria, Australia.
You receive a developer's strategy and 2-5 candidate sites, including rule-based flags already calculated in code.
Do NOT restate the numbers. Your job is to CONNECT evidence the table can't: e.g. how an overlay, orientation and frontage together affect yield or approval risk.
For each site find the single constraint most likely to end the deal.
Be preliminary and specific; never invent data not provided — if something is unknown, list it as missing due diligence.
Return ONLY JSON matching:
{"leader":"<site id>","why":"<2 sentences: why the leader beats the others, naming them>",
 "sites":[{"id":"<id>","verdict":"Shortlist|Monitor|Pass","dealBreaker":"<1 sentence>","missingDD":["<item>","<item>"],"nextStep":"<1 sentence, concrete action>"}]}`;

export async function assess(body) {
  if (DEMO) { await new Promise((r) => setTimeout(r, 1400)); return seedAssessment; } // feel like a real call
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(body) }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data.content.map((c) => c.text || "").join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); // tolerate code fences
  return JSON.parse(json);
}

