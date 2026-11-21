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
}

export interface SharedViolation extends Violation {
  sourceDates: number;
  targetDates: number;
}

export interface SimilarityEdge {
  source: string;
  target: string;
  score: number;
  sharedViolations: SharedViolation[];
}

export interface SimilarityStats {
  candidatePairsScored: number;
  thresholdQualifiedPairs: number;
  edgeCount: number;
  maximumDegree: number;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.35;
export const STRONG_SIMILARITY_THRESHOLD = 0.55;
const DEFAULT_NEIGHBOR_LIMIT = 5;

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

function assignDeterministicPositions(primaryCodes: string[]): Array<{ x: number; y: number }> {
  const groups = new Map<string, number[]>();
  primaryCodes.forEach((primaryCode, index) => {
    const group = groups.get(primaryCode) ?? [];
    group.push(index);
    groups.set(primaryCode, group);
  });

  const groupKeys = [...groups.keys()].sort(compareStrings);
  const columns = Math.ceil(Math.sqrt(groupKeys.length));
  const rows = Math.ceil(groupKeys.length / columns);
  const cellSpacing = 110;
  const positions = new Array<{ x: number; y: number }>(primaryCodes.length);

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

function latestInspectionDate(restaurant: Restaurant): string {
  return restaurant.inspections.findLast(({ date }) => date !== "Unknown")?.date ?? "";
}

export function latestDataDate(restaurants: Restaurant[]): string {
  return restaurants.reduce((latest, restaurant) => {
    const date = latestInspectionDate(restaurant);
    return date > latest ? date : latest;
  }, "");
}

function yearsBefore(date: string, years: number): string {
  if (!date) return "";
  const cutoff = new Date(date);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff.toISOString().slice(0, 10);
}

export function selectRelevantRestaurants(restaurants: Restaurant[], limit = 1800): Restaurant[] {
  const snapshot = latestDataDate(restaurants);
  if (!snapshot) return [];
  const activeCutoff = yearsBefore(snapshot, 1);
  const evidenceCutoff = yearsBefore(snapshot, 3);

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

interface ProfileIssue {
  violation: Violation;
  dates: number;
  weight: number;
}

type Profile = Map<string, ProfileIssue>;

function isScoredViolation({ violation_code: code }: Violation): boolean {
  return code !== "None" && code !== "5000" && code !== "5100";
}

function comparisonFinding(violation: Violation): Violation {
  // The county export splits these two handling problems into temperature bands.
  const code = violation.violation_code;
  if (code === "1710" || code === "1720") {
    return { ...violation, violation_code: "1710 / 1720", description: "Food held hot below the required temperature" };
  }
  if (code === "2110" || code === "2120") {
    return { ...violation, violation_code: "2110 / 2120", description: "Food held cold above the required temperature" };
  }
  return violation;
}

function recentProfiles(restaurants: Restaurant[], referenceDate: string): Profile[] {
  const cutoff = yearsBefore(referenceDate, 3);
  return restaurants.map(({ inspections }) => {
    const profile: Profile = new Map();
    for (const { date, violations } of inspections) {
      if (date === "Unknown" || date < cutoff) continue;
      const codesOnDate = new Set<string>();
      for (const raw of violations) {
        if (!isScoredViolation(raw)) continue;
        const violation = comparisonFinding(raw);
        const code = violation.violation_code;
        if (codesOnDate.has(code)) continue;
        codesOnDate.add(code);
        const previous = profile.get(code);
        profile.set(code, { violation, dates: (previous?.dates ?? 0) + 1, weight: 0 });
      }
    }
    return profile;
  });
}

export function buildSimilarityGraph(
  restaurants: Restaurant[],
  { threshold = DEFAULT_SIMILARITY_THRESHOLD, neighborLimit = DEFAULT_NEIGHBOR_LIMIT,
    referenceDate = latestDataDate(restaurants), onProgress }:
    { threshold?: number; neighborLimit?: number; referenceDate?: string; onProgress?: (pairs: number) => void } = {},
): { nodes: GraphNode[]; edges: SimilarityEdge[]; stats: SimilarityStats } {
  const profiles = recentProfiles(restaurants, referenceDate);
  const buckets = new Map<string, number[]>();
  profiles.forEach((profile, index) => {
    for (const code of profile.keys()) {
      const bucket = buckets.get(code) ?? [];
      bucket.push(index);
      buckets.set(code, bucket);
    }
  });
  const totals = profiles.map((profile) => {
    let total = 0;
    for (const [code, issue] of profile) {
      const prevalenceWeight = 1 + Math.log((restaurants.length + 1) / (buckets.get(code)!.length + 1));
      issue.weight = prevalenceWeight * (1 + Math.log(issue.dates)) * (issue.violation.type === "RED" ? 1.5 : 1);
      total += issue.weight;
    }
    return total;
  });
  const topNeighbors = profiles.map(() => [] as Array<{ neighbor: number; score: number }>);
  let candidatePairsScored = 0;
  let thresholdQualifiedPairs = 0;

  function keepTopNeighbor(node: number, neighbor: number, score: number) {
    const list = topNeighbors[node];
    const insertAt = list.findIndex((candidate) => score > candidate.score ||
      (score === candidate.score && neighbor < candidate.neighbor));
    list.splice(insertAt < 0 ? list.length : insertAt, 0, { neighbor, score });
    if (list.length > neighborLimit) list.pop();
  }

  // Accumulate the weighted intersection along the code's index, one source at a time.
  const overlap = new Float64Array(profiles.length);
  const sharedCounts = new Uint16Array(profiles.length);
  const repeatedCritical = new Uint8Array(profiles.length);
  for (const [source, profile] of profiles.entries()) {
    const candidates: number[] = [];
    for (const [code, issue] of profile) {
      for (const target of buckets.get(code)!) {
        if (target <= source) continue;
        const other = profiles[target].get(code)!;
        if (!sharedCounts[target]++) candidates.push(target);
        overlap[target] += Math.min(issue.weight, other.weight);
        if (issue.violation.type === "RED" && other.violation.type === "RED" && issue.dates > 1 && other.dates > 1) {
          repeatedCritical[target] = 1;
        }
      }
    }
    for (const target of candidates) {
      const count = sharedCounts[target];
      const qualifies = count > 1 || repeatedCritical[target];
      const sharedWeight = overlap[target];
      sharedCounts[target] = overlap[target] = repeatedCritical[target] = 0;
      if (!qualifies) continue;
      candidatePairsScored++;
      if (candidatePairsScored % 100_000 === 0) onProgress?.(candidatePairsScored);

      const unionWeight = totals[source] + totals[target] - sharedWeight;
      const score = Math.min(1, sharedWeight / unionWeight) * (count === 1 ? 0.75 : 1);
      if (score < threshold) continue;
      thresholdQualifiedPairs++;
      keepTopNeighbor(source, target, score);
      keepTopNeighbor(target, source, score);
    }
  }

  const edges: SimilarityEdge[] = [];
  const degrees = new Uint8Array(restaurants.length);
  const strongestLinks = profiles.map(() => ({ score: 0, code: "" }));
  for (const [source, neighbors] of topNeighbors.entries()) {
    for (const { neighbor: target, score } of neighbors) {
      if (source >= target || !topNeighbors[target].some(({ neighbor }) => neighbor === source)) continue;
      const sharedViolations = [...profiles[source].values()]
        .filter(({ violation }) => profiles[target].has(violation.violation_code))
        .map(({ violation, dates, weight }) => {
          const other = profiles[target].get(violation.violation_code)!;
          return { evidence: { ...violation, sourceDates: dates, targetDates: other.dates }, weight: Math.min(weight, other.weight) };
        })
        .sort((a, b) => b.weight - a.weight || compareStrings(a.evidence.violation_code, b.evidence.violation_code))
        .map(({ evidence }) => evidence);
      edges.push({ source: String(source), target: String(target), score, sharedViolations });
      for (const node of [source, target]) {
        degrees[node]++;
        if (score > strongestLinks[node].score) strongestLinks[node] = { score, code: sharedViolations[0].violation_code };
      }
    }
  }

  const positions = assignDeterministicPositions(profiles.map((profile, index) =>
    strongestLinks[index].code ||
    [...profile.values()].sort((a, b) => b.weight - a.weight)[0]?.violation.violation_code || "None"));
  const nodes = restaurants.map((restaurant, index) => ({ ...restaurant, id: String(index), ...positions[index] }));

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
