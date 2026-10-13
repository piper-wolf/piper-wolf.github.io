import { test, expect } from '@playwright/test';
import { prepare, start, land, finishGesture, dueMovement, expectSafePerch, scrollTo, runtime } from './helpers/pigeons';

test.describe('loading and motion preferences', () => {
  test('initial reduced motion can enable the deferred scene exactly once', async ({ page }) => {
    await prepare(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests: string[] = [];
    page.on('request', r => { if (runtime.test(r.url())) requests.push(r.url()); });
    await page.goto('/pigeons/');
    await page.clock.runFor(2000);
    expect(requests).toHaveLength(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => { await page.clock.runFor(500); return requests.length; }).toBe(1);
    await expect(page.locator('.pigeon-visitor').first()).not.toHaveAttribute('data-state', 'suspended');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('.pigeon-visitor').first()).not.toHaveAttribute('data-state', 'suspended');
    expect(requests).toHaveLength(1);
  });
  test('animation request is after page load, without preload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-state', 'suspended');
    const timings = await page.evaluate(() => ({
      load: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventStart,
      module: performance.getEntriesByType('resource').find(entry => /\/scene\.[^/]+\.js$/.test(entry.name))?.startTime,
      preloads: [...document.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]')].some((link) => (link as HTMLLinkElement).href.match(/\/scene\.[^/]+\.js$/)),
    }));
    expect(timings.module).toBeGreaterThanOrEqual(timings.load + 1100);
    expect(timings.preloads).toBe(false);
  });
});

