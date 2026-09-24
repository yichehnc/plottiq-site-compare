// Site plan test fit: a code-calculated, illustrative massing of the selected site.
// Geometry is deliberately simple and transparent — it tests yield, it is not a design.
import { estYield, quickFeaso } from "./logic.js";

export const RULES = {
  front: 6,        // m street setback
  side: 1,         // m side setback
  drive: 3.5,      // m driveway width (runs down one boundary)
  unitW: 8,        // m typical townhouse width
  unitD: 10.5,     // m townhouse depth
  gap: 1,          // m between townhouses
  minW: 7.5,       // m narrowest workable townhouse
  gardenMin: 0.35, // GRZ minimum garden area (lots > 650 m²)
  heritageD: 12,   // m retained dwelling depth
  heritageGap: 4,  // m separation behind retained dwelling
};

export function computePlan(site, rear = site.plan?.rearSetback ?? 4, R = RULES) {
  const p = site.plan || {};
  const W = site.frontage, D = site.area / site.frontage;
  const unitW = Math.min(R.unitW, W - R.drive - 2 * R.side);
  const narrow = unitW < R.minW;
  const startY = R.front + (p.heritageDwelling ? R.heritageD + R.heritageGap : 0);

  // What limits how far back dwellings can go
  const rearLine = D - rear;
  let treeLimit = Infinity, tree = null;
  if (p.tree) {
    tree = { ...p.tree, y: D - p.tree.fromRear };
    if (tree.x - tree.tpz < R.side + unitW) treeLimit = tree.y - tree.tpz; // TPZ reaches the dwelling column
  }
  const limit = Math.min(rearLine, treeLimit);

  let cap = estYield(site);                 // zone / area cap
  if (narrow) cap = Math.min(cap, 2);       // narrow lot: 2 wide dwellings max
  if (p.heritageDwelling) cap = Math.max(cap - 1, 0); // retained dwelling counts toward the cap

  const capReason = p.heritageDwelling ? "zoning and the retained dwelling" : narrow ? "frontage width" : "zoning and land area";
  const fits = (lim) => Math.max(0, Math.floor((lim - startY + R.gap) / (R.unitD + R.gap)));
  const n = Math.min(cap, fits(limit));
  const potential = Math.min(cap, fits(Math.min(D - 1, treeLimit))); // with a minimal rear setback
  const lost = Math.max(0, potential - n);
  // Largest rear setback that still keeps `potential` dwellings
  const rearMax = potential ? D - (startY + potential * R.unitD + (potential - 1) * R.gap) : 0;

  const units = Array.from({ length: n + lost }, (_, i) => ({
    x: R.side, y: startY + i * (R.unitD + R.gap), w: unitW, d: R.unitD, lost: i >= n, label: `TH${i + 1}`,
  }));
  const lastY = n ? units[n - 1].y + R.unitD : R.front;
  const driveLen = p.heritageDwelling ? Math.max(lastY, R.front + R.heritageD) : lastY;
  const footprint = n * unitW * R.unitD + (p.heritageDwelling ? 10 * R.heritageD : 0);
  const paved = R.drive * driveLen;
  const garden = (site.area - footprint - paved) / site.area;
  const dwellings = n + (p.heritageDwelling ? 1 : 0);

  return {
    W, D, rear, unitW, narrow, startY, rearLine, tree, treeLimit, units, n, lost, potential, rearMax,
    garden, dwellings, driveLen, feaso: quickFeaso(site, dwellings), p, capReason,
  };
}

const f1 = (n) => n.toFixed(1);

