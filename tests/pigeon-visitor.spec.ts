import { test, expect, type Page } from '@playwright/test';

// Keep the original single-bird behavior suite; flock coverage uses both birds.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.pigeon-visitor:not(:first-child)').forEach(bird => bird.remove());
    });
    observer.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => observer.disconnect(), { once: true });
  });
});

async function land(page: Page) {
  await page.locator('.pigeon-visitor:first-child').evaluate((bird) => bird.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-flying');
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-walking');
}

async function expectSafePerch(page: Page) {
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-flying');
  const safe = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
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

async function scrollTo(page: Page, y: number) {
  await page.evaluate(value => {
    document.documentElement.dataset.pigeonTestScrolled = 'false';
    window.addEventListener('scroll', () => {
      document.documentElement.dataset.pigeonTestScrolled = 'true';
    }, { once: true });
    window.scrollTo(0, value);
  }, y);
  await expect.poll(async () => {
    await page.clock.runFor(16);
    return page.locator('html').getAttribute('data-pigeon-test-scrolled');
  }).toBe('true');
}

async function walkingPerch(page: Page) {
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
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor:first-child');
  await expect(bird).toHaveAttribute('data-flying', '');
  await land(page);
  return bird;
}

// Real production HTML and the actual delayed module, not a hydrated test island.
test('page works without JS and decoration adds no unsafe fallback', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.pigeon-perch')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.pigeon-visitor:first-child')).toHaveCSS('visibility', 'hidden');
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
  expect(requests.some((url) => (/\/scene\.[^/]+\.js$/).test(url))).toBe(false);
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-enhanced');
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
  await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-enhanced', '');
  await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-flying', '');
  const entrance = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
    const frames = (bird.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    const first = new DOMMatrix(frames[0].transform as string);
    const last = new DOMMatrix(frames.at(-1)!.transform as string);
    return { fromBottom: first.m42 + 40, toTop: last.m42 };
  });
  expect(entrance.fromBottom).toBeLessThan(0);
  expect(entrance.toTop).toBeGreaterThan(0);
  await land(page);
  await expectSafePerch(page);
  const before = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => (bird as HTMLElement).style.transform);
  await page.clock.runFor(10001);
  await land(page);
  await page.clock.runFor(10000);
  await land(page);
  await page.clock.runFor(10000);
  // Inspect and finish in one browser call: slow cross-process assertions must
  // not let WebKit finish the short native animation before we inspect it.
  const flying = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
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
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-flying');
  expect(await page.locator('.pigeon-visitor:first-child').evaluate((bird) => (bird as HTMLElement).style.transform)).not.toBe(before);
  await expectSafePerch(page);
  const photoLanding = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
    const feet = bird.getBoundingClientRect().top + 58 * 40 / 64;
    return [...document.querySelectorAll('[data-pigeon-landing="photo"]')].some((frame) => Math.abs(feet - frame.getBoundingClientRect().top) < 0.5);
  });
  expect(photoLanding).toBe(true);
});

test('walks twice along the current perch before flying, with stepping and head bob', async ({ page }) => {
  test.setTimeout(60000); // Inspect two native walks and a flight on slower WebKit hosts.
  const bird = await walkingPerch(page);
  for (const direction of ['', 'scaleX(-1)']) {
    await page.clock.runFor(10000);
    const walking = await bird.evaluate((el) => {
      const animation = el.getAnimations()[0];
      const frames = (animation.effect as KeyframeEffect).getKeyframes();
      const from = new DOMMatrix(frames[0].transform as string);
      const to = new DOMMatrix(frames.at(-1)!.transform as string);
      // Inspect the middle of the actual walking path as well as the landing.
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
      return {
        walking: el.hasAttribute('data-walking'), flying: el.hasAttribute('data-flying'),
        dx: to.m41 - from.m41, dy: to.m42 - from.m42,
        facing: (el.querySelector('svg') as SVGElement).style.transform,
        feet: el.querySelector('.pigeon-foot-front')!.getAnimations().length,
        body: el.querySelector('.pigeon-body')!.getAnimations().length,
        head: el.querySelector('.pigeon-head')!.getAnimations().length,
        wing: getComputedStyle(el.querySelector('.pigeon-flight-wing')!).display,
      };
    });
    expect(walking.walking).toBe(true);
    expect(walking.flying).toBe(false);
    expect(Math.abs(walking.dx)).toBeGreaterThan(20);
    expect(walking.dy).toBe(0);
    expect(walking.facing).toBe(direction);
    expect(walking.feet).toBe(1);
    expect(walking.body).toBe(1);
    expect(walking.head).toBe(1);
    expect(walking.wing).toBe('none');
    await expectSafePerch(page);
    await bird.dispatchEvent('mouseenter');
    await expect(bird).not.toHaveAttribute('data-flying');
    await land(page);
    await expectSafePerch(page);
  }
  await page.clock.runFor(10000);
  await expect(bird).toHaveAttribute('data-flying', '');
  await land(page);
});

