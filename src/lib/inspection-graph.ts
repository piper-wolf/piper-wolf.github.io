import {
  buildInspectionProfile, inspectionTopics, isScoredViolation, otherTopic, PROFILE_YEARS, yearsBefore,
  type InspectionFeature, type InspectionProfile,
} from "./inspection-features";

export type RiskCategory = "1" | "2" | "3" | "Unknown";

export interface InspectionCsvRow {
  Name?: string;
  Address?: string;
  City?: string;
  "Inspection Date"?: string;
  "Risk Category"?: string;
  "Violation Description"?: string;
  "Violation Type"?: string;
  Inspection_Serial_Num?: string;
  Business_ID?: string;
}

export interface Violation {
  violation_code: string;
  description: string;
  type?: "RED" | "BLUE";
}

export interface DatedInspection {
  date: string;
  violations: Violation[];
}

export interface Restaurant {
  businessId: string;
  name: string;
  address: string;
  city: string;
  riskCategory: RiskCategory;
  inspections: DatedInspection[];
  lifetimeViolationCodes: string[];
  realViolationCodes: string[];
}

export interface AggregationStats {
  rowCount: number;
  missingBusinessIdRowCount: number;
  restaurantCount: number;
  businessDateGroupCount: number;
  multiBusinessNameCount: number;
  perfectInspectionCount: number;
  restaurantsWithPerfectInspectionCount: number;
}

export interface GraphNode extends Restaurant {
  id: string;
  x: number;
  y: number;
  profile: InspectionProfile;
  topic: string;
}

export interface SimilarityEdge {
  source: string;
  target: string;
  score: number;
}

export interface SimilarityStats {
  candidatePairsScored: number;
  thresholdQualifiedPairs: number;
  edgeCount: number;
  maximumDegree: number;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.40;
export const STRONG_SIMILARITY_THRESHOLD = 0.65;
const DEFAULT_NEIGHBOR_LIMIT = 4;

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

interface RecordedText {
  value: string;
  dateOrder: number;
}

interface MutableRestaurant {
  businessId: string;
  name?: RecordedText;
  address?: RecordedText;
  city?: RecordedText;
  inspectionsBySerial: Map<string, MutableInspection>;
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

function recordViolation(violations: Map<string, Violation>, violation: Violation): void {
  const key = violationKey(violation);
  const existing = violations.get(key);
  if (!existing || (violation.type && !existing.type) || violation.type === "RED") {
    violations.set(key, violation);
  }
}

function latestRecordedText(current: RecordedText | undefined, raw: string | undefined, dateOrder: number): RecordedText | undefined {
  const value = raw?.trim();
  if (!value) return current;
  if (!current || dateOrder > current.dateOrder || (dateOrder === current.dateOrder && value < current.value)) {
    return { value, dateOrder };
  }
  return current;
}

function normalizedRisk(value: string): RiskCategory {
  return value === "1" || value === "2" || value === "3" ? value : "Unknown";
}

export class InspectionAggregator {
  private readonly restaurants = new Map<string, MutableRestaurant>();
  private rowCount = 0;
  private missingBusinessIdRowCount = 0;

