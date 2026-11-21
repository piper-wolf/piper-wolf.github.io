export type RiskCategory = "1" | "2" | "3" | "Unknown";

export interface InspectionCsvRow {
  Name?: string;
  "Inspection Date"?: string;
  "Risk Category"?: string;
  "Violation Description"?: string;
  Inspection_Serial_Num?: string;
  Business_ID?: string;
}

export interface Violation {
  violation_code: string;
  description: string;
}

export interface DatedInspection {
  date: string;
  violations: Violation[];
}

export interface Restaurant {
  name: string;
  riskCategory: RiskCategory;
  businessIdCount: number;
  inspections: DatedInspection[];
  lifetimeViolationCodes: string[];
  realViolationCodes: string[];
}

export interface AggregationStats {
  rowCount: number;
  restaurantCount: number;
  nameDateGroupCount: number;
  multiBusinessNameCount: number;
  perfectInspectionCount: number;
  restaurantsWithPerfectInspectionCount: number;
}

export interface GraphNode extends Restaurant {
  id: string;
  x: number;
  y: number;
}

export interface SimilarityEdge {
  source: string;
  target: string;
  score: number;
}

export interface SimilarityStats {
  candidateCodeFrequencyCutoff: number;
  excludedCodeCount: number;
  excludedCodeRestaurantMemberships: number;
  candidatePairMemberships: number;
  sizeRatioPrunedPairs: number;
  candidatePairsScored: number;
  thresholdQualifiedPairs: number;
  edgeCount: number;
  maximumDegree: number;
}

export interface SimilarityOptions {
  threshold?: number;
  codeFrequencyCutoff?: number;
  neighborLimit?: number;
  onProgress?: (candidatePairsScored: number) => void;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.55;
export const DEFAULT_CODE_FREQUENCY_CUTOFF = 1000;
export const DEFAULT_NEIGHBOR_LIMIT = 5;

interface ParsedDate {
  key: string;
  order: number;
}

interface MutableInspection {
  date: ParsedDate;
  hadBlankDescription: boolean;
  hasCodedViolation: boolean;
  violations: Map<string, Violation>;
}

interface MutableRestaurant {
  name: string;
  inspectionsBySerial: Map<string, MutableInspection>;
  businessIds: Set<string>;
  latestRiskOrder: number;
  riskCategory: RiskCategory;
}

const NONE_VIOLATION: Violation = { violation_code: "None", description: "" };
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRisks(a: RiskCategory, b: RiskCategory): number {
  const order = (risk: RiskCategory) => (risk === "Unknown" ? 4 : Number(risk));
  return order(a) - order(b);
}

function parseInspectionDate(value: string | undefined): ParsedDate {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value?.trim() ?? "");
  if (!match) return { key: "Unknown", order: Number.NEGATIVE_INFINITY };

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return { key: "Unknown", order: Number.NEGATIVE_INFINITY };
  }

  return {
    key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    order: timestamp,
  };
}

export function parseViolationDescription(value: string | undefined): Violation {
  const description = value?.trim() ?? "";
  if (!description) return { ...NONE_VIOLATION };

  const separator = description.indexOf(" - ");
  if (separator < 0) return { violation_code: description, description: "" };

  return {
    violation_code: description.slice(0, separator).trim(),
    description: description.slice(separator + 3).trim(),
  };
}

function violationKey(violation: Violation): string {
  return `${violation.violation_code}\u0000${violation.description}`;
}

function normalizedRisk(value: string): RiskCategory {
  return value === "1" || value === "2" || value === "3" ? value : "Unknown";
}

export class InspectionAggregator {
  private readonly restaurants = new Map<string, MutableRestaurant>();
  private rowCount = 0;