export function renderPlanSVG(site, plan, { animate = false } = {}) {
  const { W, D, p } = plan;
  const s = Math.min(470 / D, 300 / W);          // px per metre
  const ox = 78, oy = p.laneway ? 58 : 34;       // origin (top-left of lot)
  const X = (x) => ox + x * s;
  const Y = (y) => oy + (D - y) * s;             // y measured from the street boundary
  const w = W * s, h = D * s;
  const vbW = ox + w + 150, vbH = oy + h + 92;
  const anim = animate ? " draw" : "";
  const R = RULES;
  const out = [];

  out.push(`<defs>
    <pattern id="hatch-warn" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="h-warn"/></pattern>
    <pattern id="hatch-flood" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".8" class="h-flood"/></pattern>
    <pattern id="hatch-heritage" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="7" class="h-heritage"/></pattern>
    <marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><line x1="2" y1="8" x2="8" y2="2" class="tick"/></marker>
  </defs>`);

  // Laneway / street context
  if (p.laneway) out.push(`<rect x="${X(-2)}" y="${oy - 30}" width="${w + 4 * s}" height="22" class="road"/><text x="${X(W / 2)}" y="${oy - 15}" class="t-road" text-anchor="middle">LANEWAY</text>`);
  out.push(`<rect x="${X(-2)}" y="${Y(0) + 30}" width="${w + 4 * s}" height="30" class="road"/>
    <text x="${X(W / 2)}" y="${Y(0) + 49}" class="t-road" text-anchor="middle">${(p.street || "STREET").toUpperCase()}</text>`);

  // Overlays under everything
  if (p.flood) out.push(`<rect x="${X(0)}" y="${Y(D)}" width="${w}" height="${(D * 0.55) * s}" fill="url(#hatch-flood)" class="zone-flood fade"/><text x="${X(W) - 4}" y="${Y(D) + 14}" class="t-note t-flood" text-anchor="end">SBO FLOOD EXTENT</text>`);
  if (p.ddoRear) out.push(`<rect x="${X(0)}" y="${Y(D)}" width="${w}" height="${plan.rear * s}" fill="url(#hatch-warn)" class="zone-warn fade"/>`);

  // Garden (open space) wash, then lot boundary
  out.push(`<rect x="${X(0)}" y="${Y(D)}" width="${w}" height="${h}" class="garden fade"/>`);
  out.push(`<rect x="${X(0)}" y="${Y(D)}" width="${w}" height="${h}" class="lot${anim}" pathLength="1"/>`);

  // Setback lines
  out.push(`<line x1="${X(0)}" y1="${Y(R.front)}" x2="${X(W)}" y2="${Y(R.front)}" class="setback${animate ? " fade" : ""}"/>
    <text x="${X(0) + 4}" y="${Y(R.front) + 11}" class="t-note">FRONT SETBACK ${f1(R.front)}</text>
    <line x1="${X(0)}" y1="${Y(plan.rearLine)}" x2="${X(W)}" y2="${Y(plan.rearLine)}" class="setback rear${animate ? " fade" : ""}"/>
    <text x="${X(0) + 4}" y="${Y(plan.rearLine) - 5}" class="t-note t-rear">REAR SETBACK ${f1(plan.rear)}${p.ddoRear ? " · DDO" : ""}</text>`);

  // Driveway along the right boundary
  if (plan.driveLen > 0) {
    const dx = X(W - R.drive), dh = plan.driveLen * s;
    out.push(`<rect x="${dx}" y="${Y(plan.driveLen)}" width="${R.drive * s}" height="${dh}" class="drive fade"/>
      <line x1="${dx + R.drive * s / 2}" y1="${Y(plan.driveLen) + 4}" x2="${dx + R.drive * s / 2}" y2="${Y(0)}" class="drive-cl"/>
      <text transform="translate(${dx + R.drive * s / 2 + 3},${Y(plan.driveLen / 2)}) rotate(-90)" class="t-note" text-anchor="middle">DRIVEWAY ${f1(R.drive)}</text>`);
  }

  // Retained heritage dwelling
  if (p.heritageDwelling) out.push(`<rect x="${X(R.side)}" y="${Y(R.front + R.heritageD)}" width="${10 * s}" height="${R.heritageD * s}" fill="url(#hatch-heritage)" class="heritage${anim}" pathLength="1"/>
    <text x="${X(R.side + 5)}" y="${Y(R.front + R.heritageD / 2)}" class="t-unit" text-anchor="middle">RETAINED</text>
    <text x="${X(R.side + 5)}" y="${Y(R.front + R.heritageD / 2) + 11}" class="t-dim" text-anchor="middle">HO dwelling</text>`);

  // Townhouses (kept + lost)
  plan.units.forEach((u, i) => {
    const cls = u.lost ? "unit lost" : "unit";
    out.push(`<g class="${cls} pop" style="--i:${i}">
      <rect x="${X(u.x)}" y="${Y(u.y + u.d)}" width="${u.w * s}" height="${u.d * s}" rx="1.5"/>
      <text x="${X(u.x + u.w / 2)}" y="${Y(u.y + u.d / 2) - 1}" class="t-unit" text-anchor="middle">${u.label}</text>
      <text x="${X(u.x + u.w / 2)}" y="${Y(u.y + u.d / 2) + 11}" class="t-dim" text-anchor="middle">${u.lost ? "doesn't fit" : `${f1(u.w)} × ${f1(u.d)}`}</text>
    </g>`);
  });

  // Tree + TPZ
  if (plan.tree) {
    const t = plan.tree;
    out.push(`<circle cx="${X(t.x)}" cy="${Y(t.y)}" r="${t.tpz * s}" class="tpz${animate ? " fade" : ""}"/>
      <circle cx="${X(t.x)}" cy="${Y(t.y)}" r="${t.canopy * s}" class="canopy fade"/>
      <text x="${X(t.x) + t.tpz * s + 4}" y="${Y(t.y) + 3}" class="t-note t-warn">TPZ ${f1(t.tpz)}</text>`);
  }

  // Service pit near the crossover
  if (p.servicePit) {
    const px = X(W - R.drive - 0.9), py = Y(0.9);
    out.push(`<rect x="${px - 4}" y="${py - 4}" width="8" height="8" class="pit"/>
      <line x1="${px - 5}" y1="${py - 2}" x2="${X(0) + 6 + 118}" y2="${Y(3.2) + 3}" class="leader"/>
      <text x="${X(0) + 4}" y="${Y(3.2)}" class="t-note t-warn">SERVICE PIT · CROSSOVER</text>`);
  }

  // Dimensions
  out.push(`<line x1="${X(0)}" y1="${Y(0) + 12}" x2="${X(W)}" y2="${Y(0) + 12}" class="dim" marker-start="url(#tick)" marker-end="url(#tick)"/>
    <text x="${X(W / 2)}" y="${Y(0) + 9}" class="t-dim" text-anchor="middle">${f1(W)} m</text>
    <line x1="${X(0) - 22}" y1="${Y(0)}" x2="${X(0) - 22}" y2="${Y(D)}" class="dim" marker-start="url(#tick)" marker-end="url(#tick)"/>
    <text transform="translate(${X(0) - 27},${Y(D / 2)}) rotate(-90)" class="t-dim" text-anchor="middle">${f1(D)} m</text>`);

  // North arrow (rear orientation sets which way north is)
  const rot = { north: 0, east: -90, south: 180, west: 90 }[(site.orientation.split(" ")[0] || "north").toLowerCase()] ?? 0;
  out.push(`<g transform="translate(${X(W) + 70},${oy + 34}) rotate(${rot})" class="north">
      <circle r="20" class="north-ring"/><path d="M0,-16 L6,8 L0,3 L-6,8 Z" class="north-arrow"/>
      <text y="-24" text-anchor="middle" transform="rotate(${-rot} 0 -28)" class="t-north">N</text></g>`);

  // Scale bar (10 m)
  const sb = 10 * s, sx = X(W) + 70 - sb / 2, sy = Y(0) + 72;
  out.push(`<g class="scale"><rect x="${sx}" y="${sy}" width="${sb / 2}" height="4" class="sb-a"/><rect x="${sx + sb / 2}" y="${sy}" width="${sb / 2}" height="4" class="sb-b"/>
    <text x="${sx}" y="${sy - 4}" class="t-dim">0</text><text x="${sx + sb}" y="${sy - 4}" class="t-dim" text-anchor="end">10 m</text></g>`);

  return `<svg viewBox="0 0 ${vbW} ${vbH}" class="plan-svg${animate ? " is-animating" : ""}" role="img" aria-label="Illustrative test-fit site plan for ${site.address}">${out.join("")}</svg>`;
}
