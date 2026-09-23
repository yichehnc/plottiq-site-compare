// Zero-dependency server: static files + /api/assess (Anthropic). Node 18+.
// Run:  ANTHROPIC_API_KEY=sk-... node server.mjs   → http://localhost:3000
// No key (or DEMO=1)? Returns the seeded example in seed.mjs so the demo always works.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { seedAssessment } from "./seed.mjs";

const PORT = process.env.PORT || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;
const DEMO = process.env.DEMO === "1" || !KEY; // seeded example unless a key is set (DEMO=1 forces it)
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const SYSTEM = `You are a development acquisitions analyst in Victoria, Australia.
You receive a developer's strategy and 2-5 candidate sites, including rule-based flags already calculated in code.
Do NOT restate the numbers. Your job is to CONNECT evidence the table can't: e.g. how an overlay, orientation and frontage together affect yield or approval risk.
For each site find the single constraint most likely to end the deal.
Be preliminary and specific; never invent data not provided — if something is unknown, list it as missing due diligence.
Return ONLY JSON matching:
{"leader":"<site id>","why":"<2 sentences: why the leader beats the others, naming them>",
 "sites":[{"id":"<id>","verdict":"Shortlist|Monitor|Pass","dealBreaker":"<1 sentence>","missingDD":["<item>","<item>"],"nextStep":"<1 sentence, concrete action>"}]}`;

async function assess(body) {
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

// Deterministic fallback so the demo never dies on stage
function mock({ sites }) {
  const sorted = [...sites].sort((a, b) => b.ruleScore - a.ruleScore);
  return {
    mock: true,
    leader: sorted[0].id,
    why: `${sorted[0].address.split(",")[0]} has the fewest hard constraints and the strongest comparable evidence. The others carry flags that need resolving before an offer makes sense.`,
    sites: sites.map((s) => ({
      id: s.id,
      verdict: s.ruleScore >= 70 ? "Shortlist" : s.ruleScore >= 40 ? "Monitor" : "Pass",
      dealBreaker: s.ruleFlags[0] || "No hard constraint detected from available data.",
      missingDD: ["Title and covenant review", "Arborist / services confirmation"],
      nextStep: s.ruleScore >= 70 ? "Engage a town planner on the flagged item and request the contract of sale." : "Hold; revisit if price or planning position changes.",
    })),
  };
}

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/assess") {
      let raw = ""; for await (const c of req) raw += c;
      const out = await assess(JSON.parse(raw));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      return;
    }
    const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const file = await readFile(join(import.meta.dirname, "public", path.replace(/\.\./g, "")));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "text/plain" }).end(file);
  } catch (e) {
    const code = e.code === "ENOENT" ? 404 : 500;
    res.writeHead(code, { "content-type": "text/plain" }).end(e.message);
  }
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}  (${DEMO ? "seeded demo" : MODEL})`));
