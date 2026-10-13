import { definitions } from './definition';
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
  private scatterPending = false;
  constructor(overlay: HTMLElement) {
    this.birds = [...overlay.querySelectorAll<HTMLElement>('.pigeon-visitor')].map(element => new Bird(element, definitions[element.dataset.appearance ?? 'city'] ?? definitions.city, this));
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
    this.scatterPending = false;
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.birds.forEach(b => b.suspend());
  }
  private invalidate() {
    this.geometryDirty = true;
    this.birds.forEach(b => b.quiet());
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
  settle() {
    if (!this.active || document.hidden || this.motion.matches) { this.suspend(); return; }
    if (this.debounce !== undefined) return;
    this.measure();
    // Reallocate stationary birds together so stale reservations cannot pin a
    // companion above an edge after layout changes. Keep in-flight reservations.
    this.birds.filter(b => b.state === 'perched' || b.state === 'suspended').forEach(b => { b.reservation = undefined; });
    for (const bird of this.birds) {
      if (bird.state === 'walking' || bird.state === 'flying') continue;
      const targets = this.geometry.places(bird.definition, this.birds.filter(b => b !== bird && b.reservation).map(b => b.reservation!));
      const current = targets.find(p => p.element === bird.position?.element && p.fraction === bird.position.fraction);
      if (current) bird.perch(current);
      else if (targets.length) bird.fly(targets[Math.floor(Math.random() * targets.length)]);
      else bird.suspend();
    }
    if (this.scatterPending && this.birds.every(b => b.state !== 'walking' && b.state !== 'flying')) {
      this.scatterPending = false;
      this.scatter();
    }
  }
  scatter() {
    if (!this.active || document.hidden || this.motion.matches) return;
    clearTimeout(this.debounce);
    this.debounce = undefined;
    // Do not interrupt a walk or flight. Both birds share one timeline origin;
    // reserve each destination before allocating the next bird's landing.
    if (this.birds.some(b => b.state === 'walking' || b.state === 'flying')) {
      this.scatterPending = true;
      return;
    }
    this.measure();
    const start = document.timeline.currentTime;
    for (const [index, bird] of this.birds.entries()) {
      if (!bird.position || bird.state !== 'perched') continue;
      const targets = this.geometry.places(bird.definition, this.birds.filter(b => b !== bird && b.reservation).map(b => b.reservation!))
        .filter(p => Math.hypot(p.x - bird.position!.x, p.y - bird.position!.y) > 60);
      const other = targets.filter(p => p.element !== bird.position!.element);
      const choices = other.length ? other : targets;
      if (choices.length) bird.fly(choices[Math.floor(Math.random() * choices.length)], typeof start === 'number' ? start + index * 120 : undefined);
      else bird.retryFlight();
    }
  }
}
export function initialize() {
  document.querySelectorAll<HTMLElement>('.pigeon-perch').forEach(overlay => {
    if (!scenes.has(overlay)) scenes.set(overlay, new Scene(overlay));
  });
}
initialize();
