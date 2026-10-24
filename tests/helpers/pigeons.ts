import { expect, type Page, type Locator, type JSHandle } from '@playwright/test';
import type { Action } from '../../src/pigeon/actions';
import { entranceDelays } from '../../src/pigeon/definition';
export const runtime = /\/scene\.[^/]+\.js$/;

// JS deadlines use the fake clock; native animations are held and completed explicitly.
export async function prepare(page: Page, { width = 1440, height = 900, count = 1, random = .25, colors = [0, 0], facings = [0, 0, 0], separateEdges = false } = {}) {
  await page.setViewportSize({ width, height });
  const epoch = new Date('2026-01-01T12:00:00Z');
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 1000));
  await page.addInitScript(({ count, random, colors, facings, separateEdges }) => {
    // Isolate smaller groups for action/geometry scenarios; production keeps all three.
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.pigeon-visitor').forEach((bird, index) => { if (index >= count) bird.remove(); });
    });
    let choices = 0;
    Math.random = () => {
      const index = choices++;
      if (index < count) return colors[index] ?? 0;
      // Each initial destination is followed by its bird's facing choice.
      if (index >= count && index < count * 3) {
        if ((index - count) % 2 === 1) return facings[(index - count - 1) / 2] ?? 0;
        return separateEdges && index === count + 2 ? .999 : 0;
      }
      return random;
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest('.pigeon-visitor')) animation.pause();
      return animation;
    };
  }, { count, random, colors, facings, separateEdges });
}

// Allow the deferred module to initialize, then advance the first entrance wait.
export async function enter(page: Page) {
  await page.clock.runFor(2000);
  await expect(page.locator('.pigeon-perch')).toHaveCSS('visibility', 'visible');
  await page.clock.runFor(100);
}

export async function start(page: Page, options: Parameters<typeof prepare>[1] = {}) {
  await prepare(page, options);
  await page.goto('/pigeons/');
  await enter(page);
  await expect(page.locator('.pigeon-visitor').first()).toHaveAttribute('data-state', 'flying');
  for (let index = 1; index < (options.count ?? 1); index++) {
    await page.clock.runFor((entranceDelays[index] - entranceDelays[index - 1]) - 1);
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(index);
    await page.clock.runFor(1);
    await expect(page.locator('.pigeon-visitor[data-state="flying"]')).toHaveCount(index + 1);
  }
}

export async function land(page: Page) {
  await expect.poll(async () => {
    await page.locator('.pigeon-visitor').evaluateAll(birds => birds.forEach(bird => bird.getAnimations().forEach(a => a.finish())));
    return page.locator('.pigeon-visitor:is([data-state="flying"], [data-state="walking"], [data-state="running"])').count();
  }).toBe(0);
}

export async function finishGesture(page: Page) {
  await page.locator('.pigeon-visitor[data-idle]').evaluateAll(birds => birds.forEach(bird => {
    bird.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations)).forEach(a => a.finish());
  }));
}

export async function dueMovement(page: Page, elapsed = 5000) {
  await page.clock.runFor(elapsed);
  await finishGesture(page);
  await page.clock.runFor(1);
}

export async function dueFlight(page: Page) {
  for (let step = 0; step < 40; step++) {
    await dueMovement(page);
    if (await page.locator('.pigeon-visitor[data-state="flying"]').count()) return;
    await land(page);
  }
  throw new Error('No timed flight within 200 seconds');
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

export async function scare(page: Page, bird: Locator) {
  const rect = (await bird.boundingBox())!;
  await bird.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 });
  await page.clock.runFor(16);
  await page.dispatchEvent('html', 'pointerleave');
}

export async function settleGeometry(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => {
    const observer = new ResizeObserver(() => { observer.disconnect(); resolve(); });
    observer.observe(document.documentElement);
  }));
  await page.clock.runFor(200);
}

export async function perchScene(page: Page) {
  await page.goto('/pigeons/');
  await page.evaluate(() => {
    Math.random = () => .25;
    document.querySelectorAll('[data-pigeon-landing]').forEach(el => el.removeAttribute('data-pigeon-landing'));
    const main = document.querySelector<HTMLElement>('main')!;
    main.style.height = '1200px';
    main.innerHTML = '<div data-pigeon-landing style="position:absolute;left:200px;top:400px;width:1000px;height:1px"></div><div data-pigeon-landing style="position:absolute;left:200px;top:600px;width:1000px;height:1px"></div>';
  });
  await enter(page);
  await land(page);
  await settleGeometry(page);
  return page.locator('.pigeon-visitor');
}