  addRow(row: InspectionCsvRow): void {
    this.rowCount++;
    const businessId = row.Business_ID?.trim();
    if (!businessId) {
      this.missingBusinessIdRowCount++;
      return;
    }

    let restaurant = this.restaurants.get(businessId);
    if (!restaurant) {
      restaurant = {
        businessId,
        inspectionsBySerial: new Map(),
        latestRiskOrder: Number.NEGATIVE_INFINITY,
        riskCategory: "Unknown",
      };
      this.restaurants.set(businessId, restaurant);
    }

    const date = parseInspectionDate(row["Inspection Date"]);
    restaurant.name = latestRecordedText(restaurant.name, row.Name, date.order);
    restaurant.address = latestRecordedText(restaurant.address, row.Address, date.order);
    restaurant.city = latestRecordedText(restaurant.city, row.City, date.order);

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
      const type = row["Violation Type"]?.trim().toUpperCase();
      if (type === "RED" || type === "BLUE") violation.type = type;
      recordViolation(inspection.violations, violation);
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
    const mutableRestaurants = [...this.restaurants.values()].sort((a, b) =>
      compareStrings(a.name?.value ?? a.businessId, b.name?.value ?? b.businessId) ||
      compareStrings(a.businessId, b.businessId));
    const businessCountsByName = new Map<string, number>();
    let businessDateGroupCount = 0;
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
          for (const violation of serialInspection.violations.values()) recordViolation(dated.violations, violation);
        } else if (serialInspection.hadBlankDescription) {
          const key = violationKey(NONE_VIOLATION);
          dated.violations.set(key, NONE_VIOLATION);
          perfectInspectionCount++;
          restaurantHasPerfectInspection = true;
        }
      }

      if (restaurantHasPerfectInspection) restaurantsWithPerfectInspectionCount++;
      const name = restaurant.name?.value ?? `Business ${restaurant.businessId}`;
      businessCountsByName.set(name, (businessCountsByName.get(name) ?? 0) + 1);

      const inspections = [...byDate.values()]
        .sort((a, b) => a.date.order - b.date.order || compareStrings(a.date.key, b.date.key))
        .map(({ date, violations }): DatedInspection => ({
          date: date.key,
          violations: [...violations.values()].sort((a, b) =>
            compareStrings(a.violation_code, b.violation_code) || compareStrings(a.description, b.description)),
        }));
      businessDateGroupCount += inspections.length;

      const lifetimeViolationCodes = new Set<string>();
      for (const inspection of inspections) {
        for (const violation of inspection.violations) lifetimeViolationCodes.add(violation.violation_code);
      }
      const lifetimeCodes = [...lifetimeViolationCodes].sort(compareStrings);

      return {
        businessId: restaurant.businessId,
        name,
        address: restaurant.address?.value ?? "",
        city: restaurant.city?.value ?? "",
        riskCategory: restaurant.riskCategory,
        inspections,
        lifetimeViolationCodes: lifetimeCodes,
        realViolationCodes: lifetimeCodes.filter((code) => code !== "None"),
      };
    });

    return {
      restaurants,
      stats: {
        rowCount: this.rowCount,
        missingBusinessIdRowCount: this.missingBusinessIdRowCount,
        restaurantCount: restaurants.length,
        businessDateGroupCount,
        multiBusinessNameCount: Array.from(businessCountsByName.values()).filter((count) => count > 1).length,
        perfectInspectionCount,
        restaurantsWithPerfectInspectionCount,
      },
    };
  }
}

function assignDeterministicPositions(profiles: InspectionProfile[], topics: string[], edges: SimilarityEdge[]) {
  const neighbors = profiles.map(() => [] as number[]);
  for (const { source, target } of edges) {
    const a = Number(source);
    const b = Number(target);
    if (topics[a] === topics[b]) {
      neighbors[a].push(b);
      neighbors[b].push(a);
    }
  }

  const groups = Map.groupBy(profiles.keys(), index => topics[index]);
  const groupKeys = [...inspectionTopics, otherTopic].map(({ id }) => id).filter(id => groups.has(id));
  const columns = Math.min(3, groupKeys.length);
  const spacing = Math.sqrt(Math.max(0, ...[...groups.values()].map(group => group.length))) * 2.55;
  const positions = new Array<{ x: number; y: number }>(profiles.length);
  const visited = new Set<number>();

  groupKeys.forEach((groupKey, groupIndex) => {
    const members = groups.get(groupKey)!;
    const centerX = (groupIndex % columns) * spacing;
    const centerY = -Math.floor(groupIndex / columns) * spacing;
    const ordered: number[] = [];

    for (const root of [...members].sort((a, b) => neighbors[b].length - neighbors[a].length)) {
      if (visited.has(root)) continue;
      visited.add(root);
      const start = ordered.length;
      ordered.push(root);
      for (let i = start; i < ordered.length; i++) {
        for (const neighbor of neighbors[ordered[i]]) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          ordered.push(neighbor);
        }
      }
    }

    ordered.forEach((index, rank) => {
      const distance = Math.sqrt(rank + 0.5);
      positions[index] = {
        x: centerX + Math.cos(rank * GOLDEN_ANGLE) * distance,
        y: centerY + Math.sin(rank * GOLDEN_ANGLE) * distance,
      };
    });
  });
  return positions;
}

