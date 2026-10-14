import { pigeon, entranceDelays } from './definition';
import { commonAppearances, companionAppearances, applyAppearance } from './appearances';
import { Bird } from './bird';
import { Geometry, type Point } from './geometry';
const scenes = new WeakMap<HTMLElement, Scene>();
class Scene {
  private geometry = new Geometry();
  private birds: Bird[] = [];
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private debounce?: number;
  private active = true;
  private geometryDirty = true;
  private pointer?: { x: number; y: number };
  private pointerFrame?: number;
  constructor(overlay: HTMLElement) {
    const slots = [...overlay.querySelectorAll<HTMLElement>('.pigeon-visitor')];
    slots.slice(0, entranceDelays.length).forEach((element, index) => {
      const choices = index === 0 ? commonAppearances : companionAppearances;
      const appearance = choices[Math.floor(Math.random() * choices.length)];
      applyAppearance(element, appearance);
      window.setTimeout(() => {
        this.birds.push(new Bird(element, pigeon, this));
        this.settle();
      }, entranceDelays[index]);
    });
    overlay.style.visibility = 'visible';
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.watchPointer();
    });
    document.addEventListener('pointerleave', () => this.forgetPointer());
    window.addEventListener('blur', () => this.forgetPointer());
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
  watchPointer() {
    if (!this.pointer || this.pointerFrame !== undefined || !this.active || document.hidden || this.motion.matches ||
      !this.birds.some(bird => bird.state === 'walking' || bird.state === 'perched')) return;
    this.pointerFrame = requestAnimationFrame(() => {
      this.measure();
      const pointer = this.pointer!;
      const samples = this.birds.filter(bird => bird.state === 'walking' || bird.state === 'perched')
        .map(bird => ({ bird, rect: bird.element.getBoundingClientRect() }));
      samples.forEach(({ bird, rect }) => bird.reactToPointer(pointer, rect));
      this.pointerFrame = undefined;
      if (this.birds.some(bird => bird.state === 'walking')) this.watchPointer();
    });
  }
  private forgetPointer() {
    this.pointer = undefined;
    cancelAnimationFrame(this.pointerFrame!);
    this.pointerFrame = undefined;
    this.birds.forEach(bird => bird.forgetPointer());
  }
  private suspend() {
    this.forgetPointer();
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
    if (!this.active || document.hidden || this.motion.matches) { this.suspend(); return; }
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
