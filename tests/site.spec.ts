import { expect, test, blockExternalRequests } from "./helpers/browser";
import sharp from "sharp";

const pages = ["/", "/pigeons", "/pigeons/016", "/pigeons/001"];

test("playground lazily loads the inspection data and renders a draggable restaurant graph", async ({ page }) => {
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
  const visibleCopy = await page.evaluate(() => document.querySelectorAll("h1, h2, header, footer, button, p, details").length);
  expect(visibleCopy).toBe(0);
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
  expect(nodeCount).toBeGreaterThan(9_000);
  expect(edgeCount).toBeGreaterThan(0);
  await expect(graph).toHaveAttribute("data-first-render-ms", /\d+/);
  await expect(page.locator("#synology-graph-status")).toBeHidden();
  expect(csvRequests.length).toBeGreaterThan(0);

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
  const riskColors = [[166, 65, 40], [178, 138, 69], [36, 107, 101], [130, 144, 150]];
  const draggablePixels: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * image.channels;
      const [red, green, blue] = pixels.subarray(offset, offset + 3);
      if (riskColors.some(([r, g, b]) => Math.abs(red - r) + Math.abs(green - g) + Math.abs(blue - b) < 18)) {
        draggablePixels.push({
          x: canvasBounds!.x + x * canvasBounds!.width / image.width,
          y: canvasBounds!.y + y * canvasBounds!.height / image.height,
        });
      }
    }
  }
  expect(draggablePixels.length).toBeGreaterThan(0);
  const mouseLayer = graph.locator(".sigma-mouse");
  let draggablePoint: { x: number; y: number } | undefined;
  for (const point of draggablePixels.slice(0, 40)) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(50);
    if (await mouseLayer.evaluate(element => getComputedStyle(element).cursor) === "grab") {
      draggablePoint = point;
      break;
    }
  }
  expect(draggablePoint).toBeDefined();
  const point = draggablePoint!;
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 45, { steps: 6 });
  await expect(mouseLayer).toHaveCSS("cursor", "grabbing");
  await page.mouse.up();

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