function latestInspectionDate(restaurant: Restaurant): string {
  return restaurant.inspections.findLast(({ date }) => date !== "Unknown")?.date ?? "";
}

export function latestDataDate(restaurants: Restaurant[]): string {
  return restaurants.reduce((latest, restaurant) => {
    const date = latestInspectionDate(restaurant);
    return date > latest ? date : latest;
  }, "");
}

export function selectRelevantRestaurants(restaurants: Restaurant[], limit = 1800): Restaurant[] {
  const snapshot = latestDataDate(restaurants);
  if (!snapshot) return [];
  const activeCutoff = yearsBefore(snapshot, 1);
  const evidenceCutoff = yearsBefore(snapshot, PROFILE_YEARS);

  const ranked = restaurants
    .map((restaurant) => ({ restaurant, latest: latestInspectionDate(restaurant) }))
    .filter(({ latest }) => latest >= activeCutoff)
    .map((entry) => {
      const recent = entry.restaurant.inspections.filter(({ date }) => date !== "Unknown" && date >= evidenceCutoff);
      return {
        ...entry,
        dates: recent.length,
        datesWithViolations: recent.filter(({ violations }) =>
          violations.some(isScoredViolation)).length,
      };
    })
    .filter(({ datesWithViolations }) => datesWithViolations > 0)
    .sort((a, b) => b.dates - a.dates || compareStrings(b.latest, a.latest) ||
      compareStrings(a.restaurant.businessId, b.restaurant.businessId));

  const byPreparation = Map.groupBy(ranked, ({ restaurant }) => restaurant.riskCategory);
  const target = Math.min(limit, ranked.length);
  const selected: Restaurant[] = [];
  let includedInQuota = 0;
  // Round cumulative quotas so the groups add up to the cap.
  for (const group of byPreparation.values()) {
    includedInQuota += group.length;
    const count = Math.round(includedInQuota * target / ranked.length) - selected.length;
    selected.push(...group.slice(0, count).map(({ restaurant }) => restaurant));
  }
  return selected.sort((a, b) => compareStrings(a.businessId, b.businessId));
}

type FeatureKind = "topics" | "findings";

function indexFeatures(profiles: InspectionProfile[], kind: FeatureKind) {
  const index = new Map<string, Array<{ node: number; feature: InspectionFeature; weight: number }>>();
  profiles.forEach((profile, node) => {
    for (const feature of profile[kind]) {
      const bucket = index.get(feature.id) ?? [];
      const weight = (feature.dates + feature.criticalDates * 0.5) / profile.dateCount;
      bucket.push({ node, feature, weight });
      index.set(feature.id, bucket);
    }
  });
  const totals = new Float64Array(profiles.length);
  for (const bucket of index.values()) {
    const prevalenceWeight = kind === "findings" ? 1 + Math.log((profiles.length + 1) / (bucket.length + 1)) : 1;
    for (const entry of bucket) {
      entry.weight *= prevalenceWeight;
      totals[entry.node] += entry.weight;
    }
  }
  return { index, totals };
}

