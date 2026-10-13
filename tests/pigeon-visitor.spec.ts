import { test, expect, type Page } from '@playwright/test';

async function land(page: Page) {
  await page.locator('.pigeon-visitor').evaluate((bird) => bird.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-flying');
}

async function expectSafePerch(page: Page) {
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-flying');
  const safe = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const b = bird.getBoundingClientRect();
    const feet = b.top + 58 * 40 / 64;
    const edges = [...document.querySelectorAll('[data-pigeon-landing]')];
    const onEdge = edges.some((edge) => {
      const r = edge.getBoundingClientRect();
      const line = (edge as HTMLElement).dataset.pigeonLanding === 'header' ? r.bottom - 1 : r.top;
      return Math.abs(feet - line) < 0.5 && b.left >= r.left && b.right <= r.right;
    });
    const visiblePixels = { left: b.left, right: b.right, top: b.top, bottom: feet };
    const clear = [...document.querySelectorAll('header a, main a, main p, main h1, main h2, main h3, main time, main figcaption, main img, button, footer > *')]
      .filter((el) => !el.querySelector('img'))
      .every((el) => {
        const r = el.getBoundingClientRect();
        return !(visiblePixels.left < r.right && visiblePixels.right > r.left && visiblePixels.top < r.bottom && visiblePixels.bottom > r.top);
      });
    return onEdge && clear && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && feet < innerHeight;
  });
  expect(safe).toBe(true);
}

// Real production HTML and the actual delayed module, not a hydrated test island.
test('page works without JS and decoration adds no unsafe fallback', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.pigeon-perch')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.pigeon-visitor')).toHaveCSS('visibility', 'hidden');
  await page.getByRole('link', { name: 'Seattle pigeons', exact: true }).click();
  await expect(page).toHaveURL(/\/pigeons\/$/);
  await context.close();
});

test('reduced motion skips the optional module', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await page.waitForTimeout(2000);
  expect(requests.some((url) => url.endsWith('/pigeon-visitor.js'))).toBe(false);
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
});

test('flies in from off screen to the header then flies to a photo edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => {
    Math.random = () => 0;
    // Native animations use real time even with the JS clock paused. Hold each
    // flight for inspection on slow browsers; land() explicitly finishes it.
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.pigeon-visitor')) animation.pause();
      return animation;
    };
  });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '');
  await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
  const entrance = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const frames = (bird.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    const first = new DOMMatrix(frames[0].transform as string);
    const last = new DOMMatrix(frames.at(-1)!.transform as string);
    return { fromBottom: first.m42 + 40, toTop: last.m42 };
  });
  expect(entrance.fromBottom).toBeLessThan(0);
  expect(entrance.toTop).toBeGreaterThan(0);
  await land(page);
  await expectSafePerch(page);
  const before = await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform);
  await page.clock.runFor(30001);
  // Inspect and finish in one browser call: slow cross-process assertions must
  // not let WebKit finish the short native animation before we inspect it.
  const flying = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const animations = bird.getAnimations();
    const active = bird.hasAttribute('data-flying');
    const wing = getComputedStyle(bird.querySelector('.pigeon-flight-wing')!).display;
    const frames = (animations[0]?.effect as KeyframeEffect)?.getKeyframes().length;
    animations.forEach((a) => a.finish());
    return { active, wing, frames };
  });
  expect(flying.active).toBe(true);
  expect(flying.wing).toBe('block');
  expect(flying.frames).toBe(9);
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-flying');
  expect(await page.locator('.pigeon-visitor').evaluate((bird) => (bird as HTMLElement).style.transform)).not.toBe(before);
  await expectSafePerch(page);
  const photoLanding = await page.locator('.pigeon-visitor').evaluate((bird) => {
    const feet = bird.getBoundingClientRect().top + 58 * 40 / 64;
    return [...document.querySelectorAll('[data-pigeon-landing="photo"]')].some((frame) => Math.abs(feet - frame.getBoundingClientRect().top) < 0.5);
  });
  expect(photoLanding).toBe(true);
});

test('hovering over a perched pigeon flies it to a different safe perch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor');
  await expect(bird).toHaveAttribute('data-enhanced', '');
  await land(page);
  const before = await bird.boundingBox();
  await expect(bird).toHaveCSS('pointer-events', 'auto');
  await page.mouse.move(before!.x + 20, before!.y + 20);
  // Pause before cross-process assertions so native flight cannot finish early.
  const flight = await bird.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation?.pause();
    return { flying: element.hasAttribute('data-flying'), pointerEvents: getComputedStyle(element).pointerEvents };
  });
  expect(flight).toEqual({ flying: true, pointerEvents: 'none' });
  await land(page);
  const after = await bird.boundingBox();
  expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeGreaterThan(60);
  await expectSafePerch(page);
  // It can be hovered again after landing; entering does not interrupt flight.
  await page.mouse.move(after!.x + 20, after!.y + 20);
  expect(await bird.evaluate((element) => {
    const flying = element.hasAttribute('data-flying');
    element.getAnimations().forEach((animation) => animation.finish());
    return flying;
  })).toBe(true);
  await expectSafePerch(page);
});

