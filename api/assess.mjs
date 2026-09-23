// Vercel serverless function → POST /api/assess
import { assess } from "../assess.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    res.status(200).json(await assess(body));
  } catch (e) {
    res.status(500).send(e.message);
  }
}
