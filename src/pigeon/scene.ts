import { pigeon, companionAppearances, entranceDelays } from './definition';
import { Bird } from './bird';
import { Geometry, type Point } from './geometry';
const scenes = new WeakMap<HTMLElement, Scene>();
class Scene {
  private geometry = new Geometry();
  private birds: Bird[];
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private debounce?: number;
  private active = true;
  private geometryDirty = true;
  constructor(overlay: HTMLElement) {
    const slots = [...overlay.querySelectorAll<HTMLElement>('.pigeon-visitor')];
    this.birds = slots.slice(0, entranceDelays.length).map((element, index) => {
      const appearance = index === 0 ? 'city' : companionAppearances[Math.floor(Math.random() * companionAppearances.length)];
      element.dataset.appearance = appearance;
      return new Bird(element, pigeon, this, entranceDelays[index]);
    });
    overlay.style.visibility = 'visible';
    const invalidate = () => this.invalidate();
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });
    document.addEventListener('visibilitychange', () => this.settle());
    this.motion.addEventListener('change', () => this.settle());
    window.addEventListener('pagehide', () => { this.active = false; this.suspend(); });
    window.addEventListener('pageshow', () => { this.active = true; this.geometryDirty = true; this.settle(); });
    // Container sizes, DOM edits (including position-only changes), late images,
    // and fonts all invalidate geometry. Ignore our own rendered attributes.
    const resize = new ResizeObserver(invalidate);
    const observe = () => document.querySelectorAll('header, main, footer, [data-pigeon-landing], main img').forEach(el => resize.observe(el));
    observe();
    new MutationObserver(records => {
      if (records.some(r => !overlay.contains(r.target))) { observe(); invalidate(); }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    document.addEventListener('load', invalidate, true);
    document.addEventListener('error', invalidate, true);
    document.fonts?.ready.then(invalidate);
    document.fonts?.addEventListener('loadingdone', invalidate);
    this.settle();
  }
  private suspend() {
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.birds.forEach(b => b.suspend());
  }
  private invalidate() {
    this.geometryDirty = true;
    clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => { this.debounce = undefined; this.settle(); }, 150);
  }
  private measure() {
    if (!this.geometryDirty) return;
    this.geometry.measure();
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
    if (!this.active || document.hidden || this.motion.matches) { this.suspend(); return; }
    if (this.debounce !== undefined) return;
    this.measure();
    this.birds.forEach(bird => bird.reconcile());
  }
}
export function initialize() {
  document.querySelectorAll<HTMLElement>('.pigeon-perch').forEach(overlay => {
    if (!scenes.has(overlay)) scenes.set(overlay, new Scene(overlay));
  });
}
initialize();
