// Deterministic, explainable rules. The AI interprets; code calculates.

// Rough yield: GRZ ~ 1 dwelling / 250 m², NRZ capped at 2.
export function estYield(site) {
  const byArea = Math.floor(site.area / 250);
  return site.zone === "NRZ" ? Math.min(byArea, 2) : Math.min(byArea, 4);
}

// Very rough feaso: GRV vs land + build (~$380k/townhouse) + costs (~10% of GRV)
export function quickFeaso(site, units = estYield(site)) {
  const grv = units * site.medianTownhouse;
  const cost = site.price + units * 380_000 + grv * 0.10;
  const margin = grv ? (grv - cost) / cost : 0;
  return { units, grv, cost, margin };
}

export function riskFlags(site, s) {
  const f = [];
  if (!s.zones.includes(site.zone)) f.push({ level: "danger", text: `${site.zone} zone outside strategy` });
  if (site.area < s.minArea) f.push({ level: "warn", text: `Area below ${s.minArea} m²` });
  if (site.frontage < s.minFrontage) f.push({ level: "warn", text: `Frontage below ${s.minFrontage} m` });
  if (site.price > s.maxPrice) f.push({ level: "warn", text: "Over budget" });
  if (site.comparableSales < 6) f.push({ level: "warn", text: "Thin comparable evidence" });
  if (/south/i.test(site.orientation)) f.push({ level: "warn", text: "South-facing rear" });
  for (const o of site.overlays) {
    const lvl = /heritage|flood|SBO/i.test(o) ? "danger" : "warn";
    f.push({ level: lvl, text: `Overlay: ${o}` });
  }
  const { margin } = quickFeaso(site);
  if (margin < s.targetMargin) f.push({ level: margin < 0.1 ? "danger" : "warn", text: `Margin ${(margin * 100).toFixed(0)}% < ${s.targetMargin * 100}% target` });
  return f;
}

// Simple score: start at 100, subtract per flag. Transparent on purpose.
export function score(site, s) {
  return Math.max(0, 100 - riskFlags(site, s).reduce((t, f) => t + (f.level === "danger" ? 25 : 10), 0));
}
