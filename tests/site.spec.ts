import { expect, test, blockExternalRequests } from "./helpers/browser";
import sharp from "sharp";
import { inspectionTopics } from "../src/lib/inspection-features";

const pages = ["/", "/pigeons", "/pigeons/016", "/pigeons/001"];

test("playground lazily loads the inspection data and renders an interactive restaurant graph", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const csvRequests: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/playground/synology/inspection-data.csv.gz")) csvRequests.push(request.url());
  });
  page.on("response", response => {
    if (response.url().endsWith("/playground/synology/inspection-data.csv.gz")) {
      expect([200, 206]).toContain(response.status());
    }
  });
  await page.addInitScript(() => {
    const testWindow = window as Window & { pendingGraphIdle?: IdleRequestCallback };
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        testWindow.pendingGraphIdle = callback;
        return 1;
      },
    });
  });
  await page.goto("/playground/synology", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-pigeon-landing], .pigeon-visitor, script[src*=goatcounter]")).toHaveCount(0);
  await expect(page.locator("body > header, body > footer, h1")).toHaveCount(0);
  const legend = page.getByRole("complementary", { name: "Graph key" });
  await expect(legend).toBeHidden();
  const preloadedGraphModules = await page.locator('link[rel="modulepreload"]').evaluateAll(links =>
    links.map(link => link.getAttribute("href")).filter(href => href && /sigma|graphology/i.test(href)),
  );
  expect(preloadedGraphModules).toEqual([]);
  expect(csvRequests).toEqual([]);
  const graphResources = () => page.evaluate(() =>
    performance.getEntriesByType("resource").map(({ name }) => name).filter((name) => /sigma|graphology|inspection-data\.csv/i.test(name)),
  );
  expect(await graphResources()).toEqual([]);

  const graph = page.locator("#synology-graph");
  const bounds = await graph.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height, busy: element.getAttribute("aria-busy") };
  });
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });

  const csvResponse = page.waitForResponse(response => response.url().endsWith("/playground/synology/inspection-data.csv.gz"));
  await page.evaluate(() => {
    const testWindow = window as Window & { pendingGraphIdle?: IdleRequestCallback };
    testWindow.pendingGraphIdle?.({ didTimeout: false, timeRemaining: () => 50 });
  });
  expect([200, 206]).toContain((await csvResponse).status());
  const canvas = page.locator("#synology-graph canvas");
  await expect(canvas).toBeVisible();
  await expect(graph).toHaveAttribute("aria-busy", "false", { timeout: 120_000 });
  const nodeCount = Number(await graph.getAttribute("data-node-count"));
  const edgeCount = Number(await graph.getAttribute("data-edge-count"));
  expect(nodeCount).toBe(1_800);
  expect(edgeCount).toBeGreaterThan(0);
  await expect(graph).toHaveAttribute("data-first-render-ms", /\d+/);
  await expect(page.locator("#synology-graph-status")).toBeHidden();
  expect(csvRequests.length).toBeGreaterThan(0);
  const groupLabels = page.locator("#inspection-groups span");
  await expect(groupLabels).toHaveCount(0);

  const screenshot = await canvas.screenshot();
  const { data, info } = await sharp(screenshot).resize(64, 32).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  for (let offset = 0; offset < data.length; offset += info.channels) {
    colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
  }
  expect(colors.size).toBeGreaterThan(10);

  const { data: pixels, info: image } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  const mouseLayer = graph.locator(".sigma-mouse");
  const palette = (names: string[]) => graph.evaluate((element, names) => {
    const theme = getComputedStyle(element);
    return names.map(name => {
      const hex = theme.getPropertyValue(`--graph-${name}`).trim();
      const base = theme.getPropertyValue("--graph-background").trim();
      const opacity = name === "edge-strong" ? 0.73 : 0.55;
      return [1, 3, 5].map(offset =>
        Math.round(Number.parseInt(hex.slice(offset, offset + 2), 16) * opacity +
          Number.parseInt(base.slice(offset, offset + 2), 16) * (1 - opacity)),
      );
    });
  }, names);
  const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const nodeColors = inspectionTopics.map(({ color }) => rgb(color));
  const outlineColors = inspectionTopics.map(({ outline }) => rgb(outline));
  const pixelMatches = ([red, green, blue]: Uint8Array, colors: number[][]) =>
    colors.some(([r, g, b]) => Math.abs(red - r) + Math.abs(green - g) + Math.abs(blue - b) < 20);
  expect(pixels.some((_, offset) => offset % image.channels === 0 && pixelMatches(pixels.subarray(offset, offset + 3), outlineColors))).toBe(true);

  async function findGraphPoint(
    palette: number[][], cursor: string, excluded: Array<{ x: number; y: number }> = [],
  ) {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < image.height; y += 2) {
      for (let x = 0; x < image.width; x += 2) {
        const offset = (y * image.width + x) * image.channels;
        if (!pixelMatches(pixels.subarray(offset, offset + 3), palette)) continue;
        const point = {
          x: canvasBounds!.x + x * canvasBounds!.width / image.width,
          y: canvasBounds!.y + y * canvasBounds!.height / image.height,
        };
        if (point.x < 310 || point.x > 1_025) continue;
        if (excluded.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 24)) continue;
        candidates.push(point);
      }
    }
    const stride = Math.max(1, Math.floor(candidates.length / 35));
    for (let i = 0; i < candidates.length; i += stride) {
      const point = candidates[i];
      await page.mouse.move(point.x, point.y);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (await mouseLayer.evaluate(element => getComputedStyle(element).cursor) === cursor) return point;
    }
    throw new Error(`Could not find a graph item with cursor ${cursor}`);
  }

  await expect(legend).toContainText("1,800 businesses");
  const point = await findGraphPoint(nodeColors, "grab");
  await page.mouse.click(point.x, point.y);
  const details = page.locator("#inspection-details");
  await expect(details).toBeVisible();
  await expect(details.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(details).toContainText("Latest inspection date");
  await expect(details.getByRole("link", { name: "County permit guide" })).toBeVisible();
  await expect(details).toContainText("Recent inspection profile");

  const firstBusiness = await details.getByRole("heading", { level: 3 }).innerText();
  const second = await findGraphPoint(nodeColors, "grab", [point]);
  await page.mouse.click(second.x, second.y);
  await expect(details.getByRole("heading", { level: 3 })).toHaveCount(1);

  async function modifiedClick({ x, y }: { x: number; y: number }, key: "Shift" | "Meta") {
    await page.keyboard.down(key);
    try {
      await page.mouse.click(x, y);
    } finally {
      await page.keyboard.up(key);
    }
  }
  await modifiedClick(point, "Shift");
  await expect(details.getByRole("heading", { name: "Business comparison" })).toBeVisible();
  await expect(details.getByRole("heading", { level: 3 })).toHaveCount(2);
  await expect(details).toContainText("similarity score");

  const third = await findGraphPoint(nodeColors, "grab", [point, second]);
  await modifiedClick(third, "Meta");
  await expect(details.getByRole("heading", { name: "What these businesses share" })).toBeVisible();
  await expect(details.getByRole("heading", { name: "3 businesses selected" })).toBeVisible();
  await expect(details.getByRole("heading", { name: "Shared topics" })).toBeVisible();
  await expect(details.getByRole("heading", { name: "Shared specific findings" })).toBeVisible();
  await details.getByRole("button", { name: /^Remove / }).last().click();
  await expect(details.getByRole("heading", { name: "Business comparison" })).toBeVisible();
  await modifiedClick(third, "Meta");
  await expect(details.getByRole("heading", { name: "3 businesses selected" })).toBeVisible();

  const menu = page.getByRole("button", { name: "Graph settings", exact: true });
  const settings = page.getByRole("dialog", { name: "Graph settings" });
  const grouping = settings.getByRole("combobox", { name: "Group by" });
  const city = settings.getByRole("combobox", { name: "City" });
  const topic = settings.getByRole("combobox", { name: "Recorded topic" });
  const pattern = settings.getByRole("combobox", { name: "Finding pattern" });
  const query = settings.getByRole("searchbox", { name: "Business name or address" });
  const reset = settings.getByRole("button", { name: "Reset filters" });

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(settings).toBeVisible();
  await expect(details).toBeHidden();
  await expect(grouping).toHaveValue("");
  await city.selectOption("SEATTLE");
  const cityMatches = Number(await graph.getAttribute("data-visible-node-count"));
  expect(cityMatches).toBeGreaterThan(0);
  expect(cityMatches).toBeLessThan(nodeCount);
  await topic.selectOption("hygiene");
  await pattern.selectOption("repeated-critical");
  const patternMatches = Number(await graph.getAttribute("data-visible-node-count"));
  expect(patternMatches).toBeGreaterThan(0);
  expect(patternMatches).toBeLessThan(cityMatches);
  expect(Number(await graph.getAttribute("data-visible-edge-count"))).toBeLessThan(edgeCount);

  await reset.click();
  await query.fill("zzzzzz no matching business zzzzzz");
  await expect(graph).toHaveAttribute("data-visible-node-count", "0");
  await expect(graph).toHaveAttribute("data-visible-edge-count", "0");
  await expect(page.locator("#inspection-empty")).toBeVisible();
  await query.fill(firstBusiness);
  await expect(page.locator("#inspection-empty")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(menu).toBeFocused();

  // The matching business stays under the same pixel after filtering others out.
  await page.mouse.click(point.x, point.y);
  await expect(details.getByRole("heading", { level: 3 })).toHaveText(firstBusiness);
  await menu.click();
  await expect(details).toBeHidden();
  await grouping.selectOption("topic");
  await expect(groupLabels).toHaveCount(inspectionTopics.length);
  await reset.click();
  await expect(graph).toHaveAttribute("data-visible-node-count", String(nodeCount));
  await expect(grouping).toHaveValue("topic");
  await expect(groupLabels.filter({ hasText: "Cleaning & sanitizing" })).toBeVisible();
  await grouping.selectOption("preparation");
  await expect(groupLabels.filter({ hasText: "Complex food preparation" })).toBeVisible();
  await grouping.selectOption("");
  await expect(groupLabels).toHaveCount(0);
  await settings.getByRole("button", { name: "Close graph settings" }).click();
  await expect(settings).toBeHidden();

  const edge = await findGraphPoint(await palette(["edge-strong", "edge-regular"]), "pointer");
  await page.mouse.click(edge.x, edge.y);
  await expect(details).toBeVisible();
  await expect(details.getByRole("heading", { level: 3 })).toHaveCount(2);
  await expect(details).toContainText("similarity score", { ignoreCase: true });
  await expect(details.getByRole("table", { name: "Number of inspection dates each business had each shared finding" })
    .or(details.getByText("No shared specific findings."))).toBeVisible();
  await page.locator("#inspection-details-close").click();
  await expect(details).toBeHidden();

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 45, { steps: 6 });
  await expect(mouseLayer).toHaveCSS("cursor", "grabbing");
  await page.mouse.up();
  await expect(details).toBeHidden();

  expect(await graphResources()).toEqual(expect.arrayContaining([
    expect.stringMatching(/sigma/i),
    expect.stringMatching(/graphology/i),
  ]));
});

