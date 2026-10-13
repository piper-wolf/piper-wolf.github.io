import { expect, type Page } from '@playwright/test';
export const runtime = /\/scene\.[^/]+\.js$/;

// JS deadlines use the fake clock; native animations are held and completed explicitly.
export async function prepare(page: Page, { width = 1440, height = 900, count = 1, random = 0, colors = [0, 0], separateEdges = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(({ count, random, colors, separateEdges }) => {
    let choices = 0;
    Math.random = () => {
      const index = choices++;
      if (index === 0) return (count - .5) / 3;
      if (index < count) return colors[index - 1];
      return separateEdges && index === count + 1 ? .999 : random;
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest('.pigeon-visitor')) animation.pause();
      return animation;
    };
  }, { count, random, colors, separateEdges });
}

export async function start(page: Page, options: Parameters<typeof prepare>[1] = {}) {
  await prepare(page, options);
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-state', 'flying');
}

export async function land(page: Page) {
  await expect.poll(async () => {
    await page.locator('.pigeon-visitor').evaluateAll(birds => birds.forEach(bird => bird.getAnimations().forEach(a => a.finish())));
    return page.locator('.pigeon-visitor:is([data-state="flying"], [data-state="walking"])').count();
  }).toBe(0);
}

export async function finishGesture(page: Page) {
  await page.locator('.pigeon-visitor[data-idle]').evaluateAll(birds => birds.forEach(bird => {
    bird.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).forEach(a => a.finish());
  }));
}

export async function dueMovement(page: Page, elapsed = 10000) {
  await page.clock.runFor(elapsed);
  await finishGesture(page);
  await page.clock.runFor(1);
}

export async function expectSafePerch(page: Page) {
  const birds = page.locator('.pigeon-visitor:not([data-state="suspended"])');
  await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(0);
  const safe = await birds.evaluateAll(birds => {
    const rects = birds.map(bird => bird.getBoundingClientRect());
    return rects.length > 0 && rects.every((b, i) => {
      const feet = b.top + 58 * b.height / 64;
      const onEdge = [...document.querySelectorAll<HTMLElement>('[data-pigeon-landing]')].some(edge => {
        const r = edge.getBoundingClientRect();
        const line = edge.dataset.pigeonLanding === 'header' ? r.bottom - 1 : r.top;
        return Math.abs(feet - line) < .5 && b.left >= r.left && b.right <= r.right;
      });
      const clear = [...document.querySelectorAll('header a, main a, main p, main h1, main h2, main h3, main time, main figcaption, main img, button, input, select, textarea, footer > *')]
        .filter(el => !el.querySelector('img')).every(el => {
          const r = el.getBoundingClientRect();
          return !(b.left < r.right && b.right > r.left && b.top < r.bottom && feet > r.top);
        });
      const separate = rects.every((other, j) => i === j || b.right + 24 <= other.left || other.right + 24 <= b.left || feet + 9 <= other.top || other.top + 58 * other.height / 64 + 9 <= b.top);
      return onEdge && clear && separate && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && feet < innerHeight;
    });
  });
  expect(safe).toBe(true);
}

export async function scrollTo(page: Page, y: number) {
  await page.evaluate(value => {
    document.documentElement.dataset.pigeonTestScrolled = 'false';
    window.addEventListener('scroll', () => { document.documentElement.dataset.pigeonTestScrolled = 'true'; }, { once: true });
    window.scrollTo(0, value);
  }, y);
  await expect.poll(async () => {
    await page.clock.runFor(16);
    return page.locator('html').getAttribute('data-pigeon-test-scrolled');
  }).toBe('true');
}
