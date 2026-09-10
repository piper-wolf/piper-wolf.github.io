import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("https://**", (route) => route.abort());
});

test("missing pages return an accessible 404 with working recovery links", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const response = await page.goto("/a-page-that-does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Browse pigeon photos" }).click();
  await expect(page).toHaveURL("/pigeons/");
});

test("sitemap pages, internal links, fragments, images, and metadata are valid", async ({ page, request }) => {
  test.setTimeout(120_000);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const urls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]));
  expect(urls.length).toBeGreaterThan(2);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap: https://piper-wolf.com/sitemap.xml");
  const pages = new Map<string, string[]>();
  const links: URL[] = [];
  const assets = new Set<string>();
  await page.goto("/");
  for (const url of urls) {
    expect(url.origin).toBe("https://piper-wolf.com");
    const response = await request.get(url.pathname);
    expect(response.status(), url.pathname).toBe(200);
    const result = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return {
        headings: doc.querySelectorAll("h1").length,
        canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
        description: doc.querySelector('meta[name="description"]')?.getAttribute("content"),
        structuredData: [...doc.querySelectorAll('script[type="application/ld+json"]')].map((script) => JSON.parse(script.textContent!)),
        ids: [...doc.querySelectorAll("[id]")].map((element) => element.id),
        links: [...doc.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")!),
        assets: [...doc.querySelectorAll('img[src], link[rel="stylesheet"], link[rel="icon"]')].map((element) => element.getAttribute("src") ?? element.getAttribute("href")!),
        missingAlt: doc.querySelectorAll('img:not([alt]), img[alt=""]').length,
      };
    }, await response.text());
    expect(result.headings).toBe(1);
    expect(result.canonical).toBe(url.href);
    expect(result.description).toBeTruthy();
    expect(result.structuredData.length).toBeGreaterThan(0);
    expect(result.missingAlt).toBe(0);
    expect(new Set(result.ids).size).toBe(result.ids.length);
    pages.set(url.pathname, result.ids);
    links.push(...result.links.map((link) => new URL(link, url)).filter((link) => link.origin === url.origin));
    for (const asset of result.assets) assets.add(new URL(asset, url).pathname);
  }
  for (const link of links) {
    expect(pages.has(link.pathname), link.href).toBeTruthy();
    if (link.hash) expect(pages.get(link.pathname), link.href).toContain(decodeURIComponent(link.hash.slice(1)));
  }
  for (const asset of assets) expect((await request.get(asset)).status(), asset).toBe(200);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("photos and navigation work through the full browsing flow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const latest = page.getByRole("link", { name: /^View pigeon no\./ });
    const detailPath = await latest.getAttribute("href");
    await latest.click();
    await expect(page).toHaveURL(detailPath!);
    await expect(page.locator("main img")).toBeVisible();
    await page.getByRole("link", { name: "All pigeons" }).click();
    expect(new URL(page.url()).hash).toBeTruthy();
    for (const photo of await page.locator("main img").all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
    }
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/");
  });
});
