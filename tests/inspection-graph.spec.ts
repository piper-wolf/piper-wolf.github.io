import { expect, test } from "./helpers/browser";
import { buildSimilarityGraph, InspectionAggregator, parseViolationDescription, type Restaurant } from "../src/lib/inspection-graph";

test("inspection transforms keep separate businesses and preserve their most recent details", async () => {
  expect(parseViolationDescription("0600 - Cold holding - food prep area")).toEqual({
    violation_code: "0600",
    description: "Cold holding - food prep area",
  });
  expect(parseViolationDescription("  ")).toEqual({ violation_code: "None", description: "" });

  const aggregator = new InspectionAggregator();
  const rows = [
    { Name: "Former Cafe", Address: "123 Old Street", City: "Seattle", "Inspection Date": "01/02/2025", "Risk Category": "1", "Violation Description": "", Inspection_Serial_Num: "old-perfect", Business_ID: "business-a" },
    { Name: "Cafe A", Address: "456 New Street", "Inspection Date": "01/02/2026", "Risk Category": "3", "Violation Description": "", Inspection_Serial_Num: "same-day-perfect", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "1/2/2026", "Risk Category": "", "Violation Type": " red ", "Violation Description": "0600 - Cold holding - food prep area", Inspection_Serial_Num: "same-day-violation", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "0200 - Food worker hygiene", Inspection_Serial_Num: "mixed-serial", Business_ID: "business-a" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "", Inspection_Serial_Num: "mixed-serial", Business_ID: "business-a" },
    { Name: "Cafe A", Address: "789 Main Street", "Inspection Date": "01/02/2026", "Risk Category": "2", "Violation Description": "", Inspection_Serial_Num: "mixed-serial-b", Business_ID: "business-b" },
    { Name: "Cafe A", "Inspection Date": "01/02/2026", "Risk Category": "", "Violation Description": "0600 - Cold holding - food prep area", Inspection_Serial_Num: "mixed-serial-b", Business_ID: "business-b" },
    { Name: "No ID Cafe", "Inspection Date": "01/02/2026", "Violation Description": "" },
  ];
  for (const row of rows) aggregator.addRow(row);

  const result = aggregator.finish();
  const cafeA = result.restaurants.find(({ businessId }) => businessId === "business-a")!;
  const cafeB = result.restaurants.find(({ businessId }) => businessId === "business-b")!;
  const cafeALatestDay = cafeA.inspections.find(({ date }) => date === "2026-01-02")!;
  const cafeBLatestDay = cafeB.inspections[0];

  expect(result.restaurants).toHaveLength(2);
  expect(cafeA).toMatchObject({ name: "Cafe A", address: "456 New Street", city: "Seattle", riskCategory: "3" });
  expect(cafeB).toMatchObject({ name: "Cafe A", address: "789 Main Street", riskCategory: "2" });
  expect(cafeA.inspections).toHaveLength(2);
  expect(cafeALatestDay.violations.map(({ violation_code }) => violation_code)).toEqual(["0200", "0600", "None"]);
  expect(cafeALatestDay.violations).toContainEqual({ violation_code: "0600", description: "Cold holding - food prep area", type: "RED" });
  expect(cafeA.realViolationCodes).toEqual(["0200", "0600"]);
  expect(cafeA.lifetimeViolationCodes).toContain("None");
  expect(cafeBLatestDay.violations.map(({ violation_code }) => violation_code)).toEqual(["0600"]);
  expect(cafeB.lifetimeViolationCodes).not.toContain("None");
  expect(result.stats.businessDateGroupCount).toBe(3);
  expect(result.stats.multiBusinessNameCount).toBe(1);
  expect(result.stats.missingBusinessIdRowCount).toBe(1);
  expect(result.stats.perfectInspectionCount).toBe(2);
});

test("similarity uses recent shared violations and requires meaningful evidence", async () => {
  const issue = (code: string, type: "RED" | "BLUE") => ({
    violation_code: code, description: `Issue ${code}`, type,
  });
  const cold = issue("2110", "RED");
  const otherColdBand = issue("2120", "RED");
  const cleaning = issue("3400", "BLUE");
  const posting = issue("5100", "BLUE");
  const none = { violation_code: "None", description: "" };
  const restaurant = (name: string, riskCategory: Restaurant["riskCategory"], inspections: Restaurant["inspections"]): Restaurant => ({
    name, businessId: name, address: "", city: "", riskCategory, inspections,
    lifetimeViolationCodes: [], realViolationCodes: [],
  });
  const day = (date: string, ...violations: Restaurant["inspections"][number]["violations"]) => ({ date, violations });
  const restaurants = [
    restaurant("A", "1", [day("2025-07-01", cold, otherColdBand), day("2026-07-01", cold, cleaning, none)]),
    restaurant("B", "3", [day("2025-07-01", otherColdBand), day("2026-07-01", otherColdBand, cleaning, posting)]),
    restaurant("C", "3", [day("2025-07-01", cold), day("2026-07-01", cold)]),
    restaurant("D", "1", [day("2022-07-01", cold), day("2026-07-01", cleaning, posting)]),
  ];

  const { nodes, edges } = buildSimilarityGraph(restaurants);
  expect(nodes).toHaveLength(4);
  expect(edges.map(({ source, target }) => [source, target])).toEqual([["0", "1"], ["0", "2"], ["1", "2"]]);
  expect(edges[0].score).toBeCloseTo(1);
  const sharedCold = {
    ...cold, violation_code: "2110 / 2120", description: "Food held cold above the required temperature",
    sourceDates: 2, targetDates: 2,
  };
  expect(edges[0].sharedViolations).toEqual([
    sharedCold,
    { ...cleaning, sourceDates: 1, targetDates: 1 },
  ]);
  expect(edges[1].score).toBeLessThan(0.75);
  expect(edges[1].sharedViolations).toEqual([sharedCold]);
  expect(buildSimilarityGraph(restaurants, { neighborLimit: 1 }).edges).toHaveLength(1);
});
