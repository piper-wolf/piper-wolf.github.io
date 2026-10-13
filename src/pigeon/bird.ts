import type { BirdDefinition } from './definition';
import { completed, gesture, locomotion, transform, walkDuration, flightDuration } from './actions';
import type { Point, Reservation } from './geometry';
export type MovementState = 'suspended' | 'perched' | 'walking' | 'flying';
export interface BirdScene {
  places(bird: Bird, walkFrom?: Point): Point[];
  settle(): void;
  scatter(): void;
}
const choose = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
export class Bird {
  state: MovementState = 'suspended';
  position?: Point;
  reservation?: Reservation;
  private animations: Animation[] = [];
  private timers: number[] = [];
  private generation = 0;
  private lastIdle = -1;
  private scheduled = false;
  private nextFlight?: number;
  constructor(readonly element: HTMLElement, readonly definition: BirdDefinition, private scene: BirdScene) {
    element.style.width = element.style.height = `${this.definition.size}px`;
    element.addEventListener('mouseenter', () => { if (this.state === 'perched') scene.scatter(); });
  }
  private render(state: MovementState) {
    this.state = state;
    const data = this.element.dataset;
    delete data.flying;
    delete data.walking;
    delete data.enhanced;
    data.state = state;
    if (state !== 'suspended') data.enhanced = '';
    if (state === 'walking') data.walking = '';
    if (state === 'flying') data.flying = '';
    this.element.style.visibility = state === 'suspended' ? 'hidden' : 'visible';
  }
  quiet() {
    this.scheduled = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.state === 'perched') this.cancelAction();
  }
  private cancelAction() {
    this.generation++;
    this.animations.forEach(a => a.cancel());
    this.animations = [];
    delete this.element.dataset.idle;
  }
  suspend() {
    this.nextFlight = undefined;
    this.quiet();
    this.cancelAction();
    this.reservation = undefined;
    this.render('suspended');
  }
  perch(point: Point) {
    this.reservation = { from: point, to: point, definition: this.definition };
    if (this.state === 'perched' && this.scheduled && this.position?.x === point.x && this.position.y === point.y) return;
    this.quiet();
    this.position = point;
    this.element.style.transform = transform(point);
    this.render('perched');
    this.schedule();
  }
  private later(callback: () => void, delay: readonly [number, number]) {
    this.timers.push(window.setTimeout(callback, delay[0] + Math.random() * delay[1]));
  }
  private schedule() {
    this.scheduled = true;
    this.later(() => this.idle(), this.definition.idleDelay);
    this.later(() => this.walk(), this.definition.walkDelay);
    this.nextFlight ??= Date.now() + this.definition.flightDelay[0] + Math.random() * this.definition.flightDelay[1];
    this.timers.push(window.setTimeout(() => this.scene.scatter(), Math.max(0, this.nextFlight - Date.now())));
  }
  private async idle() {
    if (this.state !== 'perched') return;
    this.lastIdle = (this.lastIdle + 1 + Math.floor(Math.random() * 2)) % this.definition.actions.length;
    const name = this.definition.actions[this.lastIdle];
    this.element.dataset.idle = name;
    this.animations = gesture(this.element, name);
    const generation = this.generation;
    if (await completed(this.animations) && generation === this.generation) {
      this.cancelAction();
      this.later(() => this.idle(), this.definition.idleDelay);
    }
  }
  private walk() {
    if (this.state !== 'perched' || !this.position) return;
    if (this.nextFlight !== undefined && this.nextFlight <= Date.now()) { this.scene.scatter(); return; }
    const targets = this.scene.places(this, this.position).filter(p => p.element === this.position!.element && Math.abs(p.x - this.position!.x) > 20);
    if (!targets.length) { this.later(() => this.walk(), this.definition.walkDelay); return; }
    this.move(choose(targets), 'walking');
  }
  retryFlight() {
    this.nextFlight = undefined;
    this.quiet();
    if (this.position) this.perch(this.position);
  }
  fly(point: Point, startTime?: number) { this.move(point, 'flying', startTime); }
  private async move(destination: Point, kind: 'walking' | 'flying', startTime?: number) {
    this.quiet();
    this.cancelAction();
    if (kind === 'flying') this.nextFlight = undefined;
    const from = this.position ?? { ...destination, y: scrollY - this.definition.size - 110 };
    const distance = Math.hypot(destination.x - from.x, destination.y - from.y);
    const duration = kind === 'walking' ? walkDuration(distance) : flightDuration(distance);
    const rise = Math.min(110, 40 + distance * .12);
    this.reservation = { from: kind === 'walking' ? from : destination, to: destination, definition: this.definition };
    this.element.style.transform = transform(from);
    this.element.querySelector<SVGElement>('svg')!.style.transform = destination.x >= from.x ? '' : 'scaleX(-1)';
    this.render(kind);
    const keyframes = kind === 'walking' ? [{ transform: transform(from) }, { transform: transform(destination) }] :
      [0, .1, .25, .4, .55, .7, .85, .95, 1].map(t => ({ offset: t, transform: transform({ x: from.x + (destination.x - from.x) * t, y: from.y + (destination.y - from.y) * t - Math.sin(Math.PI * t) * rise }) }));
    const movement = this.element.animate(keyframes, { duration, easing: kind === 'walking' ? 'linear' : 'ease-in-out' });
    this.animations = [movement, ...locomotion(this.element, kind, duration)];
    if (startTime !== undefined) this.animations.forEach(a => { if (a.playState !== 'paused') a.startTime = startTime; });
    const generation = this.generation;
    if (await completed([movement]) && generation === this.generation) {
      this.cancelAction();
      this.perch(destination);
      this.scene.settle();
    }
  }
}
