import { inspectionTopics, otherTopic } from "./inspection-features";
import type { GraphNode, SimilarityEdge } from "./inspection-graph";

export const preparationCategories = {
  "1": { label: "Limited food preparation", example: "Examples include serving packaged food or making espresso drinks." },
  "2": { label: "Basic food preparation", example: "Examples include making sandwiches, baking, or blending fresh fruit." },
  "3": { label: "Complex food preparation", example: "Examples include cooking, cooling and reheating food, or handling raw meat or fish." },
  Unknown: { label: "Food preparation category unavailable", example: "" },
};

export const findingPatterns = [
  { value: "repeated", label: "Repeated on two or more dates" },
  { value: "critical", label: "Red finding" },
  { value: "repeated-critical", label: "Red finding on two or more dates" },
] as const;

export interface InspectionFilters {
  query: string;
  city: string;
  preparation: string;
  topic: string;
  pattern: string;
}

export type InspectionGrouping = "" | "topic" | "preparation";
export type GraphPosition = { x: number; y: number };

export function filterBusinesses(businesses: GraphNode[], filters: InspectionFilters): GraphNode[] {
  const query = filters.query.toLowerCase().trim();
  return businesses.filter(business => {
    if (query && ![business.name, business.address].some(value => value.toLowerCase().includes(query))) return false;
    if (filters.city && business.city.toUpperCase() !== filters.city) return false;
    if (filters.preparation && business.riskCategory !== filters.preparation) return false;
    const topic = business.profile.topics.find(({ id }) => id === filters.topic);
    if (filters.topic && !topic) return false;
    if (!filters.pattern) return true;
    const features = topic ? [topic] : business.profile.findings;
    return features.some(({ dates, criticalDates }) => {
      if (filters.pattern === "repeated") return dates >= 2;
      if (filters.pattern === "repeated-critical") return criticalDates >= 2;
      return criticalDates > 0;
    });
  });
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function spiralPosition(index: number, scale = 1): GraphPosition {
  const angle = index * GOLDEN_ANGLE;
  const distance = Math.sqrt(index + 0.5) * scale;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

export function groupBusinesses(businesses: GraphNode[], edges: SimilarityEdge[], grouping: Exclude<InspectionGrouping, "">) {
  const byTopic = grouping === "topic";
  const groupBy = (business: GraphNode) => byTopic ? business.topic : business.riskCategory;
  const categories = byTopic
    ? [...inspectionTopics, otherTopic]
    : Object.entries(preparationCategories).map(([id, { label }]) => ({ id, label }));
  const members = Map.groupBy(businesses, groupBy);
  const groups = categories.filter(({ id }) => members.has(id));
  const groupById = new Map(businesses.map(business => [business.id, groupBy(business)]));
  const neighbors = new Map(businesses.map(({ id }) => [id, [] as string[]]));
  for (const { source, target } of edges) {
    if (groupById.get(source) !== groupById.get(target)) continue;
    neighbors.get(source)!.push(target);
    neighbors.get(target)!.push(source);
  }

  const columns = Math.ceil(Math.sqrt(groups.length));
  const spacing = Math.sqrt(Math.max(0, ...groups.map(({ id }) => members.get(id)!.length))) * 2.55;
  const positions = new Map<string, GraphPosition>();
  const visited = new Set<string>();

  const headings = groups.map((category, groupIndex) => {
    const row = Math.floor(groupIndex / columns);
    const rowLength = Math.min(columns, groups.length - row * columns);
    const centerX = (groupIndex % columns - (rowLength - 1) / 2) * spacing;
    const centerY = -row * spacing;
    const ordered: string[] = [];
    const roots = members.get(category.id)!.map(({ id }) => id);
    roots.sort((a, b) => neighbors.get(b)!.length - neighbors.get(a)!.length);

    for (const root of roots) {
      if (visited.has(root)) continue;
      visited.add(root);
      const start = ordered.length;
      ordered.push(root);
      for (let i = start; i < ordered.length; i++) {
        for (const neighbor of neighbors.get(ordered[i])!) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          ordered.push(neighbor);
        }
      }
    }

    let top = Number.NEGATIVE_INFINITY;
    ordered.forEach((id, rank) => {
      const position = spiralPosition(rank);
      const y = centerY + position.y;
      positions.set(id, { x: centerX + position.x, y });
      top = Math.max(top, y);
    });
    return { ...category, x: centerX, y: top };
  });
  return { positions, headings, groupById };
}
