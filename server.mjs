// Zero-dependency server: static files + /api/assess (Anthropic). Node 18+.
// Run:  ANTHROPIC_API_KEY=sk-... node server.mjs   → http://localhost:3000
// No key (or DEMO=1)? Returns the seeded example in seed.mjs so the demo always works.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { assess, mode } from "./assess.mjs";

const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url.split("?")[0] === "/api/assess") {
      let raw = ""; for await (const c of req) raw += c;
      const out = await assess(JSON.parse(raw));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      return;
    }
    let path = req.url.split("?")[0]; if (path === "/") path = "/index.html";
    const file = await readFile(join(import.meta.dirname, "public", path.replace(/\.\./g, "")));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "text/plain" }).end(file);
  } catch (e) {
    const code = e.code === "ENOENT" ? 404 : 500;
    res.writeHead(code, { "content-type": "text/plain" }).end(e.message);
  }
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}  (${mode})`));
