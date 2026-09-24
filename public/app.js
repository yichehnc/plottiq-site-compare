import { strategy, sites } from "./data.js";
import { estYield, quickFeaso, riskFlags, score } from "./logic.js";
import { seedAssessment } from "./seed.js";
import { computePlan, renderPlanSVG, RULES } from "./siteplan.js";

// Preset by default (no API key). Add ?live to the URL to call /api/assess; falls back to preset on any error.
const LIVE = new URLSearchParams(location.search).has("live");

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
  if (decision === "Promote") { planSite = id; renderPlan(true); $("#planSection").scrollIntoView({ behavior: "smooth", block: "start" }); }
});

$("#clearLog").addEventListener("click", () => { decisions = []; save(); renderTable(); renderAI(); renderLog(); });

$("#assessBtn").addEventListener("click", async () => {
  const btn = $("#assessBtn");
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Assessing…`;
  renderAI("loading");
  try {
    ai = LIVE ? await liveAssess() : await presetAssess();
  } catch (e) {
    console.warn("Live assessment failed, using preset:", e);
    ai = await presetAssess();
  }
  renderTable(); renderAI();
  planSite = decisions.find((d) => d.decision === "Promote")?.id || ai.leader;
  renderPlan(true);
  btn.disabled = false; btn.textContent = "Re-run AI pre-assessment";
});

// ---------- Site plan test fit ----------
let planSite = null;
const rearBy = {}; // per-site rear setback chosen on the slider

function renderPlan(animate = false, keepSlider = false) {
  const sec = $("#planSection");
  if (!planSite) { sec.hidden = true; return; }
  sec.hidden = false;
  const site = rows.find((r) => r.id === planSite);
  const rear = rearBy[site.id] ?? site.plan?.rearSetback ?? 4;
  const plan = computePlan(site, rear);
  const a = ai?.sites.find((x) => x.id === site.id);
  const d = latest(site.id);
  const pct = (n) => `${Math.round(n * 100)}%`;
  const target = strategy.targetMargin;

  $("#planTitle").textContent = site.address.split(",")[0];
  $("#planTabs").innerHTML = rows.map((r) => `<button role="tab" aria-selected="${r.id === site.id}" class="tab ${r.id === site.id ? "is-active" : ""}" data-plan="${r.id}">${r.address.split(" ").slice(0, 2).join(" ")}${r.id === ai?.leader ? '<i class="tab-dot"></i>' : ""}</button>`).join("");
  $("#planSvg").innerHTML = renderPlanSVG(site, plan, { animate });
  if (animate) setTimeout(() => $("#planSvg svg")?.classList.remove("is-animating"), 2600); // settle to static styles

  const flags = [];
  if (plan.lost) flags.push(["danger", `Rear setback costs ${plan.lost} dwelling${plan.lost > 1 ? "s" : ""}`]);
  if (plan.narrow) flags.push(["warn", `Driveway leaves ${plan.unitW.toFixed(1)} m for dwellings (< ${RULES.minW} m)`]);
  if (plan.tree && plan.treeLimit < plan.rearLine) flags.push(["warn", "Tree protection zone sets the rear limit"]);
  if (plan.p.heritageDwelling) flags.push(["danger", "Retained heritage dwelling occupies the front"]);
  if (plan.p.flood) flags.push(["warn", "Flood overlay: floor levels to confirm"]);
  if (plan.garden < RULES.gardenMin) flags.push(["danger", `Garden area below ${pct(RULES.gardenMin)} minimum`]);

  const sliderStyle = `--pct:${((rear - 2) / 10) * 100}%; --thr:${Math.min(100, Math.max(0, ((plan.rearMax - 2) / 10) * 100))}%`;
  const th = (n) => `${n} townhouse${n === 1 ? "" : "s"}`;
  const hint = !plan.potential ? "No townhouses fit this strategy"
    : plan.rearMax > 12 ? `Setback isn't the constraint here: yield is capped at ${th(plan.potential)} by <b>${plan.capReason}</b>`
    : `${th(plan.potential)} fit up to a <b>${plan.rearMax.toFixed(1)} m</b> rear setback`;
  const statsHTML = `
    <div class="yield">
      <span class="yield__n" data-n="${plan.dwellings}">${plan.dwellings}</span>
      <span class="yield__lbl">dwellings fit<br><span class="muted">${plan.n} new townhouse${plan.n === 1 ? "" : "s"}${plan.p.heritageDwelling ? " + 1 retained" : ""}</span></span>
    </div>


    <dl class="kv">
      <div><dt>Garden area</dt><dd><span class="meter"><i style="width:${Math.min(100, plan.garden * 100)}%" class="${plan.garden < RULES.gardenMin ? "bad" : ""}"></i><b style="left:${RULES.gardenMin * 100}%"></b></span>${pct(plan.garden)} <span class="muted">min ${pct(RULES.gardenMin)}</span></dd></div>
      <div><dt>Margin at this yield</dt><dd class="${plan.feaso.margin < target ? "neg" : "pos"}">${pct(plan.feaso.margin)} <span class="muted">target ${pct(target)}</span></dd></div>
    </dl>

    ${flags.length ? `<div class="flags">${flags.map(([l, t]) => `<span class="badge badge-${l}">${t}</span>`).join("")}</div>` : ""}

    ${a ? `<blockquote class="ai-quote"><span class="eyebrow">Testing the AI's deal-breaker ${P("ai")}</span><p>${a.dealBreaker}</p></blockquote>` : ""}

    <table class="titleblock">
      <tr><th>Sheet</th><td>TF-01 · Test fit</td><th>Status</th><td>${d ? d.decision : a ? a.verdict : "—"}</td></tr>
      <tr><th>Site</th><td colspan="3">${site.address} · ${site.zone} · ${site.area} m²</td></tr>
      <tr><th>Basis</th><td colspan="3">${RULES.unitW}×${RULES.unitD} m townhouses · ${RULES.front} m front · ${RULES.side} m side · ${RULES.drive} m drive</td></tr>
    </table>`;
  if (keepSlider && $("#rearSlider")) {
    $("#planStats").innerHTML = statsHTML;
    $("#rearVal").textContent = `${rear.toFixed(1)} m`;
    $("#rearHint").innerHTML = hint;
    $("#rearSlider").style.cssText = sliderStyle;
    return;
  }
  $("#planSide").innerHTML = `
    <label class="slider">
      <span class="slider__row"><span class="eyebrow">Rear setback · drag to test</span><strong id="rearVal">${rear.toFixed(1)} m</strong></span>
      <input type="range" id="rearSlider" min="2" max="12" step="0.5" value="${rear}" style="${sliderStyle}" aria-label="Rear setback in metres" />
      <span class="slider__hint" id="rearHint">${hint}</span>
    </label>
    <div id="planStats">${statsHTML}</div>`;
}

$("#planTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-plan]"); if (!b) return;
  planSite = b.dataset.plan; renderPlan(true);
});
$("#planSide").addEventListener("input", (e) => {
  if (e.target.id !== "rearSlider") return;
  rearBy[planSite] = +e.target.value;
  renderPlan(false, true);
});

async function presetAssess() {
  await new Promise((r) => setTimeout(r, 1200)); // feel like a real call
  return structuredClone(seedAssessment);
}

async function liveAssess() {
  const payload = rows.map(({ id, address, price, area, frontage, orientation, zone, overlays, comparableSales, medianTownhouse, notes, yield: y, feaso, flags, score }) =>
    ({ id, address, price, area, frontage, orientation, zone, overlays, comparableSales, medianTownhouse, notes, estYield: y, quickMargin: +feaso.margin.toFixed(3), ruleFlags: flags.map((f) => f.text), ruleScore: score }));
  const res = await fetch("/api/assess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy, sites: payload }) });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

renderStrategy(); renderTable(); renderLog();