test('reduced motion cancels an active walk and hides the decoration', async ({ page }) => {
  const bird = await walkingPerch(page);
  await page.clock.runFor(10000);
  await expect(bird).toHaveAttribute('data-walking', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bird).not.toHaveAttribute('data-walking');
  await expect(bird).not.toHaveAttribute('data-enhanced');
  expect(await bird.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test('does not walk through content between otherwise safe landing spots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor:first-child');
  await expect(bird).toHaveAttribute('data-flying', '');
  await land(page);
  const before = await bird.evaluate((el) => (el as HTMLElement).style.transform);
  await bird.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const blocker = document.createElement('p');
    blocker.id = 'walking-obstacle';
    blocker.style.cssText = `position: absolute; margin: 0; left: ${rect.right + 15}px; top: ${rect.top}px; width: 1px; height: 30px;`;
    document.querySelector('main')!.append(blocker);
  });
  await page.clock.runFor(10001);
  await expect(bird).not.toHaveAttribute('data-walking');
  expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(before);
  await page.locator('#walking-obstacle').evaluate((el) => el.remove());
  await page.clock.runFor(10200);
  await expect(bird).toHaveAttribute('data-walking', '');
  await land(page);
  await expectSafePerch(page);
});

test('hovering over a perched pigeon flies it to a different safe perch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/pigeons/');
  await page.clock.runFor(2000);
  const bird = page.locator('.pigeon-visitor:first-child');
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
  // Let WebKit commit the landing before it hit-tests a second real hover.
  await page.mouse.move(0, 0);
  await page.clock.runFor(32);
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
  const bird = page.locator('.pigeon-visitor:first-child');
  await expect(bird).toHaveAttribute('data-enhanced', '');
  await land(page);
  await expect(page.locator('.pigeon-body')).toHaveCSS('animation-name', 'pigeon-breathe');
  await expect(page.locator('.pigeon-eye')).toHaveCSS('animation-name', 'pigeon-blink');
  for (const [index, action] of ['look', 'peck', 'stretch'].entries()) {
    if (index > 0) {
      // Each more-frequent walk interrupts idle gestures, then resumes them.
      await page.clock.runFor(4000);
      await land(page);
    }
    await page.clock.runFor(6001);
    await expect(bird).toHaveAttribute('data-idle', action);
    const part = action === 'stretch' ? '.pigeon-wing' : '.pigeon-head';
    expect(await page.locator(part).evaluate(el => el.getAnimations().some(a => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some(frame => frame.transform)))).toBe(true);
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
    await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-flying', '');
    await land(page);
    entrances.push((await page.locator('.pigeon-visitor:first-child').boundingBox())!.x);

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
    await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-flying', '');
    await land(page);
    returns.push((await page.locator('.pigeon-visitor:first-child').boundingBox())!.x);
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
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-flying', '');
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
  const bird = page.locator('.pigeon-visitor:first-child');
  await expect(bird).toHaveAttribute('data-enhanced', '');
  await land(page);
  const before = await bird.boundingBox();
  const transform = await bird.evaluate((el) => (el as HTMLElement).style.transform);
  await scrollTo(page, 20);
  await expect(bird).toHaveCSS('visibility', 'visible');
  await page.clock.runFor(200);
  expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transform);
  expect((await bird.boundingBox())!.y).toBeCloseTo(before!.y - 20);
  await expect(bird).not.toHaveAttribute('data-flying');
  await expectSafePerch(page);

  await scrollTo(page, 600);
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
  const bird = page.locator('.pigeon-visitor:first-child');
  await expect(bird).toHaveAttribute('data-flying', '');
  await bird.evaluate((el) => { (el.getAnimations()[0] as Animation).pause(); });
  await scrollTo(page, 20);
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
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveCSS('visibility', 'hidden');
    } else {
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-enhanced', '');
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
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /\/scene\.[^/]+\.js$/.test(entry.name)));
  await page.waitForTimeout(300);
  await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-enhanced');
  await expect(page.locator('.pigeon-visitor:first-child')).toHaveCSS('visibility', 'hidden');
});

test('animation request is after page load, without preload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-enhanced', '');
  const timings = await page.evaluate(() => ({
    load: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventStart,
    module: performance.getEntriesByType('resource').find(entry => /\/scene\.[^/]+\.js$/.test(entry.name))?.startTime,
    preloads: [...document.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]')].some((link) => (link as HTMLLinkElement).href.match(/\/scene\.[^/]+\.js$/)),
  }));
  expect(timings.module).toBeGreaterThanOrEqual(timings.load + 1100);
  expect(timings.preloads).toBe(false);
});
