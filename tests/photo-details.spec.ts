import { expect, test } from "@playwright/test";

test("photos without EXIF retain their post date and omit photography details", async ({ page }) => {
  await page.goto("/pigeons/015/");
  const details = page.getByRole("region", { name: "Behind the photograph" });
  await expect(details).toHaveCount(0);
  await expect(page.locator('time[datetime="2026-09-06"]')).toHaveText("September 6, 2026");
  const data = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(data.some(value => {
    const parsed = JSON.parse(value);
    return parsed.datePublished === "2026-09-06" && parsed.dateCreated === undefined;
  })).toBeTruthy();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
