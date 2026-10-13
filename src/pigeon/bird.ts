import type { BirdDefinition } from './definition';
import { gesture, movement, transform, type Action } from './actions';
import type { Point, Reservation } from './geometry';
export type MovementState = 'suspended' | 'perched' | 'walking' | 'flying';
export interface BirdScene {
  places(bird: Bird, walkFrom?: Point): Point[];
  current(bird: Bird): Point | undefined;
}
const choose = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
export class Bird {
  state: MovementState = 'suspended';
  position?: Point;
  reservation?: Reservation;
  private animations: Animation[] = [];
  private timer?: number;
  private pointer?: { x: number; y: number };
  private pointerFrame?: number;
  private generation = 0;
  private lastIdle = -1;
  private facing: 'left' | 'right' = 'right';
  private deadlines = { idle: Infinity, walk: Infinity, flight: Infinity };
  constructor(readonly element: HTMLElement, private baseDefinition: BirdDefinition, private scene: BirdScene) {
    this.render('suspended');
    element.addEventListener('mouseenter', event => {
      if (this.state === 'perched') this.flight({ x: event.clientX + scrollX, y: event.clientY + scrollY });
    });
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.reactToPointer();
      this.watchPointer();
    });
    const forgetPointer = () => {
      this.pointer = undefined;
      this.setWalkSpeed(1);
      cancelAnimationFrame(this.pointerFrame!);
      this.pointerFrame = undefined;
    };
    document.addEventListener('pointerleave', forgetPointer);
    window.addEventListener('blur', forgetPointer);
  }
  private watchPointer() {
    if (!this.pointer || this.pointerFrame !== undefined || (this.state !== 'walking' && this.state !== 'perched')) return;
    this.pointerFrame = requestAnimationFrame(() => {
      this.pointerFrame = undefined;
      this.reactToPointer();
      // Recheck after landing; keep sampling only while the bird moves.
      // A blocked escape retains its normal retry deadline.
      if (this.state === 'walking') this.watchPointer();
    });
  }
  private reactToPointer() {
    if (!this.pointer || this.state === 'suspended' || this.state === 'flying') return;
    const { x, y } = this.pointer;
    const rect = this.element.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    const radius = this.definition.escapeRadius;
    if (distance <= radius.flight) {
      // Flight starts from the visible position, even midway through a step.
      if (this.state === 'walking') this.position = { ...this.position!, x: rect.left + scrollX, y: rect.top + scrollY };
      this.flight({ x: x + scrollX, y: y + scrollY });
      return;
    }
    // One gait, continuously scaled from a cautious half-speed walk to 2×.
    const proximity = Math.max(0, Math.min(1, (radius.walk - distance) / (radius.walk - radius.flight)));
    const speed = distance <= radius.walk ? .5 + 1.5 * proximity : 1;
    if (this.state === 'walking') this.setWalkSpeed(speed);
    else if (distance <= radius.walk) this.walk(x + scrollX, speed);
  }
  private setWalkSpeed(speed: number) {
    if (this.state === 'walking') this.animations.forEach(animation => {
      if (animation.playbackRate !== speed) animation.updatePlaybackRate(speed);
    });
  }

  get definition(): BirdDefinition {
    const size = this.element.offsetWidth;
    return { ...this.baseDefinition, size, feet: this.baseDefinition.feet * size / this.baseDefinition.size };
  }
  private render(state: MovementState) {
    this.state = state;
    this.element.dataset.state = state;
    this.element.style.visibility = state === 'suspended' ? 'hidden' : 'visible';
    this.watchPointer();
  }
  private after(delay: number) {
    return performance.now() + Math.random() * delay;
  }
  private cancelAction() {
    this.generation++;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.pointerFrame!);
    this.pointerFrame = undefined;
    this.animations.forEach(a => a.cancel());
    this.animations = [];
    delete this.element.dataset.idle;
  }
  suspend() {
    this.cancelAction();
    this.deadlines = { idle: Infinity, walk: Infinity, flight: Infinity };
    this.reservation = undefined;
    this.render('suspended');
  }
  reconcile() {
    if (this.state === 'suspended' || this.state === 'perched') this.settle();
  }
  private settle(arrived = false) {
    const current = this.scene.current(this);
    if (current && (!arrived || Math.hypot(current.x - this.position!.x, current.y - this.position!.y) <= .5)) {
      const wasPerched = this.state === 'perched';
      this.position = current;
      this.reservation = { from: current, to: current, definition: this.definition };
      this.element.style.transform = transform(current);
      this.render('perched');
      if (!wasPerched) {
        this.deadlines.idle = this.after(this.definition.idleDelay);
        this.deadlines.walk = this.after(this.definition.walkDelay);
        if (!Number.isFinite(this.deadlines.flight)) this.deadlines.flight = this.after(this.definition.flightDelay);
      }
      this.wake();
    } else {
      const targets = current ? [current] : this.scene.places(this);
      if (targets.length) this.move(choose(targets), 'flying');
      else this.suspend();
    }
  }
  private wake() {
    clearTimeout(this.timer);
    if (this.state !== 'perched' || this.animations.length) return;
    this.timer = window.setTimeout(() => this.tick(), Math.max(0, Math.min(...Object.values(this.deadlines)) - performance.now()));
  }
  private tick() {
    if (this.state !== 'perched' || this.animations.length) return;
    const now = performance.now();
    if (this.deadlines.flight <= now) this.flight();
    else if (this.deadlines.walk <= now) this.walk();
    else if (this.deadlines.idle <= now) this.idle();
    else this.wake();
  }
  private async idle() {
    this.lastIdle = (this.lastIdle + 1 + Math.floor(Math.random() * 2)) % this.definition.actions.length;
    const name = this.definition.actions[this.lastIdle];
    this.element.dataset.idle = name;
    if (await this.run(gesture(name))) {
      this.cancelAction();
      this.deadlines.idle = this.after(this.definition.idleDelay);
      this.wake();
    }
  }
  private walk(awayFrom?: number, speed = 1) {
    const direction = awayFrom === undefined ? 0 : Math.sign(this.position!.x + this.definition.size / 2 - awayFrom);
    const targets = this.scene.places(this, this.position).filter(p => p.element === this.position!.element && Math.abs(p.x - this.position!.x) > this.definition.size * .3 &&
      (!direction || (p.x - this.position!.x) * direction > 0));
    if (targets.length) {
      const target = choose(targets);
      // A few steps between inspections, rather than marching an entire edge.
      // The full candidate corridor was checked; its shorter prefix is safe.
      const dx = target.x - this.position!.x;
      const distance = Math.min(Math.abs(dx), this.definition.size * (.6 + Math.random() * .6));
      this.move({ ...target, x: this.position!.x + Math.sign(dx) * distance }, 'walking', speed);
    }
    else { this.deadlines.walk = this.after(this.definition.walkDelay); this.wake(); }
  }
  private flight(awayFrom?: { x: number; y: number }) {
    const targets = this.scene.places(this).filter(p => Math.hypot(p.x - this.position!.x, p.y - this.position!.y) > 60);
    const from = this.position!;
    const dx = awayFrom ? from.x + this.definition.size / 2 - awayFrom.x : 0;
    const dy = awayFrom ? from.y + this.definition.size / 2 - awayFrom.y : 0;
    const away = targets.filter(p => (p.x - from.x) * dx + (p.y - from.y) * dy >
      .1 * Math.hypot(p.x - from.x, p.y - from.y) * Math.hypot(dx, dy));
    const preferred = away.length ? away : targets;
    const other = preferred.filter(p => p.element !== from.element);
    if (preferred.length) this.move(choose(other.length ? other : preferred), 'flying');
    else { this.deadlines.flight = this.after(this.definition.flightDelay); this.wake(); }
  }
  private async run(action: Action, opening?: Map<string, string>) {
    const start = document.timeline.currentTime;
    this.animations = action.map(({ part, keyframes, timing }) => {
      const target = part ? this.element.querySelector<SVGElement>(`.pigeon-${part}`)! : this.element;
      const initial = opening?.get(part);
      const animation = target.animate(initial ? [{ ...keyframes[0], transform: initial }, ...keyframes.slice(1)] : keyframes, { ...timing, fill: 'forwards' });
      if (typeof start === 'number' && animation.playState !== 'paused') animation.startTime = start;
      return animation;
    });
    const generation = this.generation;
    try {
      // Movement's root animation controls completion; part cycles have the same total duration.
      await (action[0].part === '' ? this.animations[0].finished : Promise.all(this.animations.map(a => a.finished)));
      return generation === this.generation;
    } catch { return false; }
  }
  private async move(destination: Point, kind: 'walking' | 'flying', speed = 1) {
    if (!this.position) this.facing = Math.random() < .5 ? 'right' : 'left';
    const from = this.position ?? {
      ...destination,
      x: this.facing === 'right' ? scrollX - this.definition.size - 32 : scrollX + document.documentElement.clientWidth + 32,
      y: scrollY + Math.max(24, Math.min(innerHeight - this.definition.size - 24,
        destination.y - scrollY + (destination.y - scrollY < innerHeight / 2 ? 220 : -220))),
    };
    const action = movement(from, destination, kind, this.definition.size);
    const opening = this.animations.length ?
      new Map(action.filter(a => a.part).map(a => [a.part, getComputedStyle(this.element.querySelector(`.pigeon-${a.part}`)!).transform])) : undefined;
    this.cancelAction();
    if (kind === 'flying') this.deadlines.flight = Infinity;
    const dx = destination.x - from.x;
    if (Math.abs(dx) > .5) this.facing = dx > 0 ? 'right' : 'left';
    this.element.querySelector<SVGElement>('svg')!.style.transform = this.facing === 'left' ? 'scaleX(-1)' : '';
    this.reservation = { from: kind === 'flying' ? destination : from, to: destination, definition: this.definition };
    this.element.style.transform = transform(from);
    this.render(kind);
    const completion = this.run(action, opening);
    this.setWalkSpeed(speed);
    if (await completion) {
      // Commit the held endpoint before removing its animation, then validate the landing.
      this.position = destination;
      this.element.style.transform = transform(destination);
      this.cancelAction();
      this.settle(true);
    }
  }
}