test('idle gestures vary between looking, pecking and a half-wing stretch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor');
  await expect(bird).toHaveAttribute('data-enhanced', '');
  await land(page);
  await expect(page.locator('.pigeon-body')).toHaveCSS('animation-name', 'pigeon-breathe');
  await expect(page.locator('.pigeon-eye')).toHaveCSS('animation-name', 'pigeon-blink');
  for (const [index, action] of ['look', 'peck', 'stretch'].entries()) {
    await page.clock.runFor(index === 0 ? 6001 : 7900);
    await expect(bird).toHaveAttribute('data-idle', action);
    const part = action === 'stretch' ? '.pigeon-wing' : '.pigeon-head';
    await expect(page.locator(part)).toHaveCSS('animation-name', `pigeon-${action === 'peck' ? 'peck-head' : action}`);
    await expectSafePerch(page);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bird).not.toHaveAttribute('data-enhanced');
  await expect(bird).not.toHaveAttribute('data-idle');
  await expect(page.locator('.pigeon-body')).toHaveCSS('animation-name', 'none');
});

test('entrances and off-screen returns vary their landing spot on the same edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const entrances: number[] = [];
  const returns: number[] = [];
  for (const random of [0, 0.999]) {
    await page.goto('/pigeons/');
    // Isolate one real edge so choosing another perch cannot mask a fixed x.
    await page.evaluate((value) => {
      Math.random = () => value;
      window.scrollTo(0, 0);
      document.querySelectorAll('[data-pigeon-landing]:not([data-pigeon-landing="header"])')
        .forEach((edge) => { edge.removeAttribute('data-pigeon-landing'); });
    }, random);
    await page.clock.runFor(2000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
    await land(page);
    entrances.push((await page.locator('.pigeon-visitor').boundingBox())!.x);

    await page.evaluate(() => {
      // Scroll events arrive asynchronously; let the real event schedule the
      // debounce before advancing its timer (especially on fast CI).
      document.documentElement.dataset.pigeonTestScrolled = 'false';
      window.addEventListener('scroll', () => {
        document.documentElement.dataset.pigeonTestScrolled = 'true';
      }, { once: true });
      window.scrollTo(0, 600);
      const frame = [...document.querySelectorAll('main img')]
        .map((image) => image.parentElement!)
        .find((element) => {
          const top = element.getBoundingClientRect().top;
          return top > 60 && top < innerHeight - 8;
        });
      if (!frame) throw new Error('Expected a visible photo edge after scrolling');
      frame.dataset.pigeonLanding = 'photo';
    });
    await expect.poll(async () => {
      // WebKit also needs a frame tick to deliver the scroll event.
      await page.clock.runFor(16);
      return page.locator('html').getAttribute('data-pigeon-test-scrolled');
    }).toBe('true');
    await page.clock.runFor(200);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
    await land(page);
    returns.push((await page.locator('.pigeon-visitor').boundingBox())!.x);
  }
  expect(entrances[1] - entrances[0]).toBeGreaterThan(60);
  expect(returns[1] - returns[0]).toBeGreaterThan(60);
});

for (const width of [390, 1440]) {
  for (const edge of ['details', 'footer']) {
    test(`lands safely on the ${edge} divider at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.goto('/pigeons/047/');
      const target = page.locator(`[data-pigeon-landing="${edge}"]`);
      await expect(target).toHaveCount(1);
      await target.evaluate((element) => {
        // Center the divider, not the whole (potentially tall) section.
        window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 300);
        document.querySelectorAll('[data-pigeon-landing]').forEach((other) => {
          if (other !== element) other.removeAttribute('data-pigeon-landing');
        });
      });
      await page.clock.runFor(2000);
      await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-flying', '');
      await land(page);
      await expectSafePerch(page);
    });
  }
}

test('scrolling preserves the perch and only flies away once it is off screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor');
  await expect(bird).toHaveAttribute('data-enhanced', '');
  await land(page);
  const before = await bird.boundingBox();
  const transform = await bird.evaluate((el) => (el as HTMLElement).style.transform);
  await page.evaluate(() => window.scrollTo(0, 20));
  await expect(bird).toHaveCSS('visibility', 'visible');
  await page.clock.runFor(200);
  expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transform);
  expect((await bird.boundingBox())!.y).toBeCloseTo(before!.y - 20);
  await expect(bird).not.toHaveAttribute('data-flying');
  await expectSafePerch(page);

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(bird).toHaveCSS('visibility', 'visible');
  expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transform);
  await page.clock.runFor(200);
  await expect(bird).toHaveAttribute('data-flying', '');
  await land(page);
  await expectSafePerch(page);
});

test('scrolling during a flight does not hide or cancel it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor');
  await expect(bird).toHaveAttribute('data-flying', '');
  await bird.evaluate((el) => { (el.getAnimations()[0] as Animation).pause(); });
  await page.evaluate(() => window.scrollTo(0, 20));
  await page.clock.runFor(200);
  await expect(bird).toHaveCSS('visibility', 'visible');
  await expect(bird).toHaveAttribute('data-flying', '');
  expect(await bird.evaluate((el) => el.getAnimations()[0]?.playState)).toBe('paused');
  await land(page);
  await expectSafePerch(page);
});

for (const width of [390, 1280, 1440]) {
  test(`only existing space is used at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (width === 390) {
      // No room above the photo or between header links: hide, never add space.
      await expect(page.locator('.pigeon-visitor')).toHaveCSS('visibility', 'hidden');
    } else {
      await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-enhanced', '');
      await expectSafePerch(page);
    }
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

test('no safe edge means no bird, rather than covering mobile content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/pigeons/');
  await page.waitForFunction(() => !!document.querySelector('script[src="/pigeon-visitor.js"]'));
  await page.waitForTimeout(300);
  await expect(page.locator('.pigeon-visitor')).not.toHaveAttribute('data-enhanced');
  await expect(page.locator('.pigeon-visitor')).toHaveCSS('visibility', 'hidden');
});

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
