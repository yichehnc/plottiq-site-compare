import { strategy, sites } from "./data.js";
import { estYield, quickFeaso, riskFlags, score } from "./logic.js";

const $ = (s) => document.querySelector(s);
const money = (n) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(2) + "m" : Math.round(n / 1e3) + "k");
const P = (kind) => `<i class="prov ${kind}" title="${{ source: "Source data", calc: "Calculated", ai: "AI-assisted" }[kind]}"></i>`;
const VERDICT = { Shortlist: "badge-ok", Monitor: "badge-warn", Pass: "badge-danger" };
const FIX = { Resolvable: "badge-ok", "Partly resolvable": "badge-warn", Structural: "badge-danger" };
// Plott iQ's decision language: promote / monitor / release
const DECISIONS = { Promote: { cls: "badge-ok", ai: "Shortlist" }, Monitor: { cls: "badge-warn", ai: "Monitor" }, Release: { cls: "badge-danger", ai: "Pass" } };
const LOG_KEY = "site-compare-decisions";

let ai = null; // { leader, why, sharedRisks, upset, sites: [{id, verdict, dealBreaker, fixability, fixNote, distinguishing, missingDD, nextStep}], seeded }
let decisions = load(); // [{ id, address, decision, aiVerdict, ruleScore, reason, at }]

function load() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { return []; } }
function save() { try { localStorage.setItem(LOG_KEY, JSON.stringify(decisions)); } catch {} }
const latest = (id) => decisions.find((d) => d.id === id); // newest first

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
  const dash = `<span class="muted">—</span>`;

  $("#table").innerHTML = `
    <thead><tr><th></th>${rows.map((r) => `<th${col(r)}><span class="addr">${r.address.split(",")[0]}</span><span class="muted">${r.address.split(",")[1]}</span></th>`).join("")}</tr></thead>
    <tbody>
      ${line("Decision", (r) => { const d = latest(r.id); return d ? `<span class="badge ${DECISIONS[d.decision].cls}">${d.decision}</span>` : dash; })}
      ${line("AI verdict", (r) => { const a = aiFor(r.id); return a ? `<span class="badge ${VERDICT[a.verdict] || "badge-neutral"}">${a.verdict}</span>${P("ai")}` : dash; })}
      ${line("Weakness type", (r) => { const a = aiFor(r.id); return a?.fixability ? `<span class="badge ${FIX[a.fixability] || "badge-neutral"}">${a.fixability}</span>${P("ai")}` : dash; })}
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

    <div class="risk-split">
      <div class="card">
        <p class="eyebrow">Shared by all sites · doesn't help you choose</p>
        <ul class="risk-list">${(ai.sharedRisks || []).map((r) => `<li>${r}</li>`).join("")}</ul>
      </div>
      <div class="card ${ai.upset ? "upset" : ""}">
        <p class="eyebrow">Could the ranking flip?</p>
        <p class="upset-text">${ai.upset || "No. The leader's weaknesses are no more fixable than the others'."}</p>
      </div>
    </div>

    <div class="ai-grid">
      ${rows.map((r) => { const a = ai.sites.find((x) => x.id === r.id); if (!a) return ""; const d = latest(r.id); return `
        <article class="card ai-card" data-id="${r.id}">
          <div class="ai-card__top">
            <span class="badge ${VERDICT[a.verdict] || "badge-neutral"}">${a.verdict}</span>
            ${a.fixability ? `<span class="badge ${FIX[a.fixability] || "badge-neutral"}">${a.fixability}</span>` : ""}
          </div>
          <h3>${r.address.split(",")[0]}</h3>
          <dl>
            <div><dt>What sets it apart</dt><dd>${a.distinguishing ?? "—"}</dd></div>
            <div><dt>Deal-breaker</dt><dd>${a.dealBreaker}</dd></div>
            <div><dt>Can it be fixed?</dt><dd>${a.fixNote ?? "—"}</dd></div>
            <div><dt>Missing due diligence</dt><dd><ul>${a.missingDD.map((m) => `<li>${m}</li>`).join("")}</ul></dd></div>
            <div><dt>Next step</dt><dd>${a.nextStep}</dd></div>
          </dl>
          <div class="decide">
            <p class="eyebrow">Your decision</p>
            <div class="decide__btns">
              ${Object.keys(DECISIONS).map((k) => `<button class="btn btn-outline btn-sm ${d?.decision === k ? "is-active" : ""}" data-decide="${k}">${k}</button>`).join("")}
            </div>
          </div>
        </article>`; }).join("")}
    </div>`;
}

function renderLog() {
  const el = $("#log");
  if (!decisions.length) { el.innerHTML = `<div class="empty">No decisions yet. Promote, monitor or release a site to start the record.</div>`; return; }
  el.innerHTML = `<div class="card table-card"><table class="log">
    <thead><tr><th>When</th><th>Site</th><th>Decision</th><th>AI verdict</th><th>Rule score</th><th>Recorded reason</th></tr></thead>
    <tbody>${decisions.map((d) => `<tr>
      <td class="muted">${new Date(d.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</td>
      <td>${d.address.split(",")[0]}</td>
      <td><span class="badge ${DECISIONS[d.decision].cls}">${d.decision}</span>${d.overrode ? ' <span class="badge badge-neutral">overrode AI</span>' : ""}</td>
      <td>${d.aiVerdict ?? "—"}</td>
      <td>${d.ruleScore}/100</td>
      <td class="muted">${d.reason}</td></tr>`).join("")}</tbody></table></div>`;
}

// Record a decision with the evidence snapshot it was made on
$("#ai").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-decide]"); if (!btn) return;
  const id = btn.closest("[data-id]").dataset.id;
  const r = rows.find((x) => x.id === id), a = ai.sites.find((x) => x.id === id), decision = btn.dataset.decide;
  decisions.unshift({
    id, address: r.address, decision, aiVerdict: a.verdict, ruleScore: r.score,
    overrode: DECISIONS[decision].ai !== a.verdict,
    reason: `${a.fixability ?? ""}${a.fixability ? " · " : ""}${a.dealBreaker}`,
    at: new Date().toISOString(),
  });
  save(); renderTable(); renderAI(); renderLog();
});

$("#clearLog").addEventListener("click", () => { decisions = []; save(); renderTable(); renderAI(); renderLog(); });

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

renderStrategy(); renderTable(); renderLog();