for (const width of [320, 390, 768, 769, 1024, 1440]) {
  for (const path of pages) {
    test(`${path} fits a ${width}px viewport with responsive photos`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body > header *, main *, footer *")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
          })
          .map((element) => element.outerHTML.slice(0, 180));
      });
      expect(overflow).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if ([320, 390, 768, 1440].includes(width)) {
        const photo = page.locator("main img").first();
        await expect(photo).toHaveAttribute("fetchpriority", "high");
        const sizing = await photo.evaluate(async (image: HTMLImageElement) => {
          await image.decode();
          const candidates = image.srcset.split(",").map((entry) => {
            const [url, descriptor] = entry.trim().split(/\s+/);
            return { url: new URL(url, document.baseURI).href, width: parseInt(descriptor) };
          }).sort((a, b) => a.width - b.width);
          const needed = image.getBoundingClientRect().width * devicePixelRatio;
          return {
            chosen: candidates.find((candidate) => candidate.url === image.currentSrc)?.width,
            sufficient: candidates.find((candidate) => candidate.width >= needed)?.width ?? candidates.at(-1)?.width,
            ratio: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
            originalRatio: Number(image.getAttribute("width")) / Number(image.getAttribute("height")),
          };
        });
        expect(sizing.chosen).toBeDefined();
        expect(sizing.chosen!).toBeLessThanOrEqual(sizing.sufficient!);
        expect(sizing.ratio).toBeCloseTo(sizing.originalRatio, 2);
      }
    });
  }
}

