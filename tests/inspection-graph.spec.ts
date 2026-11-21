import { expect, test } from "./helpers/browser";
import { sharedInspectionFeatures } from "../src/lib/inspection-features";
import { filterBusinesses } from "../src/lib/inspection-view";
import { layoutFilteredBusinesses } from "../src/lib/inspection-layout";
import { buildSimilarityGraph, createInspectionPairScorer, InspectionAggregator, parseViolationDescription, type Restaurant } from "../src/lib/inspection-graph";

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

test("similarity connects recurring topics and the comparison intersects every profile", async () => {
  const issue = (code: string, type: "RED" | "BLUE") => ({
    violation_code: code, description: `Issue ${code}`, type,
  });
  const cold = issue("2110", "RED");
  const otherColdBand = issue("2120", "RED");
  const cleaning = issue("3400", "BLUE");
  const hands = issue("0400", "RED");
  const sinks = issue("0600", "RED");
  const gloves = issue("0500", "RED");
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
    restaurant("E", "2", [day("2025-07-01", hands), day("2026-07-01", hands)]),
    restaurant("F", "2", [day("2025-07-01", sinks), day("2026-07-01", sinks)]),
    restaurant("G", "2", [day("2026-07-01", gloves)]),
  ];

  const { nodes, edges } = buildSimilarityGraph(restaurants);
  expect(nodes.map(({ topic }) => topic)).toEqual(["cold", "cold", "cold", "sanitation", "hygiene", "hygiene", "hygiene"]);
  expect(nodes[0].profile).toMatchObject({
    dateCount: 2,
    topics: [{ id: "cold", dates: 2, criticalDates: 2 }, { id: "sanitation", dates: 1, criticalDates: 0 }],
  });
  expect(nodes[3].profile.findings.map(({ id }) => id)).toEqual(["3400"]);
  expect(edges.map(({ source, target }) => [source, target])).toEqual([["0", "1"], ["0", "2"], ["1", "2"], ["4", "5"]]);
  expect(edges[0].score).toBeCloseTo(1);
  expect(edges[1].score).toBeLessThan(1);

  const profiles = nodes.map(({ profile }) => profile);
  expect(sharedInspectionFeatures(profiles.slice(0, 2), "findings").map(({ id, dates }) => ({ id, dates }))).toEqual([
    { id: "2110 / 2120", dates: [2, 2] },
    { id: "3400", dates: [1, 1] },
  ]);
  expect(sharedInspectionFeatures(profiles.slice(0, 3), "findings")).toEqual([
    { id: "2110 / 2120", label: "Food held cold above the required temperature", dates: [2, 2, 2] },
  ]);
  expect(sharedInspectionFeatures(profiles.slice(0, 4), "topics")).toEqual([]);
  expect(sharedInspectionFeatures(profiles.slice(4, 6), "findings")).toEqual([]);
  expect(sharedInspectionFeatures(profiles.slice(4, 6), "topics")).toEqual([
    { id: "hygiene", label: "Handwashing & hygiene", dates: [2, 2] },
  ]);
  const scorePair = createInspectionPairScorer(nodes);
  expect(scorePair(0, 2)).toBeCloseTo(edges[1].score);
  expect(scorePair(0, 3)).toBeGreaterThan(0);
  expect(scorePair(0, 4)).toBe(0);

  const filters = { query: "", city: "", preparation: "", topic: "", pattern: "" };
  expect(filterBusinesses(nodes, { ...filters, topic: "sanitation" }).map(({ name }) => name)).toEqual(["A", "B", "D"]);
  expect(filterBusinesses(nodes, { ...filters, topic: "sanitation", pattern: "repeated-critical" })).toEqual([]);
  expect(filterBusinesses(nodes, { ...filters, preparation: "2", topic: "hygiene", pattern: "repeated-critical" })
    .map(({ name }) => name)).toEqual(["E", "F"]);
  const positions = layoutFilteredBusinesses([{
    nodes: [{ id: "0", x: -90, y: 0 }, { id: "1", x: 90, y: 0 }, { id: "3", x: -88, y: 3 }],
    edges: [edges[0]],
    frame: { x: 300, y: -10, radius: 40 },
  }]);
  const a = positions.get("0")!;
  const b = positions.get("1")!;
  const isolated = positions.get("3")!;
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(Math.hypot(a.x - isolated.x, a.y - isolated.y));
  for (const { x, y } of positions.values()) {
    expect(Math.abs(x - 300)).toBeLessThanOrEqual(40);
    expect(Math.abs(y + 10)).toBeLessThanOrEqual(40);
  }
  expect(buildSimilarityGraph(restaurants, { neighborLimit: 1 }).edges).toHaveLength(2);
});
