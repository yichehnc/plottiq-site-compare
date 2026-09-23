// Mock data — illustrative sites only. Swap for real data if given in the test.
export const strategy = {
  name: "3-townhouse infill",
  product: "3 townhouses",
  zones: ["GRZ"],
  minArea: 700,      // m²
  minFrontage: 15,   // m
  maxPrice: 1_600_000,
  targetMargin: 0.2,
};

// Field provenance: "source" = as received, "calc" = derived in code, "ai" = model output
export const sites = [
  {
    id: "a",
    address: "12 Example St, Preston VIC",
    price: 1_450_000,
    area: 836,
    frontage: 18.2,
    orientation: "North rear",
    zone: "GRZ",
    overlays: ["DDO (rear setback)"],
    comparableSales: 12,
    medianTownhouse: 1_250_000,
    notes: "Gentle fall to street. Service pit near crossover.",
  },
  {
    id: "b",
    address: "48 Sample Ave, Reservoir VIC",
    price: 1_250_000,
    area: 912,
    frontage: 12.8,
    orientation: "South rear",
    zone: "GRZ",
    overlays: [],
    comparableSales: 4,
    medianTownhouse: 980_000,
    notes: "Battle-axe driveway possible. Large canopy tree near rear boundary.",
  },
  {
    id: "c",
    address: "7 Placeholder Ct, Coburg VIC",
    price: 1_580_000,
    area: 781,
    frontage: 16.4,
    orientation: "East rear",
    zone: "NRZ",
    overlays: ["Heritage (HO)", "Special Building Overlay (flood)"],
    comparableSales: 9,
    medianTownhouse: 1_200_000,
    notes: "Period dwelling on site. Laneway at rear.",
  },
];
