import { PROFILE_YEARS, sharedInspectionFeatures, type SharedInspectionFeature } from "./inspection-features";
import type { DatedInspection, GraphNode, Violation } from "./inspection-graph";

export type InspectionSelection =
  | { type: "node"; restaurant: GraphNode }
  | { type: "edge"; restaurants: [GraphNode, GraphNode]; score: number }
  | { type: "group"; restaurants: GraphNode[]; remove: (id: string) => void };

const countyPermitGuide = "https://kingcounty.gov/en/dept/dph/certificates-permits-licenses/food-business-permits/permanent-food-business-permit#what-is-a-food-establishment-risk-level";
const countyInspectionGuide = "https://kingcounty.gov/en/dept/dph/health-safety/food-safety/inspection-rating-system/about#about-red-and-blue-violations";
const preparationCategories = {
  "1": { label: "Limited food preparation", example: "Examples include serving packaged food or making espresso drinks." },
  "2": { label: "Basic food preparation", example: "Examples include making sandwiches, baking, or blending fresh fruit." },
  "3": { label: "Complex food preparation", example: "Examples include cooking, cooling and reheating food, or handling raw meat or fish." },
  Unknown: { label: "Food preparation category unavailable", example: "" },
};

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

function guideLink(label: string, url: string): HTMLAnchorElement {
  const link = element("a", label);
  link.href = url;
  return link;
}

function appendViolation(row: HTMLElement, violation: Violation) {
  row.append(violation.description || `Violation code ${violation.violation_code}`);
  if (violation.type) {
    const label = element("span", violation.type === "RED" ? "Red · critical" : "Blue · sanitation or maintenance", "inspection-violation-type");
    label.dataset.type = violation.type;
    row.append(" ", label);
  }
  if (violation.description) row.append(" ", element("code", violation.violation_code));
}

function violationCount(inspection: DatedInspection): number {
  return new Set(inspection.violations.map(({ violation_code }) => violation_code).filter(code => code !== "None")).size;
}

function findingsLabel(count: number): string {
  return count === 0 ? "No violations recorded" : `${count} ${count === 1 ? "violation type" : "violation types"} recorded`;
}

function buildInspectionDay(inspection: DatedInspection, open: boolean): HTMLLIElement {
  const item = element("li");
  const details = element("details");
  details.open = open;
  const countLabel = findingsLabel(violationCount(inspection));
  const summary = element("summary");
  summary.append(formatInspectionDay(inspection.date), element("span", countLabel, "inspection-day-count"));
  details.append(summary);

  const violations = element("ul", undefined, "inspection-violations");
  for (const violation of inspection.violations) {
    const row = element("li");
    if (violation.violation_code === "None") {
      row.textContent = "One visit on this date had no violations recorded.";
    } else {
      appendViolation(row, violation);
    }
    violations.append(row);
  }
  if (!inspection.violations.length) violations.append(element("li", "No violation details recorded."));
  details.append(violations);
  item.append(details);
  return item;
}

