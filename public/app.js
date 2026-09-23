import { strategy, sites } from "./data.js";
import { estYield, quickFeaso, riskFlags, score } from "./logic.js";

const $ = (s) => document.querySelector(s);
const money = (n) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(2) + "m" : Math.round(n / 1e3) + "k");
const P = (kind) => `<i class="prov ${kind}" title="${{ source: "Source data", calc: "Calculated", ai: "AI-assisted" }[kind]}"></i>`;
const VERDICT = { Shortlist: "badge-ok", Monitor: "badge-warn", Pass: "badge-danger" };

let ai = null; // { sites: [{id, verdict, dealBreaker, ...}], leader, why, mock }

// Enrich once: all calculated values live here
const rows = sites.map((s) => ({ ...s, yield: estYield(s), feaso: quickFeaso(s), flags: riskFlags(s, strategy), score: score(s, strategy) }))
  .sort((a, b) => b.score - a.score);

function renderStrategy() {
  $("#strategy").innerHTML = [
    strategy.product, strategy.zones.join("/"), `≥ ${strategy.minArea} m²`, `≥ ${strategy.minFrontage} m frontage`,
    `≤ ${money(strategy.maxPrice)}`, `${strategy.targetMargin * 100}% margin`,
  ].map((t) => `<span class="badge badge-neutral">${t}</span>`).join("");
}

function renderTable() {
  const lead = ai?.leader;
  const col = (r) => (r.id === lead ? ' class="lead"' : "");
  const aiFor = (id) => ai?.sites.find((x) => x.id === id);
  const line = (label, fn) => `<tr><th>${label}</th>${rows.map((r) => `<td${col(r)}>${fn(r)}</td>`).join("")}</tr>`;

  $("#table").innerHTML = `
    <thead><tr><th></th>${rows.map((r) => `<th${col(r)}><span class="addr">${r.address.split(",")[0]}</span><span class="muted">${r.address.split(",")[1]}</span></th>`).join("")}</tr></thead>
    <tbody>
      ${line("AI verdict", (r) => { const a = aiFor(r.id); return a ? `<span class="badge ${VERDICT[a.verdict] || "badge-neutral"}">${a.verdict}</span>${P("ai")}` : `<span class="muted">—</span>`; })}
      ${line("Rule score", (r) => `<strong>${r.score}</strong>/100${P("calc")}`)}
      ${line("Price", (r) => money(r.price) + P("source"))}
      ${line("Land area", (r) => `${r.area} m²` + P("source"))}
      ${line("Frontage", (r) => `${r.frontage} m` + P("source"))}
      ${line("Orientation", (r) => r.orientation + P("source"))}
      ${line("Zone", (r) => r.zone + P("source"))}
      ${line("Overlays", (r) => (r.overlays.length ? r.overlays.join(", ") : "None detected") + P("source"))}
      ${line("Comparable sales", (r) => `${r.comparableSales} sales` + P("source"))}
      ${line("Est. yield", (r) => `${r.yield} dwellings` + P("calc"))}
      ${line("Quick margin", (r) => `${(r.feaso.margin * 100).toFixed(0)}% on ${money(r.feaso.grv)} GRV` + P("calc"))}
      ${line("Risk flags", (r) => `<div class="flags">${r.flags.map((f) => `<span class="badge badge-${f.level}">${f.text}</span>`).join("") || '<span class="badge badge-ok">None</span>'}</div>`)}
    </tbody>`;
}

function renderAI(state) {
  const el = $("#ai");
  if (state === "loading") { el.innerHTML = `<div class="empty">Reading planning, market and site evidence…</div>`; return; }
  if (state instanceof Error) { el.innerHTML = `<div class="empty error">Assessment failed: ${state.message}</div>`; return; }
  if (!ai) return;
  const leader = rows.find((r) => r.id === ai.leader);
  el.innerHTML = `
    <div class="card why">
      <span class="badge badge-accent">Recommended focus${P("ai")}</span>${ai.seeded ? ' <span class="badge badge-neutral">Example output</span>' : ""}
      <h3 style="margin-top:8px">${leader?.address ?? ai.leader}</h3>
      <p>${ai.why}</p>
    </div>
    <div class="ai-grid">
      ${rows.map((r) => { const a = ai.sites.find((x) => x.id === r.id); if (!a) return ""; return `
        <article class="card ai-card">
          <span class="badge ${VERDICT[a.verdict] || "badge-neutral"}">${a.verdict}</span>
          <h3>${r.address.split(",")[0]}</h3>
          <dl>
            <div><dt>Deal-breaker</dt><dd>${a.dealBreaker}</dd></div>
            <div><dt>Missing due diligence</dt><dd><ul>${a.missingDD.map((m) => `<li>${m}</li>`).join("")}</ul></dd></div>
            <div><dt>Next step</dt><dd>${a.nextStep}</dd></div>
          </dl>
        </article>`; }).join("")}
    </div>`;
}

$("#assessBtn").addEventListener("click", async () => {
  const btn = $("#assessBtn");
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Assessing…`;
  renderAI("loading");
  try {
    const payload = rows.map(({ id, address, price, area, frontage, orientation, zone, overlays, comparableSales, medianTownhouse, notes, yield: y, feaso, flags, score }) =>
      ({ id, address, price, area, frontage, orientation, zone, overlays, comparableSales, medianTownhouse, notes, estYield: y, quickMargin: +feaso.margin.toFixed(3), ruleFlags: flags.map((f) => f.text), ruleScore: score }));
    const res = await fetch("/api/assess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy, sites: payload }) });
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    ai = await res.json();
    renderTable(); renderAI();
  } catch (e) { renderAI(e); }
  finally { btn.disabled = false; btn.textContent = "Re-run AI pre-assessment"; }
});

renderStrategy(); renderTable();
