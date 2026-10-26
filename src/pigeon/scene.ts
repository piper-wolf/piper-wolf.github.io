import { pigeon, entranceDelays } from './definition';
import { commonAppearances, companionAppearances, applyAppearance } from './appearances';
import { Bird } from './bird';
import { Geometry, type Point } from './geometry';
const scenes = new WeakMap<HTMLElement, Scene>();
class Scene {
  private geometry = new Geometry();
  private birds: Bird[] = [];
  private arrivals = new Map<HTMLElement, number>();
  private arrivalTimer?: number;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private debounce?: number;
  private active = true;
  private focused = document.hasFocus();
  private sleepingAt?: number;
  private navigating = false;
  private geometryDirty = true;
  private pointer?: { x: number; y: number };
  private pointerFrame?: number;
  constructor(private overlay: HTMLElement) {
    const slots = [...overlay.querySelectorAll<HTMLElement>('.pigeon-visitor')];
    slots.slice(0, entranceDelays.length).forEach((element, index) => {
      const choices = index === 0 ? commonAppearances : companionAppearances;
      applyAppearance(element, choices[Math.floor(Math.random() * choices.length)]);
      this.arrivals.set(element, performance.now() + entranceDelays[index]);
    });
    overlay.style.visibility = 'visible';
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || !this.awake) return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.watchPointer();
    });
    document.addEventListener('pointerleave', () => this.forgetPointer());
    window.addEventListener('blur', () => { this.focused = false; this.settle(); });
    window.addEventListener('focus', () => { this.focused = true; this.settle(); });
    const invalidate = () => this.invalidate();
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });
    document.addEventListener('visibilitychange', () => this.settle());
    this.motion.addEventListener('change', () => this.settle());
    window.addEventListener('pagehide', () => { this.active = false; this.settle(); });
    window.addEventListener('pageshow', () => { this.active = true; this.geometryDirty = true; this.settle(); });
    const resize = new ResizeObserver(invalidate);
    const mutations = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) observe();
      invalidate();
    });
    // Observe content rather than the decorative SVG tree. Animation writes
    // must not wake geometry work or repeatedly register the same elements.
    const observe = () => {
      resize.disconnect();
      mutations.disconnect();
      document.querySelectorAll('header, main, footer, [data-pigeon-landing], main img').forEach(el => resize.observe(el));
      document.querySelectorAll('header, main, footer').forEach(el => mutations.observe(el, {
        subtree: true, childList: true, attributes: true, characterData: true,
      }));
      mutations.observe(document.body, { childList: true, attributes: true });
    };
    observe();
    document.addEventListener('astro:before-swap', () => {
      this.navigating = true;
      this.forgetPointer();
      clearTimeout(this.debounce);
      this.debounce = undefined;
      this.birds.forEach(bird => bird.prepareNavigation());
    });
    document.addEventListener('astro:after-swap', () => {
      observe();
      this.navigating = false;
      this.geometryDirty = true;
      this.settle();
    });
    document.addEventListener('load', invalidate, true);
    document.addEventListener('error', invalidate, true);
    document.fonts?.ready.then(invalidate);
    document.fonts?.addEventListener('loadingdone', invalidate);
    this.settle();
  }
  private get awake() {
    return this.active && this.focused && !document.hidden && !this.motion.matches && !this.navigating;
  }
  private scheduleArrivals() {
    clearTimeout(this.arrivalTimer);
    if (!this.awake || !this.arrivals.size) return;
    this.arrivalTimer = window.setTimeout(() => {
      const now = performance.now();
      for (const [element, at] of this.arrivals) {
        if (at > now) continue;
        this.arrivals.delete(element);
        this.birds.push(new Bird(element, pigeon, this));
      }
      this.settle();
    }, Math.max(0, Math.min(...this.arrivals.values()) - performance.now()));
  }
  departed(bird: Bird) {
    this.birds = this.birds.filter(other => other !== bird);
    applyAppearance(bird.element, companionAppearances[Math.floor(Math.random() * companionAppearances.length)]);
    this.arrivals.set(bird.element, performance.now() + 30000 + Math.random() * 60000);
    this.scheduleArrivals();
  }
  watchPointer() {
    if (this.pointerFrame !== undefined || !this.awake ||
      !this.birds.some(bird => bird.movingOnGround || this.pointer && bird.state === 'perched')) return;
    this.pointerFrame = requestAnimationFrame(() => {
      this.measure();
      const pointer = this.pointer;
      const samples = this.birds.filter(bird => bird.movingOnGround || pointer && bird.state === 'perched')
        .map(bird => ({ bird, rect: bird.element.getBoundingClientRect() }));
      samples.forEach(({ bird, rect }) => {
        if (pointer) bird.reactToPointer(pointer, rect);
        bird.advanceGround(rect);
      });
      this.pointerFrame = undefined;
      if (this.birds.some(bird => bird.movingOnGround)) this.watchPointer();
    });
  }
  private forgetPointer() {
    this.pointer = undefined;
    cancelAnimationFrame(this.pointerFrame!);
    this.pointerFrame = undefined;
    this.birds.forEach(bird => bird.forgetPointer());
    this.watchPointer();
  }
  private invalidate() {
    this.geometryDirty = true;
    if (!this.awake || this.debounce !== undefined) return;
    this.debounce = window.setTimeout(() => { this.debounce = undefined; this.settle(); }, 150);
  }
  private measure() {
    if (!this.geometryDirty) return;
    this.geometry.measure();
    this.birds.forEach(bird => bird.measure());
    this.geometryDirty = false;
  }
  places(bird: Bird, walkFrom?: Point) {
    this.measure();
    return this.geometry.places(bird.definition, this.birds.filter(b => b !== bird && b.reservation).map(b => b.reservation!), walkFrom);
  }
  current(bird: Bird) {
    this.measure();
    return bird.position && this.geometry.current(bird.position, bird.definition, this.birds.filter(b => b !== bird && b.reservation).map(b => b.reservation!));
  }
  settle() {
    if (!this.awake) {
      if (this.sleepingAt === undefined) {
        this.sleepingAt = performance.now();
        this.forgetPointer();
        clearTimeout(this.arrivalTimer);
        clearTimeout(this.debounce);
        this.debounce = undefined;
      }
      this.birds.forEach(bird => bird.sleep());
      if (this.motion.matches) this.birds.forEach(bird => bird.suspend());
      if (!this.birds.some(bird => bird.state === 'flying')) this.overlay.dataset.sleeping = '';
      return;
    }
    if (this.sleepingAt !== undefined) {
      const elapsed = performance.now() - this.sleepingAt;
      this.arrivals.forEach((at, element) => this.arrivals.set(element, at + elapsed));
      this.sleepingAt = undefined;
      delete this.overlay.dataset.sleeping;
      this.geometryDirty = true;
      this.birds.forEach(bird => bird.resume(elapsed));
    }
    this.measure();
    this.birds.forEach(bird => bird.reconcile());
    this.scheduleArrivals();
  }
}
export function initialize() {
  document.querySelectorAll<HTMLElement>('.pigeon-perch').forEach(overlay => {
    if (!scenes.has(overlay)) scenes.set(overlay, new Scene(overlay));
  });
}
initialize();