function buildRestaurantPanel(restaurant: GraphNode, comparisonLabel?: string): HTMLElement {
  const panel = element("section", undefined, "inspection-card");
  panel.setAttribute("aria-label", comparisonLabel ? `${comparisonLabel}, ${restaurant.name}` : restaurant.name);
  panel.tabIndex = 0;
  if (comparisonLabel) panel.append(element("small", comparisonLabel, "inspection-comparison-label"));
  panel.append(element("h3", restaurant.name));
  const location = [restaurant.address, restaurant.city].filter(Boolean).join(", ");
  if (location) panel.append(element("p", location, "inspection-location"));

  const latest = restaurant.inspections.findLast(({ date }) => date !== "Unknown");
  if (latest) {
    const latestSummary = element("div", undefined, "inspection-latest");
    const latestDate = element("p", "Latest inspection date ", "inspection-latest-date");
    latestDate.append(formatInspectionDay(latest.date));
    latestSummary.append(latestDate, element("strong", findingsLabel(violationCount(latest))));
    panel.append(latestSummary);
  }

  const category = preparationCategories[restaurant.riskCategory];
  const risk = element("span", category.label, "inspection-risk");
  risk.dataset.risk = restaurant.riskCategory;
  const permit = element("p", undefined, "inspection-card-note");
  if (category.example) permit.append(`${category.example} `);
  permit.append("This category describes how the business handles food and helps determine how often it is inspected. ", guideLink("County permit guide", countyPermitGuide));
  panel.append(risk, permit);
  if (restaurant.profile.topics.length) {
    const profile = element("details", undefined, "inspection-profile");
    profile.open = !comparisonLabel;
    profile.append(
      element("summary", "Recent inspection profile"),
      element("p", `Findings across ${restaurant.profile.dateCount} inspection dates in the last ${PROFILE_YEARS} years of the export.`, "inspection-card-note"),
    );
    const list = element("ul", undefined, "inspection-feature-list");
    for (const topic of restaurant.profile.topics) {
      const critical = topic.criticalDates ? ` · ${topic.criticalDates} with red findings` : "";
      const item = element("li");
      item.append(element("strong", topic.label), element("span", `${formatDates(topic.dates)}${critical}`));
      list.append(item);
    }
    profile.append(list);
    panel.append(profile);
  }
  panel.append(element("h4", "Inspection history"));

  const interpretation = element("p", undefined, "inspection-card-note");
  interpretation.append(
    "Red findings involve practices more likely to cause illness. Blue findings usually concern upkeep or sanitation. ",
    guideLink("County inspection guide", countyInspectionGuide),
  );
  panel.append(interpretation);

  const history = element("ol", undefined, "inspection-history");
  for (let index = restaurant.inspections.length - 1; index >= 0; index--) {
    history.append(buildInspectionDay(restaurant.inspections[index], index === restaurant.inspections.length - 1));
  }
  panel.append(history);
  return panel;
}

function formatDates(dates: number): string {
  return `${dates.toLocaleString()} ${dates === 1 ? "date" : "dates"}`;
}

function buildSharedTable(features: SharedInspectionFeature[]): HTMLElement {
  const table = element("table");
  table.setAttribute("aria-label", "Number of inspection dates each business had each shared finding");
  const head = element("tr");
  for (const title of ["Shared finding", "Business A dates", "Business B dates"]) {
    const heading = element("th", title);
    heading.scope = "col";
    head.append(heading);
  }
  table.createTHead().append(head);
  const body = table.createTBody();
  for (const feature of features) {
    const row = body.insertRow();
    row.insertCell().append(feature.label, " ", element("code", feature.id));
    for (const dates of feature.dates) row.insertCell().textContent = dates.toLocaleString();
  }
  const tableScroll = element("div", undefined, "inspection-shared-table");
  tableScroll.tabIndex = 0;
  tableScroll.setAttribute("role", "region");
  tableScroll.setAttribute("aria-label", "Shared findings by business");
  tableScroll.append(table);
  return tableScroll;
}

function buildScoreOverview(selection: Extract<InspectionSelection, { type: "edge" }>): HTMLElement[] {
  const profiles = selection.restaurants.map(({ profile }) => profile);
  const topics = sharedInspectionFeatures(profiles, "topics");
  const findings = sharedInspectionFeatures(profiles, "findings");
  const score = element("div", undefined, "inspection-score-value");
  score.append(element("strong", percentFormatter.format(selection.score)), element("span", "similarity score"));

  const rationale = element(
    "p",
    `Compares how often topics and specific findings appeared per inspection date in the last ${PROFILE_YEARS} years of the export. Topics, red findings, and rarer codes carry more weight.`,
    "inspection-score-metrics",
  );
  const sharedTopics = element("p", topics.length ? `Shared topics include ${topics.map(({ label }) => label).join(", ")}.` : "No shared inspection topics.", "inspection-score-metrics");
  if (!findings.length) return [score, rationale, sharedTopics, element("p", "No shared specific findings.", "inspection-score-metrics")];

  const evidence = element("details", undefined, "inspection-shared-findings");
  evidence.open = true;
  evidence.append(
    element("summary", `${findings.length} shared ${findings.length === 1 ? "finding" : "findings"}`),
    buildSharedTable(findings),
  );
  return [score, rationale, sharedTopics, evidence];
}

