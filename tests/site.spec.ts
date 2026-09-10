import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep analytics and other external services out of repeatable local checks.
  await page.route("https://**", (route) => route.abort());
});

const pages = ["/", "/pigeons/", "/pigeons/016/", "/pigeons/001/"];

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const path of pages) {
    test(`${path} fits a ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        return [...document.querySelectorAll("header *, main *")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
          })
          .map((element) => element.outerHTML.slice(0, 180));
      });
      expect(overflow).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}

for (const width of [390, 1440]) {
  for (const path of pages) {
    test(`${path} is accessible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      const smallLinks = await page.locator("a").evaluateAll((links) => links
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

for (const width of [320, 390, 768, 1440]) {
  for (const path of pages) {
    test(`${path} selects an appropriately sized photo at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
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
    });
  }
}
