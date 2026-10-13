import { test, expect, type Page } from '@playwright/test';
const runtime = /\/scene\.[^/]+\.js$/;
async function start(page: Page, separateEdges = false) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => {
    Math.random = () => 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.pigeon-visitor')) animation.pause();
      return animation;
    };
  });
  if (separateEdges) await page.addInitScript(() => {
    let choices = 0;
    Math.random = () => choices++ === 1 ? .999 : 0;
  });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-enhanced', '');
}
async function landAll(page: Page) {
  await expect.poll(async () => {
    await page.locator('.pigeon-visitor').evaluateAll(birds => birds.forEach(b => b.getAnimations().forEach(a => a.finish())));
    return page.locator('.pigeon-visitor[data-flying]').count();
  }).toBe(0);
}
async function safeGroup(page: Page) {
  const safe = await page.locator('.pigeon-visitor[data-enhanced]').evaluateAll(birds => {
    if (!birds.length) return false;
    const rects = birds.map(b => b.getBoundingClientRect());
    return rects.every((r, i) => {
      const feet = r.top + 58 * r.height / 64;
      const onEdge = [...document.querySelectorAll<HTMLElement>('[data-pigeon-landing]')].some(edge => {
        const e = edge.getBoundingClientRect();
        return Math.abs(feet - (edge.dataset.pigeonLanding === 'header' ? e.bottom - 1 : e.top)) < .5;
      });
      const clear = [...document.querySelectorAll('header a, main a, main p, main h1, main h2, main h3, main time, main figcaption, main img, button, footer > *')]
        .filter(el => !el.querySelector('img')).every(el => {
          const e = el.getBoundingClientRect();
          return !(r.left < e.right && r.right > e.left && r.top < e.bottom && feet > e.top);
        });
      return onEdge && clear && r.top >= 0 && feet < innerHeight && rects.every((other, j) => i === j || r.right + 24 <= other.left || other.right + 24 <= r.left || feet + 9 <= other.top || other.top + 58 * other.height / 64 + 9 <= r.top);
    });
  });
  expect(safe).toBe(true);
}
test('initial reduced motion can enable the deferred scene exactly once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', r => { if (runtime.test(r.url())) requests.push(r.url()); });
  await page.goto('/pigeons/');
  await page.waitForTimeout(1600);
  expect(requests).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-enhanced', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.pigeon-visitor[data-enhanced]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-enhanced', '');
  expect(requests).toHaveLength(1);
});
test('position-only layout shifts reattach both birds without a resize or scroll', async ({ page }) => {
  await start(page);
  await landAll(page);
  await safeGroup(page);
  await page.locator('[data-pigeon-landing="header"]').evaluate(header => { (header as HTMLElement).style.transform = 'translateY(80px)'; });
  await page.clock.runFor(300);
  await landAll(page);
  await safeGroup(page);
});
test('two appearances reserve separate perches and scatter together', async ({ page }) => {
  await start(page);
  await landAll(page);
  await expect(page.locator('.pigeon-visitor[data-enhanced]')).toHaveCount(2);
  await safeGroup(page);
  expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(b => getComputedStyle(b.querySelector('.pigeon-wing path')!).fill))).toEqual(['rgb(189, 197, 206)', 'rgb(214, 197, 182)']);
  await page.locator('.pigeon-visitor').first().dispatchEvent('mouseenter');
  await expect(page.locator('.pigeon-visitor[data-flying]')).toHaveCount(2);
  const starts = await page.locator('.pigeon-flight-wing').evaluateAll(wings => wings.map(wing => Number(wing.getAnimations()[0].startTime)));
  expect(starts[1] - starts[0]).toBeCloseTo(120);
  await landAll(page);
  await safeGroup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.pigeon-visitor[data-enhanced]')).toHaveCount(0);
  expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.flatMap(b => b.getAnimations({ subtree: true })).length)).toBe(0);
});
test('layout invalidation during flight remeasures the destination on completion', async ({ page }) => {
  await start(page);
  await page.locator('[data-pigeon-landing="header"]').evaluate(header => { (header as HTMLElement).style.transform = 'translateY(80px)'; });
  await page.clock.runFor(300);
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-flying', '');
  await landAll(page);
  await safeGroup(page);
});
test('a walking corridor remains clear of the companion bird', async ({ page }) => {
  await start(page, true);
  await landAll(page);
  await page.clock.runFor(10000);
  await expect(page.locator('.pigeon-visitor[data-walking]')).toHaveCount(1);
  await page.locator('.pigeon-visitor[data-walking]').evaluate(bird => {
    const animation = bird.getAnimations()[0];
    animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
  });
  await safeGroup(page);
  await page.locator('.pigeon-visitor[data-walking]').evaluate(bird => bird.getAnimations().forEach(a => a.finish()));
  await safeGroup(page);
});
test('page suspension cancels every action and resumes the same scene', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(page.locator('.pigeon-visitor[data-enhanced]')).toHaveCount(0);
  expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.flatMap(b => b.getAnimations({ subtree: true })).length)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await landAll(page);
  await expect(page.locator('.pigeon-visitor[data-enhanced]')).toHaveCount(2);
  await safeGroup(page);
});