function buildGroupPanel({ restaurants, remove }: Extract<InspectionSelection, { type: "group" }>): HTMLElement {
  const panel = element("section", undefined, "inspection-card");
  panel.setAttribute("aria-label", "Shared inspection profile");
  panel.tabIndex = 0;
  panel.append(
    element("h3", `${restaurants.length} businesses selected`),
    element("p", `These findings appeared at every selected business in the last ${PROFILE_YEARS} years of the export.`, "inspection-card-note"),
  );

  const profiles = restaurants.map(({ profile }) => profile);
  for (const [kind, label] of [["topics", "Shared topics"], ["findings", "Shared specific findings"]] as const) {
    panel.append(element("h4", label));
    const features = sharedInspectionFeatures(profiles, kind);
    if (!features.length) {
      panel.append(element("p", kind === "topics" ? "No topic was recorded at every selected business." : "No specific finding was recorded at every selected business.", "inspection-card-note"));
      continue;
    }
    const list = element("ul", undefined, "inspection-feature-list");
    for (const feature of features) {
      const min = Math.min(...feature.dates);
      const max = Math.max(...feature.dates);
      const range = min === max ? formatDates(min) : `${min.toLocaleString()}–${max.toLocaleString()} dates`;
      const item = element("li");
      item.append(element("strong", feature.label));
      if (kind === "findings") item.append(element("code", feature.id));
      item.append(element("span", `${range} per business${min > 1 ? " · Recurring at all" : ""}`));
      list.append(item);
    }
    panel.append(list);
  }

  const [first] = restaurants;
  const context = [];
  if (first.city && restaurants.every(({ city }) => city.toUpperCase() === first.city.toUpperCase())) context.push(first.city);
  if (first.riskCategory !== "Unknown" && restaurants.every(({ riskCategory }) => riskCategory === first.riskCategory)) {
    context.push(preparationCategories[first.riskCategory].label);
  }
  if (context.length) {
    panel.append(element("h4", "Shared business details"), element("p", context.join(" · "), "inspection-card-note"));
  }

  panel.append(element("h4", "Selected businesses"));
  const list = element("ul", undefined, "inspection-selected-businesses");
  for (const restaurant of restaurants) {
    const item = element("li");
    const location = [restaurant.address, restaurant.city].filter(Boolean).join(", ");
    const description = element("div");
    description.append(element("strong", restaurant.name));
    if (location) description.append(element("span", location));
    description.append(element("span", `${formatDates(restaurant.profile.dateCount)} in this comparison`));
    const button = element("button", "Remove");
    button.type = "button";
    button.setAttribute("aria-label", `Remove ${restaurant.name}${location ? ` at ${location}` : ""}`);
    button.addEventListener("click", () => {
      remove(restaurant.id);
      document.getElementById("inspection-details-close")?.focus();
    });
    item.append(description, button);
    list.append(item);
  }
  panel.append(list);
  return panel;
}

export function renderInspectionDetails(selection: InspectionSelection | null): void {
  const sidebar = document.getElementById("inspection-details");
  const title = document.getElementById("inspection-details-title");
  const overview = document.getElementById("inspection-details-score");
  const panels = document.getElementById("inspection-details-panels");
  if (!sidebar || !title || !overview || !panels) return;

  sidebar.hidden = !selection;
  overview.hidden = selection?.type !== "edge";
  if (!selection) {
    delete sidebar.dataset.selection;
    overview.replaceChildren();
    panels.replaceChildren();
    return;
  }

  sidebar.dataset.selection = selection.type;
  if (selection.type === "node") {
    title.textContent = "Business details";
    overview.replaceChildren();
    panels.replaceChildren(buildRestaurantPanel(selection.restaurant));
  } else if (selection.type === "group") {
    title.textContent = "What these businesses share";
    overview.replaceChildren();
    panels.replaceChildren(buildGroupPanel(selection));
  } else {
    title.textContent = "Business comparison";
    overview.replaceChildren(...buildScoreOverview(selection));
    const [source, target] = selection.restaurants;
    panels.replaceChildren(buildRestaurantPanel(source, "Business A"), buildRestaurantPanel(target, "Business B"));
  }
  panels.scrollTop = 0;
}
