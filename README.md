# Site Comparison + AI Pre-assessment (Plott iQ prototype)

Zero-dependency practice build for the Cuboid Ventures 45-min test.

## Run
```bash
node server.mjs                                   # → http://localhost:3000 (button returns preset assessment)
ANTHROPIC_API_KEY=sk-... node server.mjs          # then open /?live for real AI (falls back to preset on error)
# Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-..."; node server.mjs
# Optional: ANTHROPIC_MODEL=<model id>
```
Needs Node 20.11+ (uses `import.meta.dirname`).

## Files
| File | Role |
|---|---|
| `public/data.js` | Strategy + 3 mock sites (swap first) |
| `public/logic.js` | Code-calculated yield, quick feaso, risk flags, score |
| `public/app.js` | Render table + AI cards, call `/api/assess` |
| `public/styles.css` | Plott iQ tokens (bg `#070806`, accent `#c9ef72`, card `#15161d`, radius 10/16) |
| `server.mjs` | Static server + `/api/assess` (live AI only with key) |
| `public/seed.js` | Preset assessment returned on click — no key or server call needed |

## Principle (say this out loud)
**Code calculates, AI interprets.** Rules are cheap, fast, explainable. AI only does what the table can't: connect constraints and find the deal-breaker. Every value is tagged Source / Calculated / AI — mirrors Plott iQ's data & methodology page.

## 45-min run sheet
- **0–5** Frame: user = developer with 3 sites; job = pick where to spend DD. Say what's cut.
- **5–10** Data shape + mock data (`data.js`).
- **10–25** Table + rule flags (`logic.js`, `renderTable`).
- **25–35** AI endpoint + JSON contract + cards.
- **35–40** Loading / error / mock fallback, provenance legend, disclaimer.
- **40–45** Demo: problem → click → leader + deal-breaker → next steps.

## If you have spare time
- Editable strategy (inputs → recompute flags live)
- "Progress to Qascade" button: POST site + assumptions as a new project
- Paste an agent listing → AI extracts fields into a 4th site
- Stream the AI response; cache per input hash

## Talking points
- Why not a chat box: their platform page says AI is embedded, not bolted on.
- Guardrails: JSON contract, "never invent data → list as missing DD", preliminary disclaimer.
- Eval idea: fixed site fixtures with a known deal-breaker; assert the AI names it.

## Deploy (Vercel)
Import the repo on vercel.com → Framework: Other → Deploy. `vercel.json` serves `public/`; `api/assess.mjs` is the function. Add `ANTHROPIC_API_KEY` env var for live AI; the preset works without it (static hosting is enough); open `/?live` to use the function.

## AI contract (v2)
Adds `sharedRisks[]`, `upset`, and per site `fixability` (Resolvable / Partly resolvable / Structural), `fixNote`, `distinguishing` — mirrors Plott iQ's planned Site Comparison ("which risks distinguish vs are shared", "a lower-ranked site's weaknesses are resolvable").
Decisions (Promote / Monitor / Release) are saved with timestamp, AI verdict, rule score and reason to a decision record (browser localStorage); "overrode AI" is flagged.

## Site plan test fit (the "wow" moment)
`public/siteplan.js` draws a to-scale SVG test fit of the selected site (AI leader, or whichever you Promote): lot, setbacks, driveway, townhouse footprints, overlays (DDO band, heritage dwelling, flood extent, tree TPZ), north arrow, scale bar, title block.
- **Drag the rear setback**: at 6.5 m on 12 Example St the third townhouse turns red ("doesn't fit"), yield drops 3 → 2 and margin 26% → 2%. The drawing *verifies the AI's deal-breaker with geometry*.
- Rules are explicit (`RULES` in siteplan.js) and labelled "calculated, illustrative" — it tests yield, it is not a design.
- Demo line: "The AI said the DDO could cost the third townhouse. Here's the fit — it holds to 6.4 m. That's the planner question to ask before the offer."