  addRow(row: InspectionCsvRow): void {
    this.rowCount++;
    const name = row.Name ?? "";
    if (!name) return;

    let restaurant = this.restaurants.get(name);
    if (!restaurant) {
      restaurant = {
        name,
        inspectionsBySerial: new Map(),
        businessIds: new Set(),
        latestRiskOrder: Number.NEGATIVE_INFINITY,
        riskCategory: "Unknown",
      };
      this.restaurants.set(name, restaurant);
    }

    const businessId = row.Business_ID?.trim();
    if (businessId) restaurant.businessIds.add(businessId);

    const date = parseInspectionDate(row["Inspection Date"]);
    const serial = row.Inspection_Serial_Num ?? "";
    const serialKey = `${date.key}\u0000${serial}`;
    let inspection = restaurant.inspectionsBySerial.get(serialKey);
    if (!inspection) {
      inspection = {
        date,
        hadBlankDescription: false,
        hasCodedViolation: false,
        violations: new Map(),
      };
      restaurant.inspectionsBySerial.set(serialKey, inspection);
    }

    const violation = parseViolationDescription(row["Violation Description"]);
    if (violation.violation_code === "None") {
      inspection.hadBlankDescription = true;
    } else {
      inspection.hasCodedViolation = true;
      inspection.violations.set(violationKey(violation), violation);
    }

    const riskValue = row["Risk Category"]?.trim() ?? "";
    if (riskValue) {
      const risk = normalizedRisk(riskValue);
      if (date.order > restaurant.latestRiskOrder ||
        (date.order === restaurant.latestRiskOrder && compareRisks(risk, restaurant.riskCategory) < 0)) {
        restaurant.latestRiskOrder = date.order;
        restaurant.riskCategory = risk;
      }
    }
  }

  finish(): { restaurants: Restaurant[]; stats: AggregationStats } {
    const mutableRestaurants = [...this.restaurants.values()].sort((a, b) => compareStrings(a.name, b.name));
    let nameDateGroupCount = 0;
    let multiBusinessNameCount = 0;
    let perfectInspectionCount = 0;
    let restaurantsWithPerfectInspectionCount = 0;

    const restaurants = mutableRestaurants.map((restaurant): Restaurant => {
      const byDate = new Map<string, { date: ParsedDate; violations: Map<string, Violation> }>();
      let restaurantHasPerfectInspection = false;

      for (const serialInspection of restaurant.inspectionsBySerial.values()) {
        let dated = byDate.get(serialInspection.date.key);
        if (!dated) {
          dated = { date: serialInspection.date, violations: new Map() };
          byDate.set(serialInspection.date.key, dated);
        }

        if (serialInspection.hasCodedViolation) {
          for (const [key, violation] of serialInspection.violations) dated.violations.set(key, violation);
        } else if (serialInspection.hadBlankDescription) {
          const key = violationKey(NONE_VIOLATION);
          dated.violations.set(key, NONE_VIOLATION);
          perfectInspectionCount++;
          restaurantHasPerfectInspection = true;
        }
      }

      if (restaurantHasPerfectInspection) restaurantsWithPerfectInspectionCount++;
      if (restaurant.businessIds.size > 1) multiBusinessNameCount++;

      const inspections = [...byDate.values()]
        .sort((a, b) => a.date.order - b.date.order || compareStrings(a.date.key, b.date.key))
        .map(({ date, violations }): DatedInspection => ({
          date: date.key,
          violations: [...violations.values()].sort((a, b) =>
            compareStrings(a.violation_code, b.violation_code) || compareStrings(a.description, b.description)),
        }));
      nameDateGroupCount += inspections.length;

      const lifetimeViolationCodes = new Set<string>();
      for (const inspection of inspections) {
        for (const violation of inspection.violations) lifetimeViolationCodes.add(violation.violation_code);
      }
      const lifetimeCodes = [...lifetimeViolationCodes].sort(compareStrings);

      return {
        name: restaurant.name,
        riskCategory: restaurant.riskCategory,
        businessIdCount: restaurant.businessIds.size,
        inspections,
        lifetimeViolationCodes: lifetimeCodes,
        realViolationCodes: lifetimeCodes.filter((code) => code !== "None"),
      };
    });

    return {
      restaurants,
      stats: {
        rowCount: this.rowCount,
        restaurantCount: restaurants.length,
        nameDateGroupCount,
        multiBusinessNameCount,
        perfectInspectionCount,
        restaurantsWithPerfectInspectionCount,
      },
    };
  }
}