export async function restrictPerch(page: Page, bird: Locator, onlyEdge = false) {
  await bird.evaluate((el, onlyEdge) => {
    const rect = el.getBoundingClientRect(), feet = rect.top + 58 * rect.height / 64;
    const edge = [...document.querySelectorAll<HTMLElement>('[data-pigeon-landing]')]
      .find(edge => Math.abs(edge.getBoundingClientRect().top - feet) < .5)!;
    if (onlyEdge) document.querySelectorAll('[data-pigeon-landing]').forEach(other => {
      if (other !== edge) other.removeAttribute('data-pigeon-landing');
    });
    edge.style.cssText = `position:fixed;left:${rect.left - 26}px;top:${feet}px;width:${rect.width + 52}px;height:1px`;
  }, onlyEdge);
  await settleGeometry(page);
}

export async function trackPointerWork(page: Page) {
  return page.evaluateHandle(() => {
    const work = { bounds: 0, sizes: 0, frames: 0, draws: 0 };
    document.querySelectorAll<HTMLElement>('.pigeon-visitor').forEach(bird => {
      const bounds = bird.getBoundingClientRect.bind(bird);
      bird.getBoundingClientRect = () => { work.bounds++; return bounds(); };
      const size = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!.get!;
      Object.defineProperty(bird, 'offsetWidth', { get() { work.sizes++; return size.call(bird); } });
    });
    const frame = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => { work.frames++; return frame(callback); };
    const random = Math.random;
    Math.random = () => { work.draws++; return random(); };
    return work;
  });
}

type PointerWork = { bounds: number; sizes: number; frames: number; draws: number };
export async function pointerBurst(page: Page, x: number, y: number, work?: JSHandle<PointerWork>) {
  return page.evaluate(({ x, y, work }) => {
    if (work) work.bounds = work.sizes = work.frames = work.draws = 0;
    for (let i = 0; i < 50; i++) document.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'mouse', clientX: x, clientY: y,
    }));
    return work && { ...work };
  }, { x, y, work });
}

// Inspect the real gesture and optional boundary takes with the same native
// timeline/geometry sampler. Temporary takes are canceled, never finished, so
// they cannot advance the bird manager or change the current gesture.
export async function inspectPecks(bird: Locator, takes: Action[] = []) {
  return bird.evaluate((el, takes) => {
    const finite = () => el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect!.getTiming().iterations));
    const svg = el.querySelector('svg')!, facing = svg.style.transform;
    const rect = el.getBoundingClientRect(), perch = rect.top + rect.height * 58 / 64;
    return [undefined, ...takes].map(take => {
      const animations = take ? take.map(track => {
        const a = el.querySelector(`.pigeon-${track.part}`)!.animate(track.keyframes, { ...track.timing, fill: 'both' });
        a.pause();
        return a;
      }) : finite();
      const head = animations.find(a => (a.effect as KeyframeEffect).target!.classList.contains('pigeon-head'))!;
      const frames = (head.effect as KeyframeEffect).getKeyframes(), duration = Number(head.effect!.getTiming().duration);
      const angle = (f: ComputedKeyframe) => Number(String(f.transform).match(/rotate\(([-.\d]+)deg\)/)?.[1]);
      const contacts = frames.filter(f => angle(f) > 50);
      const setTime = (time: number) => animations.forEach(a => { a.currentTime = time; });
      const depth = (time: number) => {
        setTime(time);
        return new DOMPoint(61, 20).matrixTransform(el.querySelector<SVGGraphicsElement>('.pigeon-head')!.getScreenCTM()!).y - perch;
      };
      let gap = 0, penetration = 0;
      for (const direction of ['', 'scaleX(-1)']) {
        svg.style.transform = direction;
        for (const frame of contacts) gap = Math.max(gap, Math.abs(depth(Number(frame.offset) * duration)));
        for (let i = 0; i < frames.length; i++) {
          penetration = Math.max(penetration, depth(Number(frames[i].offset) * duration));
          if (i) penetration = Math.max(penetration, depth((Number(frames[i].offset) + Number(frames[i - 1].offset)) / 2 * duration));
        }
      }
      svg.style.transform = facing;
      setTime(Number(contacts[0].offset) * duration + 10);
      const result = {
        count: contacts.length / 2, duration, gap, penetration,
        rate: 1000 / ((Number(contacts[2].offset) - Number(contacts[0].offset)) * duration),
        contactError: Math.max(...contacts.filter((_, i) => i % 2).map((f, i) => Math.abs((Number(f.offset) - Number(contacts[i * 2].offset)) * duration - 20))),
        targets: new Set(contacts.map(f => f.transform)).size,
        stops: frames.filter((f, i) => i && f.transform === frames[i - 1].transform && angle(f) < 40).length,
        squint: new DOMMatrix(getComputedStyle(el.querySelector('.pigeon-eye')!).transform).d,
        pose: ['head', 'neck'].map(part => getComputedStyle(el.querySelector(`.pigeon-${part}`)!).transform),
      };
      if (take) animations.forEach(a => a.cancel());
      return result;
    });
  }, takes);
}