test.describe('actions and transitions', () => {
  test('enters from either side with a vertical-to-horizontal swoop, then flies to a photo edge', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor');
    const entrances: { travel: number; duration: number; easing: string | undefined }[] = [];
    for (const facing of ['right', 'left']) {
      if (facing === 'left') {
        await page.goto('/pigeons/');
        await page.evaluate(() => {
          // Choose one bird and the first landing, then a left-facing entrance.
          let choices = 0;
          Math.random = () => choices++ === 2 ? .999 : 0;
        });
        await page.clock.runFor(2000);
        await expect(bird).toHaveAttribute('data-state', 'flying');
      }
      const entrance = await bird.evaluate(el => {
        const effect = el.getAnimations()[0].effect as KeyframeEffect;
        const frames = effect.getKeyframes();
        const points = frames.map(frame => new DOMMatrix(frame.transform as string));
        const first = points[0], last = points.at(-1)!;
        const slope = (a: DOMMatrix, b: DOMMatrix) => Math.abs((b.m42 - a.m42) / (b.m41 - a.m41));
        return {
          facing: (el.querySelector('svg') as SVGElement).style.transform,
          x: first.m41, y: first.m42, endX: last.m41,
          width: el.getBoundingClientRect().width, viewport: document.documentElement.clientWidth,
          duration: Number(effect.getTiming().duration), easing: effect.getTiming().easing,
          scrollWidth: document.documentElement.scrollWidth,
          height: innerHeight, startSlope: slope(first, points[1]), endSlope: slope(points.at(-2)!, last),
          monotonicX: points.every((point, i) => !i || (last.m41 > first.m41 ? point.m41 >= points[i - 1].m41 : point.m41 <= points[i - 1].m41)),
        };
      });
      expect(entrance.facing).toBe(facing === 'right' ? '' : 'scaleX(-1)');
      if (facing === 'right') expect(entrance.x + entrance.width).toBeLessThan(0);
      else expect(entrance.x).toBeGreaterThan(entrance.viewport);
      expect(entrance.y).toBeGreaterThan(0);
      expect(entrance.y + entrance.width).toBeLessThan(entrance.height);
      expect(entrance.startSlope).toBeGreaterThan(1);
      expect(entrance.endSlope).toBeLessThan(.1);
      expect(entrance.monotonicX).toBe(true);
      expect(entrance.scrollWidth).toBe(entrance.viewport);
      entrances.push({ travel: Math.abs(entrance.endX - entrance.x), duration: entrance.duration, easing: entrance.easing });
      await land(page);
      expect(await bird.locator('svg').evaluate(el => el.style.transform)).toBe(entrance.facing);
      await expectSafePerch(page);
    }
    entrances.sort((a, b) => a.travel - b.travel);
    expect(entrances[1].duration).toBeGreaterThan(entrances[0].duration);
    expect(entrances[1].easing).not.toBe(entrances[0].easing);
    const before = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => (bird as HTMLElement).style.transform);
    await dueMovement(page, 10001);
    await land(page);
    await dueMovement(page);
    await land(page);
    await dueMovement(page);
    // Inspect and finish in one browser call: slow cross-process assertions must
    // not let WebKit finish the short native animation before we inspect it.
    const flying = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
      const animations = bird.getAnimations();
      const active = bird.getAttribute('data-state') === 'flying';
      const wing = getComputedStyle(bird.querySelector('.pigeon-flight-wing')!).display;
      const frames = (animations[0]?.effect as KeyframeEffect)?.getKeyframes().length;
      animations.forEach((a) => a.finish());
      return { active, wing, frames };
    });
    expect(flying.active).toBe(true);
    expect(flying.wing).toBe('block');
    expect(flying.frames).toBeGreaterThan(2);
    await expect(page.locator('.pigeon-visitor:first-child')).not.toHaveAttribute('data-state', 'flying');
    expect(await page.locator('.pigeon-visitor:first-child').evaluate((bird) => (bird as HTMLElement).style.transform)).not.toBe(before);
    await expectSafePerch(page);
    const photoLanding = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => {
      const feet = bird.getBoundingClientRect().top + 58 * 40 / 64;
      return [...document.querySelectorAll('[data-pigeon-landing="photo"]')].some((frame) => Math.abs(feet - frame.getBoundingClientRect().top) < 0.5);
    });
    expect(photoLanding).toBe(true);
  });

  test('walks twice along the current perch before flying, with smooth steps and stable facing on vertical flights', async ({ page }) => {
    await prepare(page);
    await page.goto('/pigeons/');
    await page.evaluate(() => {
      document.querySelectorAll('[data-pigeon-landing]').forEach(el => el.removeAttribute('data-pigeon-landing'));
      const main = document.querySelector<HTMLElement>('main')!;
      main.style.height = '1200px';
      main.innerHTML = '<div data-pigeon-landing style="position:absolute;left:200px;top:400px;width:1000px;height:1px"></div><div id="vertical-perch" data-pigeon-landing style="position:absolute;left:200px;top:600px;width:1000px;height:1px"></div>';
    });
    await page.clock.runFor(2000);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-state', 'flying');
    await land(page);
    const bird = page.locator('.pigeon-visitor');
    for (const direction of ['', 'scaleX(-1)']) {
      if (direction === '') {
        await page.clock.runFor(10000);
        await expect(bird).toHaveAttribute('data-state', 'perched');
        await expect(bird).toHaveAttribute('data-idle', 'look');
        await finishGesture(page);
        await page.clock.runFor(1);
      } else await dueMovement(page);
      const walking = await bird.evaluate((el) => {
        const animation = el.getAnimations()[0];
        const frames = (animation.effect as KeyframeEffect).getKeyframes();
        const from = new DOMMatrix(frames[0].transform as string);
        const to = new DOMMatrix(frames.at(-1)!.transform as string);
        // Inspect the middle of the actual walking path as well as the landing.
        animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
        return {
          walking: el.getAttribute('data-state') === 'walking', flying: el.getAttribute('data-state') === 'flying',
          dx: to.m41 - from.m41, dy: to.m42 - from.m42,
          facing: (el.querySelector('svg') as SVGElement).style.transform,
          feet: el.querySelector('.pigeon-foot-front')!.getAnimations().length,
          body: el.querySelector('.pigeon-body')!.getAnimations().length,
          head: el.querySelector('.pigeon-head')!.getAnimations().length,
          wing: getComputedStyle(el.querySelector('.pigeon-flight-wing')!).display,
          neutralEnds: [...el.querySelectorAll('.pigeon-foot-front, .pigeon-foot-back, .pigeon-body, .pigeon-head')].every(part => {
            const effect = part.getAnimations()[0].effect as KeyframeEffect;
            return Number.isFinite(effect.getTiming().iterations) && effect.getKeyframes().at(-1)!.transform === 'none';
          }),
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
      expect(walking.neutralEnds).toBe(true);
      await expectSafePerch(page);
      await bird.dispatchEvent('mouseenter');
      await expect(bird).not.toHaveAttribute('data-state', 'flying');
      if (direction) {
        await page.clock.runFor(10000);
        await expect(bird).toHaveAttribute('data-state', 'walking');
      }
      const endpoint = await bird.evaluate(el => {
        const animation = el.getAnimations()[0];
        animation.finish();
        return getComputedStyle(el).transform;
      });
      await land(page);
      expect(await bird.evaluate(el => getComputedStyle(el).transform)).toBe(endpoint);
      await expectSafePerch(page);
    }
    await page.clock.runFor(1);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    expect(await bird.locator('svg').evaluate(el => el.style.transform)).toBe('scaleX(-1)');
    const dx = await bird.evaluate(el => {
      const frames = (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      return new DOMMatrix(frames.at(-1)!.transform as string).m41 - new DOMMatrix(frames[0].transform as string).m41;
    });
    expect(dx).toBe(0);
    const verticalDuration = await bird.evaluate(el => Number(el.getAnimations()[0].effect!.getTiming().duration));
    await land(page);
    await bird.evaluate(el => {
      const rect = el.getBoundingClientRect();
      document.querySelector('[data-pigeon-landing]:not(#vertical-perch)')!.removeAttribute('data-pigeon-landing');
      const perch = document.querySelector<HTMLElement>('#vertical-perch')!;
      perch.style.cssText = `position:fixed;left:${rect.left - 24 + .25}px;top:${rect.top + 58 * 40 / 64 + 20}px;width:88px;height:1px`;
    });
    await page.clock.runFor(200);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    expect(await bird.locator('svg').evaluate(el => el.style.transform)).toBe('scaleX(-1)');
    expect(await bird.evaluate(el => Number(el.getAnimations()[0].effect!.getTiming().duration))).toBeLessThan(verticalDuration);
    await land(page);
    expect(await bird.locator('svg').evaluate(el => el.style.transform)).toBe('scaleX(-1)');
    await expectSafePerch(page);
  });

  test('reduced motion cancels an active walk and hides the decoration', async ({ page }) => {
    await start(page);
    await land(page);
    const bird = page.locator('.pigeon-visitor');
    await dueMovement(page);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bird).not.toHaveAttribute('data-state', 'walking');
    await expect(bird).toHaveAttribute('data-state', 'suspended');
    expect(await bird.evaluate((el) => el.getAnimations().length)).toBe(0);
  });

  test('does not walk through content between otherwise safe landing spots', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).toHaveAttribute('data-state', 'flying');
    await land(page);
    const before = await bird.evaluate((el) => (el as HTMLElement).style.transform);
    await bird.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const blocker = document.createElement('p');
      blocker.id = 'walking-obstacle';
      blocker.style.cssText = `position: absolute; margin: 0; left: ${rect.right + 15}px; top: ${rect.top}px; width: 1px; height: 30px;`;
      document.querySelector('main')!.append(blocker);
    });
    await dueMovement(page, 10001);
    await expect(bird).not.toHaveAttribute('data-state', 'walking');
    expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(before);
    await page.locator('#walking-obstacle').evaluate((el) => el.remove());
    await dueMovement(page, 10200);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await land(page);
    await expectSafePerch(page);
  });

  test('hovering over a perched pigeon flies it to a different safe perch', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await page.clock.runFor(6000);
    await expect(bird).toHaveAttribute('data-idle', 'look');
    const pose = await bird.locator('.pigeon-head').evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.currentTime = 500;
      return getComputedStyle(el).transform;
    });
    const before = await bird.boundingBox();
    await expect(bird).toHaveCSS('pointer-events', 'auto');
    await page.mouse.move(before!.x + 20, before!.y + 20);
    // Pause before cross-process assertions so native flight cannot finish early.
    const flight = await bird.evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation?.pause();
      return { flying: element.getAttribute('data-state') === 'flying', pointerEvents: getComputedStyle(element).pointerEvents };
    });
    expect(flight).toEqual({ flying: true, pointerEvents: 'none' });
    await expect(bird).not.toHaveAttribute('data-idle');
    expect(await bird.locator('.pigeon-head').evaluate(el => getComputedStyle(el).transform)).toBe(pose);
    await land(page);
    const after = await bird.boundingBox();
    expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeGreaterThan(60);
    await expectSafePerch(page);
    // Let WebKit commit the landing before it hit-tests a second real hover.
    await page.mouse.move(0, 0);
    await page.clock.runFor(32);
    await page.mouse.move(after!.x + 20, after!.y + 20);
    expect(await bird.evaluate((element) => {
      const flying = element.getAttribute('data-state') === 'flying';
      element.getAnimations().forEach((animation) => animation.finish());
      return flying;
    })).toBe(true);
    await expectSafePerch(page);
  });

  test('idle gestures vary between looking, pecking and a half-wing stretch', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await expect(page.locator('.pigeon-breath')).toHaveCSS('animation-name', 'pigeon-breathe');
    await expect(page.locator('.pigeon-eye')).toHaveCSS('animation-name', 'pigeon-blink');
    for (const action of ['look', 'peck', 'stretch']) {
      await page.clock.runFor(6001);
      await expect(bird).toHaveAttribute('data-idle', action);
      const part = action === 'stretch' ? '.pigeon-wing' : '.pigeon-head';
      expect(await page.locator(part).evaluate(el => el.getAnimations().some(a => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some(frame => frame.transform)))).toBe(true);
      await expectSafePerch(page);
      await page.clock.runFor(4000);
      await expect(bird).toHaveAttribute('data-state', 'perched');
      await expect(bird).toHaveAttribute('data-idle', action);
      await finishGesture(page);
      await page.clock.runFor(1);
      await expect(bird).toHaveAttribute('data-state', action === 'stretch' ? 'flying' : 'walking');
      await land(page);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bird).toHaveAttribute('data-state', 'suspended');
    await expect(bird).not.toHaveAttribute('data-idle');
    await expect(page.locator('.pigeon-body')).toHaveCSS('animation-name', 'none');
  });

  test('entrances and off-screen returns vary their landing spot on the same edge', async ({ page }) => {
    await prepare(page);
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
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-state', 'flying');
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
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-state', 'flying');
      await land(page);
      returns.push((await page.locator('.pigeon-visitor:first-child').boundingBox())!.x);
    }
    expect(entrances[1] - entrances[0]).toBeGreaterThan(60);
    expect(returns[1] - returns[0]).toBeGreaterThan(60);
  });

  for (const width of [390, 1440]) {
    for (const edge of ['details', 'footer']) {
      test(`lands safely on the ${edge} divider at ${width}px`, async ({ page }) => {
        await prepare(page, { width });
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
        await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-state', 'flying');
        await land(page);
        await expectSafePerch(page);
      });
    }
  }

  test('scrolling preserves the perch and only flies away once it is off screen', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await page.clock.runFor(6000);
    await expect(bird).toHaveAttribute('data-idle', 'look');
    const breathing = await bird.evaluateHandle(el => el.querySelector('.pigeon-breath')!.getAnimations()[0]);
    const before = await bird.boundingBox();
    const transform = await bird.evaluate((el) => (el as HTMLElement).style.transform);
    await scrollTo(page, 20);
    await expect(bird).toHaveCSS('visibility', 'visible');
    await page.clock.runFor(200);
    expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transform);
    expect((await bird.boundingBox())!.y).toBeCloseTo(before!.y - 20);
    await expect(bird).not.toHaveAttribute('data-state', 'flying');
    await expectSafePerch(page);
    await expect(bird).toHaveAttribute('data-idle', 'look');
    expect(await bird.evaluate((el, animation) => el.querySelector('.pigeon-breath')!.getAnimations()[0] === animation, breathing)).toBe(true);
    await finishGesture(page);
    await dueMovement(page, 3800);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await land(page);

    const afterWalk = await bird.evaluate(el => (el as HTMLElement).style.transform);
    await scrollTo(page, 600);
    await expect(bird).toHaveCSS('visibility', 'visible');
    expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(afterWalk);
    await page.clock.runFor(200);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    await land(page);
    await expectSafePerch(page);
  });

  test('scrolling during a flight does not hide or cancel it', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).toHaveAttribute('data-state', 'flying');
    await bird.evaluate((el) => { (el.getAnimations()[0] as Animation).pause(); });
    await scrollTo(page, 20);
    await page.clock.runFor(200);
    await expect(bird).toHaveCSS('visibility', 'visible');
    await expect(bird).toHaveAttribute('data-state', 'flying');
    expect(await bird.evaluate((el) => el.getAnimations()[0]?.playState)).toBe('paused');
    await land(page);
    await expectSafePerch(page);
  });

  for (const width of [390, 1280, 1440]) {
    test(`only existing space is used at ${width}px`, async ({ page }) => {
      await prepare(page, { width, height: 844 });
      await page.goto('/');
      await page.clock.runFor(2000);
      // Count one proves initialization finished even when no bird can appear.
      await expect(page.locator('.pigeon-visitor')).toHaveCount(1);
      await land(page);
      const bird = page.locator('.pigeon-visitor');
      if (width !== 390) await expect(bird).toHaveAttribute('data-state', 'perched');
      // Platform fonts can bring a safe footer perch into the mobile viewport.
      if (await bird.getAttribute('data-state') === 'suspended') {
        await expect(bird).toHaveCSS('visibility', 'hidden');
        expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
      } else await expectSafePerch(page);
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
      if (width === 390) {
        await page.goto('/pigeons/');
        // Force no eligible perches instead of relying on font-dependent layout.
        await page.locator('[data-pigeon-landing]').evaluateAll(edges => edges.forEach(edge => edge.removeAttribute('data-pigeon-landing')));
        await page.clock.runFor(2000);
        await expect(page.locator('.pigeon-visitor')).toHaveCount(1);
        await land(page);
        await expect(bird).toHaveAttribute('data-state', 'suspended');
        await expect(bird).toHaveCSS('visibility', 'hidden');
        expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
      }
    });
  }

});