function assignDeterministicPositions(restaurants: Restaurant[], codeFrequencies: Map<string, number>): Array<{ x: number; y: number }> {
  const groups = new Map<string, number[]>();
  restaurants.forEach((restaurant, index) => {
    const primaryCode = restaurant.realViolationCodes.length
      ? [...restaurant.realViolationCodes].sort((a, b) =>
          (codeFrequencies.get(a) ?? 0) - (codeFrequencies.get(b) ?? 0) || compareStrings(a, b))[0]
      : `None:${restaurant.riskCategory}`;
    const group = groups.get(primaryCode) ?? [];
    group.push(index);
    groups.set(primaryCode, group);
  });

  const groupKeys = [...groups.keys()].sort(compareStrings);
  const columns = Math.ceil(Math.sqrt(groupKeys.length));
  const rows = Math.ceil(groupKeys.length / columns);
  const cellSpacing = 110;
  const positions = new Array<{ x: number; y: number }>(restaurants.length);

  groupKeys.forEach((groupKey, groupIndex) => {
    const members = groups.get(groupKey)!;
    const centerX = (groupIndex % columns - (columns - 1) / 2) * cellSpacing;
    const centerY = (Math.floor(groupIndex / columns) - (rows - 1) / 2) * cellSpacing;
    const radius = Math.max(10, Math.sqrt(members.length) * 1.7);

    members.forEach((restaurantIndex, memberIndex) => {
      const angle = memberIndex * GOLDEN_ANGLE;
      const distance = radius * Math.sqrt((memberIndex + 0.5) / members.length);
      positions[restaurantIndex] = {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
      };
    });
  });

  return positions;
}

function riskSimilarity(a: RiskCategory, b: RiskCategory): number {
  if (a === "Unknown" || b === "Unknown") return 0.9;
  const difference = Math.abs(Number(a) - Number(b));
  return difference === 0 ? 1 : difference === 1 ? 0.9 : 0.8;
}

function pairIndex(a: number, b: number, nodeCount: number): number {
  return (a * (2 * nodeCount - a - 1)) / 2 + (b - a - 1);
}