for (const width of [390, 1440]) {
  for (const path of pages) {
    test(`${path} is accessible at ${width}px`, async ({ page, browserName }) => {
      // Axe examines the whole growing archive, including on slower ARM hosts.
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      // macOS WebKit uses Option+Tab to include links in keyboard navigation.
      await page.keyboard.press(browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab");
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      // Inline prose links are exempt from target sizing; actions are not.
      const smallLinks = await page.locator('a:not([href^="mailto:"])').evaluateAll((links) => links
        .filter((link) => link.getBoundingClientRect().height < 44)
        .map((link) => link.textContent));
      expect(smallLinks).toEqual([]);
    });
  }
}

test("enlarged text and custom spacing reflow without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const path of pages) {
    await page.goto(path);
    await page.addStyleTag({ content: `
      html { font-size: 200%; }
      * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
      p { margin-bottom: 2em !important; }
    ` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});

test("reduced motion disables photo zoom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const photo = page.locator("main img");
  await photo.hover();
  await expect(photo).toHaveCSS("transform", "none");
  await expect(photo).toHaveCSS("transition-duration", "0s");
});

test("a touch phone uses its device width at high pixel density", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await blockExternalRequests(context, baseURL!);
    const page = await context.newPage();
    await page.goto("/pigeons");
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole("link", { name: /^View pigeon no\./ }).first().tap();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Pigeon no\./);
  } finally {
    await context.close();
  }
});

for (const width of [320, 800, 1440]) {
  test(`larger default text preserves layout and inline contact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [...pages, "/404.html"]) {
      await page.goto(path);
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator('a[href^="mailto:"]')).toHaveCSS("display", "inline");
      const clipped = await page.locator("main h1, main h2, main p, footer span").evaluateAll(elements =>
        elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent));
      expect(clipped).toEqual([]);
    }
  });
}
