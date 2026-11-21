import type { DatedInspection, Restaurant, SharedViolation, Violation } from "./inspection-graph";

export type InspectionSelection =
  | { type: "node"; restaurant: Restaurant }
  | { type: "edge"; source: Restaurant; target: Restaurant; score: number; sharedViolations: SharedViolation[] };

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

function buildRestaurantPanel(restaurant: Restaurant, comparisonLabel?: string): HTMLElement {
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
  panel.append(risk, permit, element("h4", "Inspection history"));

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

function buildScoreOverview(selection: Extract<InspectionSelection, { type: "edge" }>): HTMLElement[] {
  const score = element("div", undefined, "inspection-score-value");
  score.append(element("strong", percentFormatter.format(selection.score)), element("span", "similarity score"));

  const rationale = element(
    "p",
    "Compares the last three years in the export. Rarer, repeated, and red findings carry more weight. Different temperature bands count as one finding, and posting violations stay in the history. King County issues separate food safety ratings.",
    "inspection-score-metrics",
  );
  const evidence = element("details", undefined, "inspection-shared-findings");
  evidence.open = true;
  evidence.append(element("summary", `${selection.sharedViolations.length} shared ${selection.sharedViolations.length === 1 ? "finding" : "findings"}`));

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
  for (const violation of selection.sharedViolations) {
    const row = body.insertRow();
    appendViolation(row.insertCell(), violation);
    row.insertCell().textContent = violation.sourceDates.toLocaleString();
    row.insertCell().textContent = violation.targetDates.toLocaleString();
  }
  const tableScroll = element("div", undefined, "inspection-shared-table");
  tableScroll.tabIndex = 0;
  tableScroll.setAttribute("role", "region");
  tableScroll.setAttribute("aria-label", "Shared findings by business");
  tableScroll.append(table);
  evidence.append(tableScroll);
  return [score, rationale, evidence];
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
    panels.replaceChildren(buildRestaurantPanel(selection.source, "Business A"), buildRestaurantPanel(selection.target, "Business B"));
  }
  panels.scrollTop = 0;
}