export function buildSimilarityGraph(
  restaurants: Restaurant[],
  options: SimilarityOptions = {},
): { nodes: GraphNode[]; edges: SimilarityEdge[]; stats: SimilarityStats } {
  const threshold = options.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const codeFrequencyCutoff = options.codeFrequencyCutoff ?? DEFAULT_CODE_FREQUENCY_CUTOFF;
  const neighborLimit = options.neighborLimit ?? DEFAULT_NEIGHBOR_LIMIT;
  const codeFrequencies = new Map<string, number>();

  restaurants.forEach((restaurant) => {
    for (const code of restaurant.realViolationCodes) {
      codeFrequencies.set(code, (codeFrequencies.get(code) ?? 0) + 1);
    }
  });

  const positions = assignDeterministicPositions(restaurants, codeFrequencies);
  const nodes: GraphNode[] = restaurants.map((restaurant, index) => ({
    ...restaurant,
    id: String(index),
    ...positions[index],
  }));

  const buckets = new Map<string, number[]>();
  restaurants.forEach((restaurant, index) => {
    for (const code of restaurant.realViolationCodes) {
      const bucket = buckets.get(code) ?? [];
      bucket.push(index);
      buckets.set(code, bucket);
    }
  });

  const candidateBuckets = [...buckets.entries()]
    .filter(([, members]) => members.length <= codeFrequencyCutoff)
    .sort(([a], [b]) => compareStrings(a, b));
  const excludedBuckets = [...buckets.values()].filter((members) => members.length > codeFrequencyCutoff);
  const seenPairs = new Uint8Array(Math.ceil((restaurants.length * (restaurants.length - 1) / 2) / 8));
  const realCodeSets = restaurants.map((restaurant) => new Set(restaurant.realViolationCodes));
  const topNeighbors = Array.from({ length: restaurants.length }, () => [] as Array<{ neighbor: number; score: number }>);

  let candidatePairMemberships = 0;
  let sizeRatioPrunedPairs = 0;
  let candidatePairsScored = 0;
  let thresholdQualifiedPairs = 0;

  const keepTopNeighbor = (node: number, neighbor: number, score: number) => {
    const list = topNeighbors[node];
    let insertAt = list.findIndex((candidate) => score > candidate.score ||
      (score === candidate.score && neighbor < candidate.neighbor));
    if (insertAt < 0) insertAt = list.length;
    list.splice(insertAt, 0, { neighbor, score });
    if (list.length > neighborLimit) list.pop();
  };

  for (const [, members] of candidateBuckets) {
    for (let left = 0; left < members.length; left++) {
      const a = members[left];
      const setA = realCodeSets[a];
      for (let right = left + 1; right < members.length; right++) {
        candidatePairMemberships++;
        const b = members[right];
        const setB = realCodeSets[b];
        const smaller = Math.min(setA.size, setB.size);
        const larger = Math.max(setA.size, setB.size);
        if (!larger || smaller / larger < threshold) {
          sizeRatioPrunedPairs++;
          continue;
        }

        const index = pairIndex(a, b, restaurants.length);
        const byteIndex = Math.floor(index / 8);
        const mask = 1 << (index % 8);
        if (seenPairs[byteIndex] & mask) continue;
        seenPairs[byteIndex] |= mask;
        candidatePairsScored++;

        let intersection = 0;
        const smallerSet = setA.size <= setB.size ? setA : setB;
        const largerSet = smallerSet === setA ? setB : setA;
        for (const code of smallerSet) if (largerSet.has(code)) intersection++;
        const jaccard = intersection / (setA.size + setB.size - intersection);
        const score = jaccard * riskSimilarity(restaurants[a].riskCategory, restaurants[b].riskCategory);
        if (score < threshold) continue;

        thresholdQualifiedPairs++;
        keepTopNeighbor(a, b, score);
        keepTopNeighbor(b, a, score);
        if (candidatePairsScored % 250_000 === 0) options.onProgress?.(candidatePairsScored);
      }
    }
  }

  const edges: SimilarityEdge[] = [];
  const degrees = new Uint8Array(restaurants.length);
  for (let source = 0; source < topNeighbors.length; source++) {
    for (const candidate of topNeighbors[source]) {
      if (source >= candidate.neighbor) continue;
      if (!topNeighbors[candidate.neighbor].some((reverse) => reverse.neighbor === source)) continue;
      edges.push({ source: String(source), target: String(candidate.neighbor), score: candidate.score });
      degrees[source]++;
      degrees[candidate.neighbor]++;
    }
  }
  edges.sort((a, b) => Number(a.source) - Number(b.source) || Number(a.target) - Number(b.target));

  return {
    nodes,
    edges,
    stats: {
      candidateCodeFrequencyCutoff: codeFrequencyCutoff,
      excludedCodeCount: excludedBuckets.length,
      excludedCodeRestaurantMemberships: excludedBuckets.reduce((sum, members) => sum + members.length, 0),
      candidatePairMemberships,
      sizeRatioPrunedPairs,
      candidatePairsScored,
      thresholdQualifiedPairs,
      edgeCount: edges.length,
      maximumDegree: degrees.reduce((maximum, degree) => Math.max(maximum, degree), 0),
    },
  };
}
