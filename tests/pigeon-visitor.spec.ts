import { test, expect } from '@playwright/test';

// These exercise the built site, including the real delayed network request.
test('pigeon is decorative and usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor svg')).toBeAttached();
  await expect(page.locator('.pigeon-perch')).toHaveAttribute('aria-hidden', 'true');
  const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const b = bird.getBoundingClientRect();
    const p = bird.parentElement!.getBoundingClientRect();
    return getComputedStyle(bird).pointerEvents === 'none' && b.top >= p.top && b.bottom <= p.bottom;
  });
  expect(safe).toBe(true);
  await page.getByRole('link', { name: 'Seattle pigeons', exact: true }).click();
  await expect(page).toHaveURL(/\/pigeons\/$/);
  await context.close();
});

test('reduced motion does not fetch the optional module', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await page.waitForTimeout(2000);
  expect(requests.some((url) => url.endsWith('/pigeon-visitor.js'))).toBe(false);
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
});

for (const width of [390, 1440]) {
  test(`delayed module and safe flight at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(2000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '', { timeout: 10000 });
    if (width === 390) await page.locator('footer').scrollIntoViewIfNeeded();
    const before = await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform);
    await page.clock.runFor(61000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
    // Finish any in-progress native animation without waiting another real minute.
    await page.locator('.pigeon-visitor').evaluate((bird) => bird.getAnimations().forEach((a) => a.finish()));
    await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-flying');
    expect(await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform)).not.toBe(before);
    const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
      const b = bird.getBoundingClientRect();
      const p = bird.parentElement!.getBoundingClientRect();
      const main = document.querySelector('main')!.getBoundingClientRect();
      return getComputedStyle(bird).pointerEvents === 'none' && (getComputedStyle(bird).position === 'fixed'
        ? b.right < main.left && b.left >= 0 && b.top >= 0 && b.bottom <= innerHeight
        : b.left >= p.left && b.right <= p.right && b.top >= p.top && b.bottom <= p.bottom);
    });
    expect(safe).toBe(true);
    await page.screenshot({ path: `/tmp/pigeon-${width}-${test.info().project.name}.png`, fullPage: width === 390 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
  });
}

test('animation request is after page load, without preload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '');
  const timings = await page.evaluate(() => ({
    load: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventStart,
    module: performance.getEntriesByName(`${location.origin}/pigeon-visitor.js`)[0]?.startTime,
    preloads: [...document.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]')].some((link) => (link as HTMLLinkElement).href.includes('pigeon-visitor')),
  }));
  expect(timings.module).toBeGreaterThanOrEqual(timings.load + 1100);
  expect(timings.preloads).toBe(false);
});
