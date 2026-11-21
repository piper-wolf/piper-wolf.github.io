import { expect, test } from "./helpers/browser";
import { buildSimilarityGraph, InspectionAggregator, parseViolationDescription, type Restaurant } from "../src/lib/inspection-graph";

test("inspection transforms preserve codes, serial-level perfect inspections, and latest risk", async () => {
  expect(parseViolationDescription("0600 - Cold holding - food prep area")).toEqual({
    violation_code: "0600",
    description: "Cold holding - food prep area",
  });
  expect(parseViolationDescription("  ")).toEqual({ violation_code: "None", description: "" });

  const aggregator = new InspectionAggregator();
  const rows = [
    { Name: "Cafe A", "Inspection Date": "01/02/2025", "Risk Category": "1", "Violation Description": "", Inspection_Serial_Num: "old-perfect", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "3", "Violation Description": "", Inspection_Serial_Num: "same-day-perfect", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "1/2/2026", "Risk Category": "", "Violation Description": "0600 - Cold holding - food prep area", Inspection_Serial_Num: "same-day-violation", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "0200 - Food worker hygiene", Inspection_Serial_Num: "mixed-serial", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "", Inspection_Serial_Num: "mixed-serial", Business_ID: "business-a" },
    { Name: "Cafe B", "Inspection Date": "01/02/2026", "Risk Category": "2", "Violation Description": "", Inspection_Serial_Num: "mixed-serial-b", Business_ID: "business-b" },
    { Name: "Cafe B", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "0600 - Cold holding - food prep area", Inspection_Serial_Num: "mixed-serial-b", Business_ID: "business-b" },
  ];
  for (const row of rows) aggregator.addRow(row);

  const result = aggregator.finish();
  const cafeA = result.restaurants.find(({ name }) => name === "Cafe A")!;
  const cafeB = result.restaurants.find(({ name }) => name === "Cafe B")!;
  const cafeALatestDay = cafeA.inspections.find(({ date }) => date === "2026-01-02")!;
  const cafeBLatestDay = cafeB.inspections[0];

  expect(cafeA.riskCategory).toBe("3");
  expect(cafeA.inspections).toHaveLength(2);
  expect(cafeALatestDay.violations.map(({ violation_code }) => violation_code)).toEqual(["0200", "0600", "None"]);
  expect(cafeA.realViolationCodes).toEqual(["0200", "0600"]);
  expect(cafeA.lifetimeViolationCodes).toContain("None");
  expect(cafeBLatestDay.violations.map(({ violation_code }) => violation_code)).toEqual(["0600"]);
  expect(cafeB.lifetimeViolationCodes).not.toContain("None");
  expect(result.stats.nameDateGroupCount).toBe(3);
  expect(result.stats.perfectInspectionCount).toBe(2);
});

test("similarity edges ignore perfect inspections, weight risk, and keep only mutual top neighbors", async () => {
  const restaurant = (name: string, riskCategory: Restaurant["riskCategory"], realCodes: string[]): Restaurant => ({
    name,
    riskCategory,
    businessIdCount: 1,
    inspections: [],
    lifetimeViolationCodes: [...realCodes, "None"],
    realViolationCodes: realCodes,
  });
  const restaurants = [
    restaurant("A", "1", ["0100", "0200"]),
    restaurant("B", "3", ["0100", "0200"]),
    restaurant("C", "Unknown", ["0100", "0200"]),
    restaurant("D", "1", ["0100"]),
  ];

  const allMatches = buildSimilarityGraph(restaurants);
  expect(allMatches.edges.map(({ source, target, score }) => [source, target, score])).toEqual([
    ["0", "1", 0.8],
    ["0", "2", 0.9],
    ["1", "2", 0.9],
  ]);
  expect(allMatches.stats.sizeRatioPrunedPairs).toBeGreaterThan(0);

  const strongestMutual = buildSimilarityGraph(restaurants, { neighborLimit: 1 });
  expect(strongestMutual.edges).toEqual([{ source: "0", target: "2", score: 0.9 }]);
  expect(strongestMutual.nodes).toHaveLength(4);
});
