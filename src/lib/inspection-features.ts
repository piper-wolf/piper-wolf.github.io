import type { Restaurant, Violation } from "./inspection-graph";

export const PROFILE_YEARS = 3;

export const inspectionTopics = [
  { id: "management", label: "Management & training", color: "#b996d1", outline: "#64447c", codes: "0100 0200 2300 2600 2700" },
  { id: "hygiene", label: "Handwashing & hygiene", color: "#71c5c0", outline: "#246f70", codes: "0300 0400 0500 0600 3500 3600" },
  { id: "hot", label: "Cooking & hot holding", color: "#ec9988", outline: "#913c34", codes: "1500 1710 1720 1800 1900 2000" },
  { id: "cold", label: "Cooling & cold holding", color: "#8cb6ea", outline: "#3c6096", codes: "1600 2110 2120 2200 2800 2900 3000" },
  { id: "food", label: "Food sourcing & labeling", color: "#a9c976", outline: "#547128", codes: "0700 0800 0900 1000 1100 1200 2400 3100" },
  { id: "storage", label: "Storage & contamination", color: "#eab967", outline: "#895820", codes: "1300 1400 2500 3300 3700 3800 3900" },
  { id: "sanitation", label: "Cleaning & sanitizing", color: "#e3a5c2", outline: "#934e76", codes: "3400 4000 4100 4200 4300" },
  { id: "facilities", label: "Facilities & pests", color: "#aab5bf", outline: "#515f6c", codes: "3200 4400 4500 4600 4700 4800 4900" },
] as const;

export const otherTopic = { id: "other", label: "Other findings", color: "#ddd6c7", outline: "#655b4c" } as const;
const topicByCode = new Map(inspectionTopics.flatMap(topic => topic.codes.split(" ").map(code => [code, topic] as const)));
const combinedFindings = new Map([
  ["1710", { id: "1710 / 1720", label: "Food held hot below the required temperature" }],
  ["1720", { id: "1710 / 1720", label: "Food held hot below the required temperature" }],
  ["2110", { id: "2110 / 2120", label: "Food held cold above the required temperature" }],
  ["2120", { id: "2110 / 2120", label: "Food held cold above the required temperature" }],
]);

export interface InspectionFeature {
  id: string;
  label: string;
  dates: number;
  criticalDates: number;
}

export interface InspectionProfile {
  dateCount: number;
  topics: InspectionFeature[];
  findings: InspectionFeature[];
}

export interface SharedInspectionFeature {
  id: string;
  label: string;
  dates: number[];
}

export function isScoredViolation({ violation_code: code }: Violation): boolean {
  return code !== "None" && code !== "5000" && code !== "5100";
}

export function yearsBefore(date: string, years: number): string {
  if (!date) return "";
  const cutoff = new Date(date);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff.toISOString().slice(0, 10);
}

function countFeatures(days: Map<string, { id: string; label: string; critical: boolean }>, totals: Map<string, InspectionFeature>) {
  for (const { id, label, critical } of days.values()) {
    const total = totals.get(id) ?? { id, label, dates: 0, criticalDates: 0 };
    total.dates++;
    total.criticalDates += Number(critical);
    totals.set(id, total);
  }
}

export function buildInspectionProfile(restaurant: Restaurant, referenceDate: string): InspectionProfile {
  const cutoff = yearsBefore(referenceDate, PROFILE_YEARS);
  const topics = new Map<string, InspectionFeature>();
  const findings = new Map<string, InspectionFeature>();
  let dateCount = 0;

  for (const { date, violations } of restaurant.inspections) {
    if (date === "Unknown" || date < cutoff || date > referenceDate) continue;
    dateCount++;
    const topicsOnDate = new Map<string, { id: string; label: string; critical: boolean }>();
    const findingsOnDate = new Map<string, { id: string; label: string; critical: boolean }>();
    for (const violation of violations) {
      if (!isScoredViolation(violation)) continue;
      const code = violation.violation_code;
      const finding = combinedFindings.get(code) ?? { id: code, label: violation.description || `Violation code ${code}` };
      const topic = topicByCode.get(code);
      const critical = violation.type === "RED";
      findingsOnDate.set(finding.id, { ...finding, critical: critical || !!findingsOnDate.get(finding.id)?.critical });
      if (topic) topicsOnDate.set(topic.id, { ...topic, critical: critical || !!topicsOnDate.get(topic.id)?.critical });
    }
    countFeatures(topicsOnDate, topics);
    countFeatures(findingsOnDate, findings);
  }

  const rank = (a: InspectionFeature, b: InspectionFeature) =>
    b.dates - a.dates || b.criticalDates - a.criticalDates || a.label.localeCompare(b.label);
  return { dateCount, topics: [...topics.values()].sort(rank), findings: [...findings.values()].sort(rank) };
}

export function sharedInspectionFeatures(
  profiles: InspectionProfile[],
  kind: "topics" | "findings",
): SharedInspectionFeature[] {
  if (!profiles.length) return [];
  const byId = profiles.map(profile => new Map(profile[kind].map(feature => [feature.id, feature])));
  return profiles[0][kind]
    .filter(({ id }) => byId.every(features => features.has(id)))
    .map(({ id, label }) => ({ id, label, dates: byId.map(features => features.get(id)!.dates) }))
    .sort((a, b) => Math.min(...b.dates) - Math.min(...a.dates) || a.label.localeCompare(b.label));
}
