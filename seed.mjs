// Seeded pre-assessment for demo. Written to read like real model output:
// it connects evidence across fields instead of restating the table.
export const seedAssessment = {
  seeded: true,
  leader: "a",
  why:
    "12 Example St is the only site where zone, frontage and comparable evidence all support the 3-townhouse strategy, and its one overlay affects the rear setback rather than the yield itself. 48 Sample Ave is cheaper but its 12.8 m frontage and thin sales evidence make both the design and the end value uncertain; 7 Placeholder Ct fails on zoning before the overlays are even considered.",
  sharedRisks: [
    "None of the three has had a title or covenant search yet, so a restriction on multi-dwelling use could apply to any of them.",
    "Planning data may lag recent scheme amendments. Controls need confirming with Council on every site.",
    "All end values rest on recent townhouse sales. None has been tested with presales.",
  ],
  upset:
    "48 Sample Ave's problems are mostly resolvable: if the arborist sets a small tree protection zone and the vendor drops about 10%, it becomes a cheaper route to 3 dwellings. 7 Placeholder Ct's zoning is structural, so it can't overtake either site.",
  sites: [
    {
      id: "a",
      verdict: "Shortlist",
      fixability: "Resolvable",
      fixNote: "A planner-led layout can likely fit 3 dwellings within the setback; worst case is a smaller third unit.",
      distinguishing: "The only site whose main risk is design, not zoning, geometry or evidence.",
      dealBreaker:
        "The DDO rear-setback control could push the third townhouse forward into the garden-area requirement; if the setback exceeds ~6 m, yield likely drops to 2 and the 26% margin falls below target.",
      missingDD: [
        "DDO schedule text: exact rear setback and height controls",
        "Service authority check on the pit near the crossover (driveway location)",
        "Title search for covenants restricting multi-dwelling use",
        "Survey of site levels given the fall to the street",
      ],
      nextStep:
        "Brief a town planner on the DDO schedule with a 3-townhouse test layout this week, and request the contract of sale before the next inspection.",
    },
    {
      id: "b",
      verdict: "Monitor",
      fixability: "Partly resolvable",
      fixNote: "The tree and the price can move; the 12.8 m frontage cannot.",
      distinguishing: "Cheapest entry, but the thinnest sales evidence and the narrowest frontage.",
      dealBreaker:
        "12.8 m frontage limits the layout to a battle-axe driveway, which together with the canopy tree near the rear boundary likely removes the third dwelling. At 2 dwellings the site doesn't stack up at the asking price.",
      missingDD: [
        "Arborist report: tree protection zone of the rear canopy tree",
        "More comparable sales. Only 4 recent townhouse sales support a $980k end value",
        "Council position on battle-axe access in this precinct",
      ],
      nextStep:
        "Don't commit spend yet. Get an arborist's desktop opinion on the tree; revisit if the price drops about 10% or the tree zone is small.",
    },
    {
      id: "c",
      verdict: "Pass",
      fixability: "Structural",
      fixNote: "NRZ zoning and heritage protection can't be designed around for a 3-townhouse product.",
      distinguishing: "The only site where zoning itself rules out the strategy.",
      dealBreaker:
        "NRZ zoning caps the site at 2 dwellings. With a Heritage Overlay likely protecting the period house, the realistic outcome is one new dwelling at the rear, and the flood overlay (SBO) adds floor-level constraints on top.",
      missingDD: [
        "Heritage citation: is the dwelling individually significant or contributory",
        "Melbourne Water flood level advice for the SBO",
      ],
      nextStep:
        "Pass for this strategy. Keep it only as a possible single-dwelling or renovation play if a different client brief comes up.",
    },
  ],
};