test.describe('independent birds and layout', () => {
  test('position-only layout shifts reattach both birds without a resize or scroll', async ({ page }) => {
    await start(page, { count: 2 });
    await page.locator('[data-pigeon-landing="header"]').evaluate(header => { (header as HTMLElement).style.transform = 'translateY(80px)'; });
    await page.clock.runFor(300);
    await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-state', 'flying');
    await land(page);
    await expectSafePerch(page);
    await page.locator('[data-pigeon-landing="header"]').evaluate(header => { (header as HTMLElement).style.transform = 'translateY(120px)'; });
    await page.clock.runFor(300);
    await expectSafePerch(page);
  });
  test('walking corridors stay clear and do not block a companion flight deadline', async ({ page }) => {
    await start(page, { count: 2, separateEdges: true });
    await land(page);
    await dueMovement(page);
    await expect(page.locator('.pigeon-visitor[data-state="walking"]').first()).toBeVisible();
    await page.locator('.pigeon-visitor[data-state="walking"]').evaluateAll(birds => birds.forEach(bird => {
      const animation = bird.getAnimations()[0];
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    }));
    await expectSafePerch(page);
    const held = await page.locator('.pigeon-visitor[data-state="walking"]').first().elementHandle();
    await page.locator('.pigeon-visitor').evaluateAll((birds, held) => birds.filter(bird => bird !== held).forEach(bird => bird.getAnimations().forEach(a => a.finish())), held);
    await page.clock.runFor(20000);
    await finishGesture(page);
    await page.clock.runFor(1);
    expect(await held!.getAttribute('data-state')).toBe('walking');
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(1);
    await page.locator('.pigeon-visitor[data-state="flying"]').evaluateAll(birds => birds.forEach(bird => bird.getAnimations().forEach(a => a.finish())));
    await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(1);
    await held!.evaluate(bird => bird.getAnimations().forEach(a => a.finish()));
    await expect(page.locator('.pigeon-visitor[data-state="walking"]')).toHaveCount(0);
    await page.clock.runFor(1);
    expect(await held!.getAttribute('data-state')).toBe('flying');
    await land(page);
    await expectSafePerch(page);
  });
  for (const count of [1, 2, 3]) {
    test(`spawns ${count} pigeons with stable palettes and independent flights`, async ({ page }) => {
      await start(page, { count, colors: [.999, .5], facings: [0, .999, 0] });
      expect(await page.locator('.pigeon-visitor svg').evaluateAll(birds => birds.map(bird => (bird as SVGElement).style.transform))).toEqual(['', 'scaleX(-1)', ''].slice(0, count));
      await land(page);
      await expect(page.locator('.pigeon-visitor')).toHaveCount(count);
      await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(count);
      const colors = await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(b => ({
        appearance: (b as HTMLElement).dataset.appearance,
        wing: getComputedStyle(b.querySelector('.pigeon-wing path')!).fill,
      })));
      expect(colors).toEqual([
        { appearance: 'city', wing: 'rgb(189, 197, 206)' },
        { appearance: 'dark', wing: 'rgb(107, 106, 120)' },
        { appearance: 'white', wing: 'rgb(245, 242, 233)' },
      ].slice(0, count));
      await expectSafePerch(page);
      await page.locator('.pigeon-visitor').last().dispatchEvent('mouseenter');
      await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(1);
      await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(count - 1);
      if (count > 1) {
        await page.locator('.pigeon-visitor').first().dispatchEvent('mouseenter');
        await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(2);
      }
      await land(page);
      await expectSafePerch(page);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(0);
      expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.flatMap(b => b.getAnimations({ subtree: true })).length)).toBe(0);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await land(page);
      await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(count);
      expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(b => ({
        appearance: (b as HTMLElement).dataset.appearance,
        wing: getComputedStyle(b.querySelector('.pigeon-wing path')!).fill,
      })))).toEqual(colors);
      await expectSafePerch(page);
    });
  }
});
