import { test, expect } from './helpers/browser';
import { appearances, commonAppearances, companionAppearances } from '../src/pigeon/appearances';
import { gesture, movement } from '../src/pigeon/actions';
import { pigeon, entranceDelays } from '../src/pigeon/definition';
import { prepare, enter, start, land, finishGesture, dueMovement, dueFlight, expectSafePerch, scrollTo, runtime, scare, trackPointerWork, pointerBurst, inspectPecks, perchScene, restrictPerch } from './helpers/pigeons';

test.describe('loading and motion preferences', () => {
  test('initial reduced motion can enable the deferred scene exactly once', async ({ page }) => {
    await prepare(page, { count: 2 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests: string[] = [];
    page.on('request', r => { if (runtime.test(r.url())) requests.push(r.url()); });
    await page.goto('/pigeons/');
    await page.clock.runFor(2000);
    expect(requests).toHaveLength(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => { await page.clock.runFor(500); return requests.length; }).toBe(1);
    await expect.poll(async () => {
      await page.clock.runFor(100);
      return page.locator('.pigeon-visitor').first().getAttribute('data-state');
    }).not.toBe('suspended');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(0);
    // Arrival time freezes while motion is disabled.
    await page.clock.runFor(entranceDelays[1]);
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => {
      await page.clock.runFor(100);
      return page.locator('.pigeon-visitor').first().getAttribute('data-state');
    }).not.toBe('suspended');
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.clock.runFor(300000);
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.clock.runFor(entranceDelays[1]);
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(2);
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
    expect(timings.module).toBeGreaterThanOrEqual(timings.load + 250);
    expect(timings.preloads).toBe(false);
  });
});

test.describe('actions and transitions', () => {
  test('enters from either side with a swoop, keeps short level flights smooth, then flies to a photo edge', async ({ page }) => {
    // Check the full acceleration vector: arc-length timing alone cannot catch
    // a sharp turn at peak speed on an oversized, nearly vertical lift arc.
    for (const direction of [-1, 1]) {
      let previousDuration = 0;
      for (const distance of [0, .1, 1, 5, 10, 40, 200]) {
        const from = { x: 190, y: 230 }, to = { x: from.x + direction * distance, y: from.y };
        const action = movement(from, to, 'flying')[0];
        const points = action.keyframes.map(frame => {
          const coordinates = String(frame.transform).match(/translate\((.*?)px, (.*?)px\)/)!;
          return { x: Number(coordinates[1]), y: Number(coordinates[2]) };
        });
        const duration = Number(action.timing.duration);
        const dt = duration / 1000 / (points.length - 1);
        const velocities = points.slice(1).map((point, i) => ({ x: (point.x - points[i].x) / dt, y: (point.y - points[i].y) / dt }));
        const accelerations = velocities.slice(1).map((velocity, i) => Math.hypot(velocity.x - velocities[i].x, velocity.y - velocities[i].y) / dt);
        const pathLength = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
        expect(points[0]).toEqual(from);
        expect(points.at(-1)!.x).toBeCloseTo(to.x, 8);
        expect(points.at(-1)!.y).toBeCloseTo(to.y, 8);
        expect(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
        expect(pathLength).toBeLessThanOrEqual(distance * 1.2);
        expect(Math.max(...accelerations)).toBeLessThan(5400);
        expect(duration).toBeGreaterThan(previousDuration);
        if (distance <= 1) expect(duration).toBeLessThan(60);
        if (distance) {
          const initialTime = dt * 5;
          const initialDistance = points.slice(1, 6).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
          expect(2 * initialDistance / initialTime ** 2).toBeCloseTo(1800, -1);
        }
        previousDuration = duration;
      }
    }
    await start(page);
    const bird = page.locator('.pigeon-visitor');
    const entrances: { travel: number; duration: number; acceleration: number }[] = [];
    for (const facing of ['right', 'left']) {
      if (facing === 'left') {
        await page.goto('/pigeons/');
        await page.evaluate(() => {
          // Choose one bird and the first landing, then a left-facing entrance.
          let choices = 0;
          Math.random = () => {
            const choice = choices++;
            return choice === 2 ? .999 : choice > 2 ? .25 : 0;
          };
        });
        await enter(page);
        await expect(bird).toHaveAttribute('data-state', 'flying');
      }
      const entrance = await bird.evaluate(el => {
        const effect = el.getAnimations()[0].effect as KeyframeEffect;
        const frames = effect.getKeyframes();
        const points = frames.map(frame => new DOMMatrix(frame.transform as string));
        const first = points[0], last = points.at(-1)!;
        const duration = Number(effect.getTiming().duration);
        // Several samples avoid magnifying browser transform rounding at subpixel distances.
        const initialTime = Number(frames[5].offset) * duration / 1000;
        const initialDistance = points.slice(1, 6).reduce((sum, point, i) => sum + Math.hypot(point.m41 - points[i].m41, point.m42 - points[i].m42), 0);
        const wing = (el.querySelector('.pigeon-flight-wing')!.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
        const handElement = el.querySelector('.pigeon-hand-wing')!;
        const handEffect = handElement.getAnimations()[0].effect as KeyframeEffect;
        const handFrames = handEffect.getKeyframes();
        handElement.getAnimations()[0].currentTime = Number(handFrames[1].offset) * duration;
        const extended = new DOMMatrix(getComputedStyle(handElement).transform);
        handElement.getAnimations()[0].currentTime = Number(handFrames[2].offset) * duration;
        const recovered = new DOMMatrix(getComputedStyle(handElement).transform);
        const area = (matrix: DOMMatrix) => Math.abs(matrix.a * matrix.d - matrix.b * matrix.c);
        const wingTime = (index: number) => Number(wing[index].offset) * duration;
        const strokes = wing.filter((_, index) => index > 0 && index < wing.length - 1 && index % 2 === 0);
        const cruiseStroke = strokes.find(frame => Number(frame.offset) * duration > 600 && Number(frame.offset) < .65);
        const body = (el.querySelector('.pigeon-body')!.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
        const slope = (a: DOMMatrix, b: DOMMatrix) => Math.abs((b.m42 - a.m42) / (b.m41 - a.m41));
        return {
          facing: (el.querySelector('svg') as SVGElement).style.transform,
          x: first.m41, y: first.m42, endX: last.m41,
          width: el.getBoundingClientRect().width, viewport: document.documentElement.clientWidth,
          duration, easing: effect.getTiming().easing,
          acceleration: 2 * initialDistance / initialTime ** 2,
          firstBeat: wingTime(2), nextBeat: wingTime(4) - wingTime(2),
          launchStroke: new DOMMatrix(strokes[0].transform as string).m12,
          cruiseStroke: cruiseStroke ? new DOMMatrix(cruiseStroke.transform as string).m12 : undefined,
          brakingPose: body.at(-2)!.transform,
          wrist: getComputedStyle(handElement).transformOrigin,
          powerArea: area(extended), recoveryArea: area(recovered),
          recoveryRotation: recovered.b,
          synchronizedWrist: handFrames[1].offset === wing[1].offset && Number(handEffect.getTiming().duration) === duration,
          neutralWrist: handFrames.at(-1)!.transform === 'none',
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
      expect(entrance.easing).toBe('linear');
      expect(Math.abs(entrance.acceleration / 1800 - 1)).toBeLessThan(.02);
      expect(entrance.firstBeat).toBeCloseTo(1000 / 8.9, 1);
      expect(entrance.nextBeat).toBeGreaterThan(entrance.firstBeat);
      if (entrance.cruiseStroke !== undefined) expect(entrance.launchStroke).toBeGreaterThan(entrance.cruiseStroke);
      expect(entrance.brakingPose).toBe('rotate(-20deg)');
      expect(entrance.wrist).toBe('20px 19px');
      expect(entrance.powerArea).toBeCloseTo(1, 5);
      expect(entrance.recoveryArea).toBeLessThan(entrance.powerArea * .6);
      expect(entrance.recoveryRotation).toBeGreaterThan(0);
      expect(entrance.synchronizedWrist).toBe(true);
      expect(entrance.neutralWrist).toBe(true);
      entrances.push({ travel: Math.abs(entrance.endX - entrance.x), duration: entrance.duration, acceleration: entrance.acceleration });
      await land(page);
      expect(await bird.locator('svg').evaluate(el => el.style.transform)).toBe(entrance.facing);
      await expectSafePerch(page);
      expect(await bird.locator('.pigeon-hand-wing').evaluate(el => ({ animations: el.getAnimations().length, transform: getComputedStyle(el).transform }))).toEqual({ animations: 0, transform: 'none' });
    }
    entrances.sort((a, b) => a.travel - b.travel);
    expect(entrances[1].duration).toBeGreaterThan(entrances[0].duration);
    expect(Math.abs(entrances[1].acceleration / entrances[0].acceleration - 1)).toBeLessThan(.02);
    const before = await page.locator('.pigeon-visitor:first-child').evaluate((bird) => (bird as HTMLElement).style.transform);
    await dueMovement(page, 5001);
    await land(page);
    await dueMovement(page);
    await land(page);
    await dueFlight(page);
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
    await enter(page);
    await expect(page.locator('.pigeon-visitor')).toHaveAttribute('data-state', 'flying');
    await land(page);
    const bird = page.locator('.pigeon-visitor');
    for (const direction of ['', 'scaleX(-1)']) {
      if (direction === '') {
        await page.clock.runFor(5000);
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
        const duration = Number(animation.effect!.getTiming().duration);
        const sample = (time: number) => {
          el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).forEach(a => { a.currentTime = time; });
          const point = (part: string, x: number, y: number) => new DOMPoint(x, y).matrixTransform(el.querySelector<SVGGraphicsElement>(part)!.getScreenCTM()!);
          return { head: point('.pigeon-head', 42, 25), back: point('.pigeon-foot-back', 26, 57), front: point('.pigeon-foot-front', 39, 57) };
        };
        const firstStep = sample(20), hold = sample(50), thrust = sample(140);
        // Inspect the middle of the actual walking path as well as the landing.
        sample(duration / 2);
        return {
          walking: el.getAttribute('data-state') === 'walking', flying: el.getAttribute('data-state') === 'flying',
          dx: to.m41 - from.m41, dy: to.m42 - from.m42,
          speed: Math.abs(to.m41 - from.m41) / (duration / 1000),
          stableHead: Math.hypot(hold.head.x - firstStep.head.x, hold.head.y - firstStep.head.y),
          plantedFoot: Math.hypot(hold.back.x - firstStep.back.x, hold.back.y - firstStep.back.y),
          swingLift: firstStep.back.y - firstStep.front.y,
          thrust: Math.abs(thrust.head.x - hold.head.x),
          synchronizedParts: [...el.querySelectorAll('.pigeon-foot-front, .pigeon-foot-back, .pigeon-body, .pigeon-head')].every(part => Number(part.getAnimations()[0].effect!.getTiming().duration) === duration),
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
      expect(Math.abs(walking.dx)).toBeLessThanOrEqual(48);
      expect(walking.speed).toBeGreaterThan(16);
      expect(walking.speed).toBeLessThan(28);
      expect(walking.stableHead).toBeLessThan(.05);
      expect(walking.plantedFoot).toBeLessThan(.05);
      expect(walking.swingLift).toBeGreaterThan(.2);
      expect(walking.thrust).toBeGreaterThan(1);
      expect(walking.synchronizedParts).toBe(true);
      expect(walking.dy).toBe(0);
      expect(walking.facing).toBe(direction);
      expect(walking.feet).toBe(1);
      expect(walking.body).toBe(1);
      expect(walking.head).toBe(1);
      expect(walking.wing).toBe('none');
      expect(walking.neutralEnds).toBe(true);
      await expectSafePerch(page);
      if (direction) {
        await page.clock.runFor(5000);
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
    await page.clock.runFor(pigeon.flightDelay * .25 - 15000);
    await finishGesture(page);
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

  test('scales one walk gait with cursor proximity and flies from the visible position', async ({ page }) => {
    await prepare(page);
    const reset = () => perchScene(page);
    const bird = await reset();
    const approach = async (distance: number) => {
      const rect = (await bird.boundingBox())!;
      await page.mouse.move(rect.x + rect.width + distance, rect.y + rect.height / 2);
      await page.clock.runFor(16);
      return rect;
    };
    const narrowPerch = (onlyEdge = false) => restrictPerch(page, bird, onlyEdge);
    // A stationary cursor must change playback without replacing the gait.
    await dueMovement(page, 5001);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    const before = (await bird.boundingBox())!;
    const direction = await bird.evaluate(el => {
      const frames = (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      return Math.sign(new DOMMatrix(frames.at(-1)!.transform as string).m41 - new DOMMatrix(frames[0].transform as string).m41);
    });
    await page.mouse.move(direction > 0 ? before.x + before.width + 25 : before.x - 25, before.y + before.height / 2);
    await page.clock.runFor(16);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    const animation = await bird.evaluateHandle(el => el.getAnimations()[0]);
    const rate = await animation.evaluate(a => a.playbackRate);
    await bird.evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 8;
    });
    await page.clock.runFor(16);
    expect(await bird.evaluate((el, a) => el.getAnimations()[0] === a, animation)).toBe(true);
    expect(await animation.evaluate(a => a.playbackRate)).toBeGreaterThan(rate);
    const visible = await bird.evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
      return el.getBoundingClientRect().x;
    });
    await page.clock.runFor(16);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    expect(await bird.evaluate(el => {
      const frames = (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      return new DOMMatrix(frames[0].transform as string).m41;
    })).toBeCloseTo(visible, 2);
    await page.mouse.move(0, 0);
    await reset();
    await approach(330);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    const rect = (await bird.boundingBox())!;
    await page.dispatchEvent('html', 'pointermove', { pointerType: 'touch', clientX: rect.x + rect.width + 10, clientY: rect.y + rect.height / 2 });
    await expect(bird).toHaveAttribute('data-state', 'perched');
    await approach(310);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    // Hold elapsed time fixed while checking the exact proximity gradient.
    await bird.evaluate(el => el.getAnimations({ subtree: true })
      .filter(a => Number.isFinite(a.effect!.getTiming().iterations)).forEach(a => a.pause()));
    await approach(310);
    const animationHandle = await bird.evaluateHandle(el => el.getAnimations()[0]);
    const inspect = () => bird.evaluate(el => {
      const animation = el.getAnimations()[0];
      const effect = animation.effect as KeyframeEffect;
      const frames = effect.getKeyframes();
      const from = new DOMMatrix(frames[0].transform as string).m41;
      const to = new DOMMatrix(frames.at(-1)!.transform as string).m41;
      const duration = Number(effect.getTiming().duration);
      const rates = el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).map(a => a.playbackRate);
      return { from, to, speed: Math.abs(to - from) / (duration / 1000) * animation.playbackRate, rates };
    });
    const walk = await inspect();
    expect(walk.to).toBeLessThan(walk.from);
    expect(walk.rates.every(rate => Math.abs(rate - (.5 + 1.5 * 10 / 306)) < .001)).toBe(true);
    let lastSpeed = walk.speed;
    for (const distance of [260, 200, 130, 20]) {
      await approach(distance);
      await expect(bird).toHaveAttribute('data-state', 'walking');
      const faster = await inspect();
      expect(faster.speed).toBeGreaterThan(lastSpeed);
      expect(faster.rates.every(rate => Math.abs(rate - (.5 + 1.5 * (320 - distance) / 306)) < .001)).toBe(true);
      expect(faster.from).toBe(walk.from);
      expect(faster.to).toBe(walk.to);
      expect(await bird.evaluate((el, a) => el.getAnimations()[0] === a, animationHandle)).toBe(true);
      lastSpeed = faster.speed;
    }
    await expectSafePerch(page);
    // Completing a step must keep escaping from the same stationary cursor.
    await approach(200);
    const escaping = await inspect();
    await bird.evaluate(el => el.getAnimations({ subtree: true })
      .filter(a => Number.isFinite(a.effect!.getTiming().iterations)).forEach(a => a.finish()));
    await page.clock.runFor(16);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    const continued = await inspect();
    expect(continued.from).toBeCloseTo(escaping.to, 2);
    expect(continued.to).toBeLessThan(continued.from);
    expect(continued.rates[0]).toBeLessThan(escaping.rates[0]);
    expect(continued.rates.every(rate => Math.abs(rate - continued.rates[0]) < .001)).toBe(true);
    expect(await bird.evaluate((el, a) => el.getAnimations()[0] === a, animationHandle)).toBe(false);
    await approach(310);
    expect((await inspect()).rates[0]).toBeCloseTo(walk.rates[0], 2);
    // Geometry reconciliation preserves the gait and its reserved corridor.
    await page.locator('main').evaluate(el => { el.style.backgroundColor = 'transparent'; });
    await page.clock.runFor(200);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await page.dispatchEvent('html', 'pointerleave');
    expect((await inspect()).rates.every(rate => rate === 1)).toBe(true);
    const stoppedAt = await bird.evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
      return getComputedStyle(el).transform;
    });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(bird).toHaveAttribute('data-state', 'perched');
    await expect(bird).not.toHaveAttribute('data-idle');
    expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).length)).toBe(0);
    await expect(bird).toHaveCSS('transform', stoppedAt);
    await page.clock.runFor(300000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.clock.runFor(1);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    await expect(bird).toHaveCSS('transform', stoppedAt);
    const beforeFlight = await approach(10);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    expect(await bird.evaluate(el => {
      const frames = (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      return new DOMMatrix(frames[0].transform as string).m41;
    })).toBeCloseTo(beforeFlight.x, 2);
    await land(page);
    await expectSafePerch(page);
    // This landing is at the leftmost preferred sample. Retreating further
    // left must use the remaining local space, rather than fall back to flight.
    await approach(310);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await land(page);
    await expectSafePerch(page);
    await approach(130);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await page.dispatchEvent('html', 'pointerleave');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bird).toHaveAttribute('data-state', 'suspended');
    expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.runFor(100);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    // Make this perch too narrow for a step, with another edge for flight.
    await narrowPerch();
    await expectSafePerch(page);
    for (const distance of [310, 130]) {
      await approach(distance);
      await expect(bird).toHaveAttribute('data-state', 'perched');
    }
    await approach(10);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    await land(page);
    await expectSafePerch(page);

  });

  test('blocked pointer escapes coalesce reads and retry only when due', async ({ page }) => {
    await prepare(page);
    const bird = await perchScene(page);
    await restrictPerch(page, bird, true);
    const rect = (await bird.boundingBox())!;
    await page.mouse.move(rect.x + rect.width + 330, rect.y + rect.height / 2);
    await page.clock.runFor(16);
    const blocked = (await bird.boundingBox())!;
    const work = await trackPointerWork(page);
    const burst = async (x: number) => {
      expect(await pointerBurst(page, x, blocked.y + blocked.height / 2, work))
        .toEqual({ bounds: 0, sizes: 0, frames: 1, draws: 0 });
      await page.clock.runFor(16);
      const { state, ...counts } = await work.evaluate(work => ({
        ...work, state: document.querySelector<HTMLElement>('.pigeon-visitor')!.dataset.state,
      }));
      expect(state).toBe('perched');
      return counts;
    };
    expect(await burst(blocked.x + blocked.width + 100)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 1 });
    expect(await burst(blocked.x + blocked.width + 130)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 0 });
    expect(await burst(blocked.x - 100)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 1 });
    expect(await burst(blocked.x - 10)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 1 });
    expect(await burst(blocked.x - 11)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 0 });
    await dueMovement(page, pigeon.flightDelay * .25 - 1000);
    await page.clock.runFor(1017);
    expect((await work.jsonValue()).bounds).toBe(2);
    expect(await burst(blocked.x - 11)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 0 });
    await page.locator('main').evaluate(el => { el.style.backgroundColor = 'transparent'; });
    await page.clock.runFor(200);
    expect((await work.jsonValue()).draws).toBe(1);
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
    expect(await burst(blocked.x - 11)).toEqual({ bounds: 1, sizes: 0, frames: 1, draws: 1 });
  });

  test('every action can start without a minimum wait and reduced motion cancels it', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor');
    for (const [index, state] of ['perched', 'walking', 'flying'].entries()) {
      // Settling samples idle, walk, then flight. Give just this action a zero wait.
      await page.evaluate(index => {
        let draw = 0;
        Math.random = () => draw++ === index ? 0 : .25;
      }, index);
      if (index) {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect(bird).not.toHaveAttribute('data-state', 'suspended');
      } else await land(page);
      await page.clock.runFor(1);
      await expect(bird).toHaveAttribute('data-state', state);
      if (!index) await expect(bird).toHaveAttribute('data-idle', 'look');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(bird).toHaveAttribute('data-state', 'suspended');
      expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    }
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
      const leftBlocker = blocker.cloneNode() as HTMLElement;
      leftBlocker.id = 'walking-obstacle-left';
      leftBlocker.style.left = `${rect.left - 12}px`;
      document.querySelector('main')!.append(blocker, leftBlocker);
    });
    await dueMovement(page, 5001);
    await expect(bird).not.toHaveAttribute('data-state', 'walking');
    expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(before);
    await page.locator('[id^="walking-obstacle"]').evaluateAll(elements => elements.forEach(el => el.remove()));
    await dueMovement(page, 5200);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await land(page);
    await expectSafePerch(page);
  });

  test('hovering over a perched pigeon flies it to a different safe perch', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await page.clock.runFor(3000);
    await expect(bird).toHaveAttribute('data-idle', 'look');
    const pose = await bird.locator('.pigeon-head').evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.currentTime = 500;
      return getComputedStyle(el).transform;
    });
    const before = await bird.boundingBox();
    await expect(bird).toHaveCSS('pointer-events', 'auto');
    await page.mouse.move(before!.x + 20, before!.y + 20);
    await page.clock.runFor(16);
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
    await page.clock.runFor(16);
    expect(await bird.evaluate((element) => {
      const flying = element.getAttribute('data-state') === 'flying';
      element.getAnimations().forEach((animation) => animation.finish());
      return flying;
    })).toBe(true);
    await expectSafePerch(page);
    for (const { dx, dy, fallback } of [
      { dx: -30, dy: 0 }, { dx: 30, dy: 0 },
      { dx: 0, dy: -30 }, { dx: 0, dy: 30 },
      { dx: -19, dy: 0 },
      { dx: 30, dy: 0, fallback: true },
    ]) {
      await page.goto('/pigeons/');
      await page.evaluate(fallback => {
        let choices = 0;
        Math.random = () => choices++ < 2 ? 0 : .25;
        document.querySelectorAll('[data-pigeon-landing]').forEach(el => el.removeAttribute('data-pigeon-landing'));
        const main = document.querySelector<HTMLElement>('main')!;
        main.style.height = '1200px';
        const edges = fallback ? [[650, 450], [950, 450]] :
          [[650, 450], [350, 450], [950, 450], [650, 250], [650, 650]];
        main.innerHTML = edges.map(([x, y]) => `<div data-pigeon-landing style="position:absolute;left:${x}px;top:${y}px;width:92px;height:1px"></div>`).join('');
      }, !!fallback);
      await enter(page);
      await land(page);
      await page.evaluate(() => { Math.random = () => .25; });
      const from = (await bird.boundingBox())!;
      await bird.dispatchEvent('pointermove', {
        pointerType: 'mouse', clientX: from.x + from.width / 2 + dx, clientY: from.y + from.height / 2 + dy,
      });
      await page.clock.runFor(16);
      await expect(bird).toHaveAttribute('data-state', 'flying');
      const to = await bird.evaluate(el => {
        const frames = (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
        const end = new DOMMatrix(frames.at(-1)!.transform as string);
        return { x: end.m41, y: end.m42 };
      });
      if (fallback) expect(to.x).toBeGreaterThan(from.x);
      else expect((to.x - from.x) * -dx + (to.y - from.y) * -dy, JSON.stringify({ dx, dy, from, to })).toBeGreaterThan(0);
      await land(page);
      await expectSafePerch(page);
    }
  });

  test('idle gestures scan, peck, stretch, preen and ruffle with neutral recovery', async ({ page }) => {
    const invalid: string[] = [];
    for (const name of pigeon.actions) {
      const low = gesture(name, () => 0), high = gesture(name, () => .999);
      expect(low).not.toEqual(high);
      expect(low).toEqual(gesture(name, () => 0));
      for (const draw of [0, .25, .5, .999]) {
        const action = gesture(name, () => draw);
        const duration = Number(action[0].timing.duration);
        for (const track of action) {
          const offsets = track.keyframes.map(f => f.offset).filter((o): o is number => o !== undefined && o !== null);
          if (!(duration > 0 && duration < 3500 && track.timing.duration === duration &&
            track.keyframes[0].transform === 'none' && track.keyframes.at(-1)!.transform === 'none' &&
            offsets.every((offset, i) => Number.isFinite(offset) && offset >= 0 && offset <= 1 && (!i || offset >= offsets[i - 1])))) {
            invalid.push(`${name}/${draw}/${track.part}`);
          }
        }
      }
    }
    expect(invalid).toEqual([]);
    // Deterministic nonconstant draws exercise variation within a single bout.
    let sample = 0;
    const varied = gesture('peck', () => [0, .999, .2, .8, .4, .6][sample++ % 6]);
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await expect(page.locator('.pigeon-breath')).toHaveCSS('animation-name', 'pigeon-breathe');
    await expect(page.locator('.pigeon-eye')).toHaveCSS('animation-name', 'pigeon-blink');
    for (const action of pigeon.actions) {
      await page.clock.runFor(3001);
      await expect(bird).toHaveAttribute('data-idle', action);
      const part = ['stretch', 'ruffle'].includes(action) ? '.pigeon-wing' : '.pigeon-head';
      expect(await page.locator(part).evaluate(el => el.getAnimations().some(a => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some(frame => frame.transform)))).toBe(true);
      await expectSafePerch(page);
      if (action === 'stretch') {
        const stance = await bird.evaluate(el => {
          const front = el.querySelector<SVGGraphicsElement>('.pigeon-foot-front')!;
          const back = el.querySelector<SVGGraphicsElement>('.pigeon-foot-back')!;
          const animations = el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations));
          animations.forEach(a => { a.currentTime = Number(a.effect!.getTiming().duration) / 2; });
          const lifted = new DOMPoint(40, 58).matrixTransform(front.getScreenCTM()!);
          const planted = new DOMPoint(27, 58).matrixTransform(back.getScreenCTM()!);
          return { origin: getComputedStyle(front).transformOrigin, back: getComputedStyle(back).transform,
            lift: planted.y - lifted.y, reach: (planted.x - lifted.x) * Math.sign(el.querySelector('svg')!.getScreenCTM()!.a) };
        });
        expect(stance.origin).toBe('40px 49px');
        expect(stance.back).toBe('none');
        expect(stance.lift).toBeGreaterThan(1);
        expect(stance.reach).toBeGreaterThan(2);
      }
      if (action === 'look') {
        const holds = await bird.locator('.pigeon-head').evaluate(el => {
          const effect = el.getAnimations()[0].effect as KeyframeEffect;
          const animation = el.getAnimations()[0];
          const at = (fraction: number) => { animation.currentTime = Number(effect.getTiming().duration) * fraction; return getComputedStyle(el).transform; };
          return { first: [at(.3), at(.5)], second: [at(.7), at(.85)] };
        });
        expect(holds.first[0]).toBe(holds.first[1]);
        expect(holds.second[0]).toBe(holds.second[1]);
        expect(holds.first[0]).not.toBe(holds.second[0]);
      }
      expect(await bird.evaluate(el => el.getAnimations({ subtree: true })
        .filter(a => Number.isFinite(a.effect!.getTiming().iterations))
        .every(a => (a.effect as KeyframeEffect).getKeyframes().at(-1)!.transform === 'none'))).toBe(true);
      if (action === 'peck') {
        const samples = await inspectPecks(bird, [gesture('peck', () => 0), gesture('peck', () => .999), varied]);
        const [peck, low, high, mixed] = samples;
        expect(samples.map(take => take.count)).toEqual([3, 2, 5, 2]);
        expect(low.rate).toBeCloseTo(2.6, 2);
        expect(high.rate).toBeCloseTo(3.2, 2);
        expect(mixed.targets).toBeGreaterThan(1);
        expect(peck.duration).toBeGreaterThan(peck.count / peck.rate * 1000 + 500);
        expect(Math.max(...samples.map(take => take.gap))).toBeLessThan(.5);
        expect(Math.max(...samples.map(take => take.penetration))).toBeLessThan(.5);
        expect(Math.max(...samples.map(take => take.contactError))).toBeLessThan(.01);
        expect(samples.every(take => take.stops === take.count && Math.abs(take.squint - .35) < .01)).toBe(true);
      }
      await page.clock.runFor(2000);
      await expect(bird).toHaveAttribute('data-state', 'perched');
      await expect(bird).toHaveAttribute('data-idle', action);
      if (action === 'stretch') {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(bird).not.toHaveAttribute('data-idle');
        expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).length)).toBe(0);
        await expect(bird.locator('.pigeon-wing')).toHaveCSS('transform', 'none');
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      } else await finishGesture(page);
      await page.clock.runFor(1);
      await expect(bird).toHaveAttribute('data-state', 'walking');
      await land(page);
    }
    // Revisit pecking with the high random draw: a different count and pace.
    await page.evaluate(() => { Math.random = () => .999; });
    await page.clock.runFor(3001);
    await expect(bird).toHaveAttribute('data-idle', 'peck');
    const [repeat] = await inspectPecks(bird);
    expect(repeat.count).toBe(5);
    expect(repeat.rate).toBeCloseTo(3.2, 2);
    await scare(page, bird);
    await expect(bird).toHaveAttribute('data-state', 'flying');
    const recovered = await bird.evaluate(el => ['head', 'neck'].map(part => {
      const target = el.querySelector(`.pigeon-${part}`)!;
      const initial = getComputedStyle(target).transform;
      target.getAnimations()[0].currentTime = 120;
      return { initial, upright: new DOMMatrix(getComputedStyle(target).transform).isIdentity };
    }));
    expect(recovered.map(part => part.initial)).toEqual(repeat.pose);
    expect(recovered.every(part => part.upright)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bird).toHaveAttribute('data-state', 'suspended');
    await expect(bird).not.toHaveAttribute('data-idle');
    await expect(page.locator('.pigeon-body')).toHaveCSS('animation-name', 'none');
  });

  test('posed gestures recover every part on escape and cancel on suspension', async ({ page }) => {
    await start(page);
    await land(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    for (const action of pigeon.actions) {
      await page.clock.runFor(3001);
      await expect(bird).toHaveAttribute('data-idle', action);
      if (['stretch', 'preen', 'ruffle'].includes(action)) {
        const poses = await bird.evaluate(el => {
          const animations = el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations));
          animations.forEach(a => { a.currentTime = Number(a.effect!.getTiming().duration) * .4; });
          return animations.map(a => {
            const target = (a.effect as KeyframeEffect).target!;
            return { selector: `.${target.classList[0]}`, transform: getComputedStyle(target).transform };
          });
        });
        await scare(page, bird);
        await expect(bird).toHaveAttribute('data-state', 'flying');
        expect(await bird.evaluate((el, poses) => poses.map(pose => getComputedStyle(el.querySelector(pose.selector)!).transform), poses)).toEqual(poses.map(pose => pose.transform));
        expect(await bird.evaluate((el, poses) => poses.filter(pose => ['.pigeon-wing', '.pigeon-foot-front'].includes(pose.selector)).every(pose => {
          const target = el.querySelector(pose.selector)!;
          // Sample just after the boundary to avoid sub-frame interpolation
          // rounding at the normalized 120ms keyframe offset in Chromium.
          target.getAnimations()[0].currentTime = 121;
          return new DOMMatrix(getComputedStyle(target).transform).isIdentity;
        }), poses)).toBe(true);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(bird).toHaveAttribute('data-state', 'suspended');
        await expect(bird).not.toHaveAttribute('data-idle');
        expect(await bird.evaluate(el => el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).length)).toBe(0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect(bird).not.toHaveAttribute('data-state', 'suspended');
        await land(page);
      } else {
        await finishGesture(page);
        await page.clock.runFor(2000);
        await land(page);
      }
    }
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
      await enter(page);
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
      await page.clock.runFor(2200);
      await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-state', 'flying');
      await land(page);
      returns.push((await page.locator('.pigeon-visitor:first-child').boundingBox())!.x);
    }
    expect(entrances[1] - entrances[0]).toBeGreaterThan(60);
    expect(returns[1] - returns[0]).toBeGreaterThan(60);
  });

  for (const width of [320, 390, 700, 1440]) {
    for (const edge of ['header', 'photo', 'details', 'footer']) {
      test(`lands safely on the ${edge} divider at ${width}px`, async ({ page }) => {
        await prepare(page, { width });
        await page.goto('/pigeons/047/');
        const target = page.locator(`[data-pigeon-landing="${edge}"]`);
        await expect(target).toHaveCount(1);
        if (edge === 'photo' && width < 768) {
          await expect(target).toHaveCSS('padding-top', '0px');
          const tops = await target.evaluate(element => ({
            frame: element.getBoundingClientRect().top,
            image: element.querySelector('img')!.getBoundingClientRect().top,
          }));
          expect(tops.frame).toBe(tops.image);
        }
        await target.evaluate((element) => {
          // Center the divider, not the whole (potentially tall) section.
          window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 300);
          document.querySelectorAll('[data-pigeon-landing]').forEach((other) => {
            if (other !== element) other.removeAttribute('data-pigeon-landing');
          });
        });
        await enter(page);
        await expect(page.locator('.pigeon-visitor:first-child')).toHaveAttribute('data-state', 'flying');
        await land(page);
        await expectSafePerch(page);
        const firstX = (await page.locator('.pigeon-visitor:first-child').boundingBox())!.x;
        await dueMovement(page);
        await land(page);
        await expectSafePerch(page);
        if (edge === 'header' && width < 400) {
          await page.evaluate(() => { Math.random = () => .999; });
          await scare(page, page.locator('.pigeon-visitor:first-child'));
          await land(page);
          await expectSafePerch(page);
          const lastX = (await page.locator('.pigeon-visitor:first-child').boundingBox())!.x;
          expect(lastX - firstX).toBeGreaterThan(100);
        }
      });
    }
  }

  test('navigation redirects perched, walking, flying and gesturing birds from their rendered position and pose', async ({ page }) => {
    await page.route('https://gc.zgo.at/count.js', route => route.fulfill({
      contentType: 'text/javascript',
      body: 'window.pageviews = []; window.goatcounter = { count() { window.pageviews.push(location.pathname); } };',
    }));
    await start(page, { count: 3 });
    const bird = page.locator('.pigeon-visitor').first();
    const original = await bird.elementHandle();
    const requests: string[] = [];
    page.on('request', request => { if (runtime.test(request.url())) requests.push(request.url()); });
    const navigate = async () => {
      const snapshot = await page.evaluateHandle(() => {
        const saved = { x: 0, y: 0, parts: [] as { selector: string; transform: string }[] };
        document.addEventListener('astro:before-swap', () => {
          const bird = document.querySelector('.pigeon-visitor')!;
          const matrix = new DOMMatrix(getComputedStyle(bird).transform);
          saved.x = matrix.m41 - scrollX;
          saved.y = matrix.m42 - scrollY;
          saved.parts = bird.getAnimations({ subtree: true })
            .filter(animation => Number.isFinite(animation.effect!.getTiming().iterations))
            .flatMap(animation => {
              const target = (animation.effect as KeyframeEffect).target!;
              return target === bird ? [] : [{ selector: `.${target.classList[0]}`, transform: getComputedStyle(target).transform }];
            });
        }, { once: true, capture: true });
        return saved;
      });
      const destination = new URL(page.url()).pathname === '/pigeons/' ? '/' : '/pigeons/';
      await page.locator(`header a[href="${destination}"]`).first().evaluate((link: HTMLAnchorElement) => link.click());
      await expect.poll(async () => {
        await page.clock.runFor(16);
        return new URL(page.url()).pathname;
      }).toBe(destination);
      await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(3);
      expect(await original!.evaluate(el => el === document.querySelector('.pigeon-visitor'))).toBe(true);
      const saved = await snapshot.jsonValue();
      const opening = await bird.evaluate((el, parts) => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return { x: matrix.m41 - scrollX, y: matrix.m42 - scrollY,
          parts: parts.map(({ selector }) => getComputedStyle(el.querySelector(selector)!).transform) };
      }, saved.parts);
      expect(opening.x).toBeCloseTo(saved.x, 2);
      expect(opening.y).toBeCloseTo(saved.y, 2);
      expect(opening.parts).toEqual(saved.parts.map(part => part.transform));
      await land(page);
      await expectSafePerch(page);
      expect(requests).toHaveLength(0);
    };
    await land(page);
    await navigate();
    for (const action of pigeon.actions) {
      await page.clock.runFor(3001);
      await expect(bird).toHaveAttribute('data-idle', action);
      await bird.evaluate(el => el.getAnimations({ subtree: true })
        .filter(animation => Number.isFinite(animation.effect!.getTiming().iterations))
        .forEach(animation => { animation.currentTime = Number(animation.effect!.getTiming().duration) * .4; }));
      await navigate();
    }
    await dueMovement(page);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await bird.evaluate(el => el.getAnimations({ subtree: true })
      .filter(animation => Number.isFinite(animation.effect!.getTiming().iterations))
      .forEach(animation => { animation.currentTime = Number(animation.effect!.getTiming().duration) * .4; }));
    await navigate();
    await scare(page, bird);
    await bird.evaluate(el => el.getAnimations({ subtree: true })
      .filter(animation => Number.isFinite(animation.effect!.getTiming().iterations))
      .forEach(animation => { animation.currentTime = Number(animation.effect!.getTiming().duration) * .4; }));
    if (new URL(page.url()).pathname === '/pigeons/') await scrollTo(page, 500);
    await navigate();
    // Back/forward uses the same retained scene and perches.
    await page.goBack();
    await expect(bird).toHaveAttribute('data-state', 'flying');
    await land(page);
    await expectSafePerch(page);
    expect(await original!.evaluate(el => el.isConnected)).toBe(true);
    expect(await page.evaluate(() => (window as Window & { pageviews?: string[] }).pageviews)).toEqual([
      '/', '/pigeons/', '/', '/pigeons/', '/', '/pigeons/', '/', '/pigeons/', '/',
    ]);
  });

  test('scrolling preserves the perch and only flies away once it is off screen', async ({ page }) => {
    await start(page);
    const bird = page.locator('.pigeon-visitor:first-child');
    await expect(bird).not.toHaveAttribute('data-state', 'suspended');
    await land(page);
    await page.clock.runFor(3000);
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
    await dueMovement(page, 1800);
    await expect(bird).toHaveAttribute('data-state', 'walking');
    await land(page);

    const afterWalk = await bird.evaluate(el => (el as HTMLElement).style.transform);
    await scrollTo(page, 600);
    await expect(bird).toHaveCSS('visibility', 'visible');
    expect(await bird.evaluate((el) => (el as HTMLElement).style.transform)).toBe(afterWalk);
    await page.clock.runFor(200);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    // Returning before departure cancels the pending off-screen flight.
    await scrollTo(page, 0);
    await page.clock.runFor(800);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    await scrollTo(page, 600);
    await page.clock.runFor(200);
    await expect(bird).toHaveAttribute('data-state', 'perched');
    await page.clock.runFor(500);
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
      await enter(page);
      // Count one proves initialization finished even when no bird can appear.
      await expect(page.locator('.pigeon-visitor')).toHaveCount(1);
      await land(page);
      const bird = page.locator('.pigeon-visitor');
      await expect(bird).toHaveAttribute('data-state', 'perched');
      await expectSafePerch(page);
      if (width === 390) {
        await expect(bird).toHaveCSS('width', '28px');
        await expect(bird.locator('svg')).toHaveCSS('width', '28px');
        const photoTop = await page.locator('[data-pigeon-landing="photo"]').evaluate(el => el.getBoundingClientRect().top);
        const feet = await bird.evaluate(el => { const r = el.getBoundingClientRect(); return r.top + 58 * r.height / 64; });
        const headerLine = await page.locator('[data-pigeon-landing="header"]').evaluate(el => el.getBoundingClientRect().bottom - 1);
        expect([photoTop, headerLine].some(line => Math.abs(feet - line) < .5)).toBe(true);
        const bottom = await page.evaluate(() => document.documentElement.scrollHeight);
        await scrollTo(page, bottom);
        await page.clock.runFor(2200);
        await land(page);
        await expectSafePerch(page);
        await scrollTo(page, 0);
        await page.clock.runFor(2200);
        await land(page);
        await expectSafePerch(page);
        const returnedFeet = await bird.evaluate(el => { const r = el.getBoundingClientRect(); return r.top + 58 * r.height / 64; });
        expect([photoTop, headerLine].some(line => Math.abs(returnedFeet - line) < .5)).toBe(true);
        await page.goto('/pigeons/');
        await enter(page);
        await land(page);
        await expectSafePerch(page);
        for (let step = 0; step < 3; step++) {
          if (step === 2) await dueFlight(page);
          else await dueMovement(page);
          await expect(bird).toHaveAttribute('data-state', step === 2 ? 'flying' : 'walking');
          await land(page);
          await expectSafePerch(page);
        }
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
      if (width === 390) {
        await page.goto('/pigeons/');
        // Force no eligible perches instead of relying on font-dependent layout.
        await page.locator('[data-pigeon-landing]').evaluateAll(edges => edges.forEach(edge => edge.removeAttribute('data-pigeon-landing')));
        await enter(page);
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
  test('birds sharing an off-screen ledge depart independently without restarting their waits', async ({ page }) => {
    await start(page, { count: 2 });
    await land(page);
    const birds = page.locator('.pigeon-visitor');
    const feet = await birds.evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height * 58 / 64;
    }));
    expect(feet[0]).toBeCloseTo(feet[1]);
    await page.evaluate(() => {
      let draws = 0;
      Math.random = () => draws++ === 0 ? .1 : .9;
    });
    await scrollTo(page, 600);
    await page.clock.runFor(151);
    await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(2);
    await page.clock.runFor(200);
    await expect(birds.nth(0)).toHaveAttribute('data-state', 'flying');
    await expect(birds.nth(1)).toHaveAttribute('data-state', 'perched');
    await scrollTo(page, 620);
    await page.clock.runFor(1600);
    await expect(birds.nth(1)).toHaveAttribute('data-state', 'flying');
    await land(page);
    await expectSafePerch(page);
  });
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
    await page.clock.runFor(pigeon.flightDelay * .25 - 5000);
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
  test('three pigeons enter at 100ms, 90s and 3 minutes with independent flights and later replacements', async ({ page }) => {
    test.setTimeout(180000);
    const count = 3;
    const selections = (['dark', 'white'] as const).map(name => (companionAppearances.indexOf(name) + .5) / companionAppearances.length);
    await start(page, { count, colors: [(commonAppearances.indexOf('pied') + .5) / commonAppearances.length, ...selections], facings: [0, .999, 0, .999, 0] });
    expect(await page.locator('.pigeon-visitor svg').evaluateAll(birds => birds.map(bird => (bird as SVGElement).style.transform))).toEqual(['', 'scaleX(-1)', '']);
    await land(page);
    await expect(page.locator('.pigeon-visitor')).toHaveCount(count);
    await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(count);
    const colors = await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(b => ({
      appearance: (b as HTMLElement).dataset.appearance,
      wing: getComputedStyle(b.querySelector('.pigeon-wing path')!).fill,
    })));
    expect(colors).toEqual([
      { appearance: 'pied', wing: 'rgb(184, 196, 208)' },
      { appearance: 'dark', wing: 'rgb(89, 99, 115)' },
      { appearance: 'white', wing: 'rgb(243, 242, 235)' },
    ]);
    await expectSafePerch(page);
    const nearby = await page.locator('.pigeon-visitor').last().boundingBox();
    const work = await trackPointerWork(page);
    await pointerBurst(page, -1000, -1000);
    expect(await work.jsonValue()).toEqual({ bounds: 0, sizes: 0, frames: 1, draws: 0 });
    await page.clock.runFor(16);
    expect(await work.jsonValue()).toEqual({ bounds: count, sizes: 0, frames: 1, draws: 0 });
    await page.mouse.move(nearby!.x + nearby!.width / 2, nearby!.y - 340);
    await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(count);
    await scare(page, page.locator('.pigeon-visitor').last());
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(1);
    await expect(page.locator('.pigeon-visitor:not([data-state="flying"])')).toHaveCount(count - 1);
    await scare(page, page.locator('.pigeon-visitor').first());
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(2);
    await land(page);
    await expectSafePerch(page);
    for (const lifecycle of ['visibility', 'page', 'focus', 'motion']) {
      // Stop grounded gestures immediately, but let a flight land before sleeping.
      await scare(page, page.locator('.pigeon-visitor').last());
      if (lifecycle === 'focus') await scare(page, page.locator('.pigeon-visitor').first());
      await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(lifecycle === 'focus' ? 2 : 1);
      const flight = await page.locator('.pigeon-visitor[data-state="flying"]').first().evaluateHandle(el => el.getAnimations()[0]);
      if (lifecycle === 'visibility') {
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      } else if (lifecycle === 'page') {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      } else if (lifecycle === 'focus') {
        await page.evaluate(() => {
          document.querySelectorAll('.pigeon-visitor[data-state="flying"]').forEach(bird => bird.getAnimations({ subtree: true })
            .filter(animation => Number.isFinite(animation.effect!.getTiming().iterations)).forEach(animation => animation.play()));
          window.dispatchEvent(new Event('blur'));
        });
      } else {
        await page.emulateMedia({ reducedMotion: 'reduce' });
      }
      await expect(page.locator('.pigeon-visitor[data-idle]')).toHaveCount(0);
      if (lifecycle !== 'motion') {
        await expect(page.locator('.pigeon-perch')).not.toHaveAttribute('data-sleeping');
        expect(await page.locator('.pigeon-visitor[data-state="flying"]').first().evaluate((el, flight) => el.getAnimations()[0] === flight, flight)).toBe(true);
        expect(await flight.evaluate(animation => animation.playState)).toBe(lifecycle === 'focus' ? 'running' : 'paused');
        if (lifecycle === 'focus') {
          await flight.evaluate(animation => animation.finish());
          await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(1);
          await expect(page.locator('.pigeon-perch')).not.toHaveAttribute('data-sleeping');
        }
        await land(page);
        await expectSafePerch(page);
      }
      await expect(page.locator('.pigeon-perch')).toHaveAttribute('data-sleeping', '');
      expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.flatMap(bird => bird.getAnimations({ subtree: true })).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).length)).toBe(0);
      if (lifecycle === 'motion') {
        await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(0);
        expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.flatMap(b => b.getAnimations({ subtree: true })).length)).toBe(0);
      }
      const poses = await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(bird => getComputedStyle(bird).transform));
      await work.evaluate(work => { work.bounds = work.sizes = work.frames = work.draws = 0; });
      await page.locator('main').evaluate(el => { el.style.outline = 'none'; });
      await pointerBurst(page, 100, 100);
      await page.clock.runFor(300000);
      expect(await work.jsonValue()).toEqual({ bounds: 0, sizes: 0, frames: 0, draws: 0 });
      expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(bird => getComputedStyle(bird).transform))).toEqual(poses);
      if (lifecycle === 'visibility') {
        await page.evaluate(() => {
          delete (document as unknown as { hidden?: boolean }).hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        });
      } else if (lifecycle === 'page') {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      } else if (lifecycle === 'focus') {
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      } else {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
      await expect(page.locator('.pigeon-perch')).not.toHaveAttribute('data-sleeping');
      await expect(page.locator('.pigeon-visitor:not([data-state="suspended"])')).toHaveCount(count);
      await land(page);
      await expectSafePerch(page);
    }
    await land(page);
    await expect(page.locator('.pigeon-visitor[data-state="perched"]')).toHaveCount(count);
    expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(b => ({
      appearance: (b as HTMLElement).dataset.appearance,
      wing: getComputedStyle(b.querySelector('.pigeon-wing path')!).fill,
    })))).toEqual(colors);
    await expectSafePerch(page);
    // Lifetime expires independently of perch changes; vacated slots return later.
    await page.clock.runFor(300001);
    await finishGesture(page);
    await page.clock.runFor(1);
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(count);
    const departures = await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(bird => {
      const frames = (bird.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      return new DOMMatrix(frames.at(-1)!.transform as string).m41;
    }));
    expect(departures.every(x => x < 0 || x > 1440)).toBe(true);
    await land(page);
    await expect(page.locator('.pigeon-visitor[data-state="suspended"]')).toHaveCount(count);
    await page.clock.runFor(44999);
    await expect(page.locator('.pigeon-visitor[data-state="suspended"]')).toHaveCount(count);
    await page.clock.runFor(1);
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(count);
    await land(page);
    await expectSafePerch(page);
    // Exercise every catalog entry through real scene selection and both wing poses.
    for (const [index, name] of companionAppearances.entries()) {
      await page.goto('/pigeons/');
      await page.evaluate(value => { Math.random = () => value; }, (index + .5) / companionAppearances.length);
      await enter(page);
      const firstAppearance = commonAppearances[Math.floor((index + .5) / companionAppearances.length * commonAppearances.length)];
      expect(await page.locator('.pigeon-visitor').evaluateAll(birds => birds.map(bird => ({
        appearance: (bird as HTMLElement).dataset.appearance,
        breed: (bird as HTMLElement).dataset.breed,
      })))).toEqual([
        { appearance: firstAppearance, breed: 'rock' },
        ...Array(count - 1).fill({ appearance: name, breed: appearances[name].breed }),
      ]);
      const variant = page.locator('.pigeon-visitor').nth(1);
      const appearance = appearances[name];
      const visible = await variant.evaluate(el => {
        const shown = (selector: string) => getComputedStyle(el.querySelector(selector)!).display !== 'none';
        return { pattern: (el as HTMLElement).dataset.pattern, wing: getComputedStyle(el.querySelector('.pigeon-wing > path')!).fill,
          checks: shown('.pigeon-checks'), grizzle: shown('.pigeon-grizzle'), pied: shown('.pigeon-pied'), fan: shown('.pigeon-fan'), hood: shown('.pigeon-hood'), frill: shown('.pigeon-frill'), bars: shown('.pigeon-bars'),
          crest: shown('.pigeon-crest'), muffs: shown('.pigeon-muffs'), crop: shown('.pigeon-crop'), bib: shown('.pigeon-bib'), cheek: shown('.pigeon-white-cheek'), flights: shown('.pigeon-flight-mark'), normalTail: shown('.pigeon-tail-normal') };
      });
      expect(visible).toEqual({ pattern: appearance.pattern, wing: `rgb(${appearance.palette.wing.slice(1).match(/../g)!.map(n => parseInt(n, 16)).join(', ')})`,
        checks: appearance.pattern === 'checker', grizzle: appearance.pattern === 'grizzle', pied: appearance.pattern === 'pied', fan: ['fantail', 'indian-fantail'].includes(appearance.breed), hood: appearance.breed === 'jacobin', frill: appearance.breed === 'owl', bars: !['plain', 'checker'].includes(appearance.pattern),
        crest: ['owl', 'nun', 'indian-fantail'].includes(appearance.breed), muffs: ['lahore', 'pouter', 'indian-fantail'].includes(appearance.breed), crop: appearance.breed === 'pouter', bib: ['nun', 'pouter'].includes(appearance.breed), cheek: appearance.breed === 'lahore', flights: ['nun', 'pouter'].includes(appearance.breed), normalTail: !['fantail', 'indian-fantail'].includes(appearance.breed) });
      await page.clock.runFor(180000);
      await expect(variant).toHaveAttribute('data-state', 'flying');
      await expect(variant.locator('.pigeon-flight-wing')).toHaveCSS('display', 'block');
      await land(page);
      await expectSafePerch(page);
    }
  });
});