export function buildSimilarityGraph(
  restaurants: Restaurant[],
  { threshold = DEFAULT_SIMILARITY_THRESHOLD, neighborLimit = DEFAULT_NEIGHBOR_LIMIT,
    referenceDate = latestDataDate(restaurants), onProgress }:
    { threshold?: number; neighborLimit?: number; referenceDate?: string; onProgress?: (pairs: number) => void } = {},
): { nodes: GraphNode[]; edges: SimilarityEdge[]; stats: SimilarityStats } {
  const profiles = restaurants.map(restaurant => buildInspectionProfile(restaurant, referenceDate));
  const topics = indexFeatures(profiles, "topics");
  const findings = indexFeatures(profiles, "findings");
  const topNeighbors = profiles.map(() => [] as Array<{ neighbor: number; score: number }>);
  let candidatePairsScored = 0;
  let thresholdQualifiedPairs = 0;

  function keepTopNeighbor(node: number, neighbor: number, score: number) {
    const list = topNeighbors[node];
    const insertAt = list.findIndex(candidate => score > candidate.score ||
      (score === candidate.score && neighbor < candidate.neighbor));
    if (insertAt < 0 && list.length >= neighborLimit) return;
    list.splice(insertAt < 0 ? list.length : insertAt, 0, { neighbor, score });
    if (list.length > neighborLimit) list.pop();
  }

  const topicOverlap = new Float64Array(profiles.length);
  const findingOverlap = new Float64Array(profiles.length);
  const recurringTopic = new Uint8Array(profiles.length);

  for (const [source, profile] of profiles.entries()) {
    for (const kind of ["topics", "findings"] as const) {
      const { index } = kind === "topics" ? topics : findings;
      const overlap = kind === "topics" ? topicOverlap : findingOverlap;
      for (const feature of profile[kind]) {
        const bucket = index.get(feature.id)!;
        const weight = bucket.find(entry => entry.node === source)!.weight;
        for (const other of bucket) {
          if (other.node <= source) continue;
          overlap[other.node] += Math.min(weight, other.weight);
          if (kind === "topics" && feature.dates > 1 && other.feature.dates > 1) recurringTopic[other.node] = 1;
        }
      }
    }
    for (let target = source + 1; target < profiles.length; target++) {
      const sharedTopics = topicOverlap[target];
      const sharedFindings = findingOverlap[target];
      const qualifies = recurringTopic[target] || sharedFindings > 0;
      topicOverlap[target] = findingOverlap[target] = recurringTopic[target] = 0;
      if (!qualifies) continue;
      candidatePairsScored++;
      if (candidatePairsScored % 100_000 === 0) onProgress?.(candidatePairsScored);

      const topicScore = sharedTopics ? sharedTopics / (topics.totals[source] + topics.totals[target] - sharedTopics) : 0;
      const findingScore = sharedFindings ? sharedFindings / (findings.totals[source] + findings.totals[target] - sharedFindings) : 0;
      const score = Math.min(1, 0.65 * topicScore + 0.35 * findingScore);
      if (score < threshold) continue;
      thresholdQualifiedPairs++;
      keepTopNeighbor(source, target, score);
      keepTopNeighbor(target, source, score);
    }
  }

  const edges: SimilarityEdge[] = [];
  const degrees = new Uint8Array(restaurants.length);
  for (const [source, neighbors] of topNeighbors.entries()) {
    for (const { neighbor: target, score } of neighbors) {
      if (source >= target || !topNeighbors[target].some(({ neighbor }) => neighbor === source)) continue;
      edges.push({ source: String(source), target: String(target), score });
      degrees[source]++;
      degrees[target]++;
    }
  }

  const primaryTopics = profiles.map(profile => profile.topics[0]?.id ?? otherTopic.id);
  const positions = assignDeterministicPositions(profiles, primaryTopics, edges);
  const nodes = restaurants.map((restaurant, index) => ({
    ...restaurant, id: String(index), ...positions[index], topic: primaryTopics[index], profile: profiles[index],
  }));

  return {
    nodes,
    edges,
    stats: {
      candidatePairsScored,
      thresholdQualifiedPairs,
      edgeCount: edges.length,
      maximumDegree: degrees.reduce((maximum, degree) => Math.max(maximum, degree), 0),
    },
  };
}
