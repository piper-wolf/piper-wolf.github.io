import type { DatedInspection, Restaurant } from "./inspection-graph";

export type InspectionSelection =
  | { type: "node"; restaurant: Restaurant }
  | { type: "edge"; source: Restaurant; target: Restaurant; score: number };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeZone: "UTC",
});
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  content?: string,
  className?: string,
): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function formatInspectionDay(date: string): HTMLElement {
  if (date === "Unknown") return element("span", "Unknown date");
  const time = element("time", dateFormatter.format(new Date(date)));
  time.dateTime = date;
  return time;
}

function buildInspectionDay(inspection: DatedInspection, open: boolean): HTMLLIElement {
  const item = element("li");
  const details = element("details");
  details.open = open;
  const codedCount = inspection.violations.filter(({ violation_code }) => violation_code !== "None").length;
  const countLabel = `${codedCount} coded ${codedCount === 1 ? "violation" : "violations"}`;
  const summary = element("summary");
  summary.append(formatInspectionDay(inspection.date), element("span", countLabel, "inspection-day-count"));
  details.append(summary);

  const violations = element("ul", undefined, "inspection-violations");
  for (const { violation_code: code, description } of inspection.violations) {
    const row = element("li");
    if (code === "None") {
      row.textContent = "An inspection on this date had no coded violations.";
    } else {
      row.append(element("code", code), description);
    }
    violations.append(row);
  }
  if (!inspection.violations.length) violations.append(element("li", "No violation details recorded."));
  details.append(violations);
  item.append(details);
  return item;
}

function buildRestaurantPanel(restaurant: Restaurant): HTMLElement {
  const panel = element("section", undefined, "inspection-card");
  panel.setAttribute("aria-label", restaurant.name);
  panel.tabIndex = 0;
  const risk = element(
    "span",
    restaurant.riskCategory === "Unknown" ? "Risk category unknown" : `Risk category ${restaurant.riskCategory}`,
    "inspection-risk",
  );
  risk.dataset.risk = restaurant.riskCategory;
  const facts = element("dl", undefined, "inspection-card-facts");
  const values: Array<[string, number]> = [
    ["Inspection dates", restaurant.inspections.filter(({ date }) => date !== "Unknown").length],
    ["Unique violation codes", restaurant.realViolationCodes.length],
    ["Business IDs", restaurant.businessIdCount],
  ];
  for (const [label, value] of values) {
    const fact = element("div");
    fact.append(element("dt", label), element("dd", value.toLocaleString()));
    facts.append(fact);
  }
  panel.append(element("h3", restaurant.name), risk, facts, element("h4", "Inspection history"));

  const history = element("ol", undefined, "inspection-history");
  for (let index = restaurant.inspections.length - 1; index >= 0; index--) {
    history.append(buildInspectionDay(restaurant.inspections[index], index === restaurant.inspections.length - 1));
  }
  panel.append(history);
  return panel;
}

function buildScoreOverview(selection: Extract<InspectionSelection, { type: "edge" }>): HTMLElement[] {
  const targetCodes = new Set(selection.target.realViolationCodes);
  const sharedCount = selection.source.realViolationCodes.filter((code) => targetCodes.has(code)).length;
  const totalCount = new Set([...selection.source.realViolationCodes, ...targetCodes]).size;
  const score = element("div", undefined, "inspection-score-value");
  score.append(element("strong", percentFormatter.format(selection.score)), element("span", "similarity score"));

  const metrics = element("p", undefined, "inspection-score-metrics");
  if (sharedCount > 0) {
    const overlap = sharedCount / totalCount;
    const riskWeight = percentFormatter.format(selection.score / overlap);
    metrics.textContent = `${sharedCount} of ${totalCount} violation codes shared · ${riskWeight} risk weight`;
  } else {
    metrics.textContent = "No shared violation codes";
  }
  return [score, metrics];
}

export function renderInspectionDetails(selection: InspectionSelection | null): void {
  const sidebar = document.getElementById("inspection-details");
  const title = document.getElementById("inspection-details-title");
  const overview = document.getElementById("inspection-details-score");
  const panels = document.getElementById("inspection-details-panels");
  if (!sidebar || !title || !overview || !panels) return;

  sidebar.hidden = !selection;
  if (!selection) {
    delete sidebar.dataset.selection;
    overview.replaceChildren();
    panels.replaceChildren();
    return;
  }

  sidebar.dataset.selection = selection.type;
  overview.hidden = selection.type === "node";
  if (selection.type === "node") {
    title.textContent = "Restaurant details";
    overview.replaceChildren();
    panels.replaceChildren(buildRestaurantPanel(selection.restaurant));
  } else {
    title.textContent = "Restaurant comparison";
    overview.replaceChildren(...buildScoreOverview(selection));
    panels.replaceChildren(buildRestaurantPanel(selection.source), buildRestaurantPanel(selection.target));
  }
  panels.scrollTop = 0;
}
