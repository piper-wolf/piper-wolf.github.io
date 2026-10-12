import { test, expect } from '@playwright/test';

// These exercise the built site, including the real delayed network request.
test('pigeon is decorative and usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor svg')).toBeAttached();
  await expect(page.locator('.pigeon-perch')).toHaveAttribute('aria-hidden', 'true');
  const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
    return getComputedStyle(bird).pointerEvents === 'none' && getComputedStyle(bird).visibility === 'hidden';
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

for (const width of [1440]) {
  test(`delayed module and safe flight at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(2000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '', { timeout: 10000 });

    const before = await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform);
    await page.clock.runFor(61000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
    // Finish any in-progress native animation without waiting another real minute.
    await page.locator('.pigeon-visitor').evaluate((bird) => bird.getAnimations().forEach((a) => a.finish()));
    await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-flying');
    expect(await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform)).not.toBe(before);
    const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
      const b = bird.getBoundingClientRect();
      const main = document.querySelector('main')!.getBoundingClientRect();
      return getComputedStyle(bird).pointerEvents === 'none' && b.right < main.left && b.left >= 0 && b.top >= 0 && b.bottom <= innerHeight;
    });
    expect(safe).toBe(true);
    await page.screenshot({ path: `/tmp/pigeon-${width}-${test.info().project.name}.png`, fullPage: width === 390 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
  });
}

test('animation request is after page load, without preload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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

for (const width of [390, 1280, 1440]) {
  test(`decoration adds no layout space at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const unchanged = await page.evaluate(() => {
      const measure = () => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        footer: document.querySelector('footer')!.getBoundingClientRect().toJSON(),
        main: document.querySelector('main')!.getBoundingClientRect().toJSON(),
      });
      const before = measure();
      document.querySelector('.pigeon-perch')!.remove();
      return JSON.stringify(before) === JSON.stringify(measure());
    });
    expect(unchanged).toBe(true);
  });
}

test('resting pigeon idles, pauses in flight, and hides when space disappears', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '');
  const head = page.locator('.pigeon-head');
  await expect(head).toHaveCSS('animation-name', 'pigeon-curious');
  await expect(page.locator('.pigeon-eye')).toHaveCSS('animation-name', 'pigeon-blink');
  await page.locator('.pigeon-visitor').evaluate((bird) => bird.setAttribute('data-flying', ''));
  await expect(head).toHaveCSS('animation-name', 'none');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
  await expect(page.locator('.pigeon-visitor')).toHaveCSS('visibility', 'hidden');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(head).toHaveCSS('animation-name', 'pigeon-curious');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(head).toHaveCSS('animation-name', 'none');
});

test('desktop no-JS fallback rests entirely in the existing gutter', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor')).toHaveCSS('visibility', 'visible');
  const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const b = bird.getBoundingClientRect();
    const main = document.querySelector('main')!.getBoundingClientRect();
    return b.left >= 0 && b.right < main.left && b.top >= 0 && b.bottom <= innerHeight;
  });
  expect(safe).toBe(true);
  await context.close();
});
