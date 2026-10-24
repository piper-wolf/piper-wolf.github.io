import type { BirdDefinition } from './definition';
import { gesture, movement, transform, type Action } from './actions';
import type { Point, Reservation } from './geometry';
export type MovementState = 'suspended' | 'perched' | 'walking' | 'flying';
export interface BirdScene {
  places(bird: Bird, walkFrom?: Point): Point[];
  current(bird: Bird): Point | undefined;
  watchPointer(): void;
  departed(bird: Bird): void;
  settle(): void;
}
const choose = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
export class Bird {
  state: MovementState = 'suspended';
  position?: Point;
  reservation?: Reservation;
  private animations: Animation[] = [];
  private timer?: number;
  private offscreenTimer?: number;
  private offscreenAt?: number;
  private sleeping = false;
  private navigationPoint?: { x: number; y: number };
  private opening?: Map<string, string>;
  private leaving = false;
  definition: BirdDefinition;
  private blockedEscape?: { kind: 'walk' | 'flight'; direction: number };
  private generation = 0;
  private lastIdle = -1;
  private facing: 'left' | 'right' = 'right';
  private deadlines = { idle: Infinity, walk: Infinity, flight: Infinity, departure: Infinity };
  constructor(readonly element: HTMLElement, private baseDefinition: BirdDefinition, private scene: BirdScene) {
    this.definition = baseDefinition;
    this.measure();
    this.render('suspended');
  }
  reactToPointer({ x, y }: { x: number; y: number }, rect: DOMRect) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    const radius = this.baseDefinition.escapeRadius;
    const kind = distance <= radius.flight ? 'flight'
      : distance <= radius.walk && this.state === 'perched' ? 'walk' : undefined;
    const proximity = Math.max(0, Math.min(1, (radius.walk - distance) / (radius.walk - radius.flight)));
    const speed = distance <= radius.walk ? .5 + 1.5 * proximity : 1;
    if (!kind) {
      const wasBlocked = !!this.blockedEscape;
      this.blockedEscape = undefined;
      this.setWalkSpeed(speed);
      if (wasBlocked) this.wake();
      return;
    }
    const awayX = rect.left + rect.width / 2 - x;
    const awayY = rect.top + rect.height / 2 - y;
    const direction = kind === 'walk' ? Math.sign(awayX)
      : Math.round((Math.atan2(awayY, awayX) + Math.PI) / (Math.PI / 4)) % 8;
    if (this.blockedEscape?.kind === kind && this.blockedEscape.direction === direction && this.deadlines[kind] > performance.now()) return;
    this.blockedEscape = undefined;
    const escaped = kind === 'flight' ? this.flight({ x: x + scrollX, y: y + scrollY },
      { ...this.position!, x: rect.left + scrollX, y: rect.top + scrollY }) : this.walk(x + scrollX, speed);
    if (!escaped) this.blockedEscape = { kind, direction };
  }
  forgetPointer() {
    this.blockedEscape = undefined;
    this.setWalkSpeed(1);
  }
  private setWalkSpeed(speed: number) {
    if (this.state === 'walking') this.animations.forEach(animation => {
      if (animation.playbackRate !== speed) animation.updatePlaybackRate(speed);
    });
  }

  measure() {
    const size = this.element.offsetWidth;
    this.definition = { ...this.baseDefinition, size, feet: this.baseDefinition.feet * size / this.baseDefinition.size };
    this.blockedEscape = undefined;
  }
  private render(state: MovementState) {
    this.state = state;
    this.element.dataset.state = state;
    this.element.style.visibility = state === 'suspended' ? 'hidden' : 'visible';
    this.scene.watchPointer();
  }
  private after(delay: number) {
    return performance.now() + Math.random() * delay;
  }
  private cancelAction() {
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.offscreenTimer);
    this.offscreenTimer = undefined;
    this.offscreenAt = undefined;
    this.animations.forEach(a => a.cancel());
    this.animations = [];
    delete this.element.dataset.idle;
  }
  suspend() {
    this.cancelAction();
    this.deadlines = { idle: Infinity, walk: Infinity, flight: Infinity, departure: Infinity };
    this.reservation = undefined;
    this.blockedEscape = undefined;
    this.render('suspended');
  }
  sleep() {
    this.sleeping = true;
    clearTimeout(this.timer);
    clearTimeout(this.offscreenTimer);
    if (this.state === 'flying') return;
    if (this.state === 'walking') {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(this.element).transform);
      this.position = { ...this.position!, x: matrix.m41, y: matrix.m42 };
      this.reservation = { from: this.position, to: this.position, definition: this.definition };
      this.element.style.transform = transform(this.position);
      this.render('perched');
      this.deadlines.walk = this.after(this.baseDefinition.walkDelay);
    }
    if (this.animations.length) this.deadlines.idle = this.after(this.baseDefinition.idleDelay);
    const offscreenAt = this.offscreenAt;
    this.cancelAction();
    this.offscreenAt = offscreenAt;
  }
  resume(elapsed: number) {
    this.sleeping = false;
    for (const key of Object.keys(this.deadlines) as (keyof typeof this.deadlines)[]) this.deadlines[key] += elapsed;
    if (this.offscreenAt !== undefined) {
      this.offscreenAt += elapsed;
      this.waitOffscreen();
    }
  }
  prepareNavigation() {
    if (this.state === 'suspended') return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(this.element).transform);
    this.navigationPoint = { x: matrix.m41 - scrollX, y: matrix.m42 - scrollY };
    this.opening = this.pose();
    this.cancelAction();
    this.reservation = undefined;
  }
  private pose() {
    return new Map(this.animations.flatMap(animation => {
      const target = (animation.effect as KeyframeEffect).target;
      if (!target || target === this.element) return [];
      const part = [...target.classList].find(name => name.startsWith('pigeon-'))?.slice(7);
      return part ? [[part, getComputedStyle(target).transform] as const] : [];
    }));
  }
  reconcile() {
    if (this.sleeping) return;
    if (this.navigationPoint) {
      this.position = { ...this.position!, x: this.navigationPoint.x + scrollX, y: this.navigationPoint.y + scrollY };
      this.navigationPoint = undefined;
      if (this.leaving) this.depart();
      else {
        const targets = this.scene.places(this);
        const distant = targets.filter(point => Math.hypot(point.x - this.position!.x, point.y - this.position!.y) > 60);
        if (targets.length) this.move(choose(distant.length ? distant : targets), 'flying');
        else this.suspend();
      }
      return;
    }
    if (this.state === 'suspended' || this.state === 'perched') this.settle();
  }
  private settle(arrived = false, offscreenDelayElapsed = false) {
    const current = this.scene.current(this);
    if (current && (!arrived || Math.hypot(current.x - this.position!.x, current.y - this.position!.y) <= .5)) {
      clearTimeout(this.offscreenTimer);
      this.offscreenTimer = undefined;
      this.offscreenAt = undefined;
      const wasPerched = this.state === 'perched';
      this.position = current;
      this.reservation = { from: current, to: current, definition: this.definition };
      this.element.style.transform = transform(current);
      this.render('perched');
      if (!wasPerched) {
        this.deadlines.idle = this.after(this.baseDefinition.idleDelay);
        this.deadlines.walk = this.after(this.baseDefinition.walkDelay);
        if (!Number.isFinite(this.deadlines.flight)) this.deadlines.flight = this.after(this.baseDefinition.flightDelay);
        if (!Number.isFinite(this.deadlines.departure)) this.deadlines.departure = performance.now() + 240000 + Math.random() * 240000;
      }
      this.wake();
    } else {
      const rect = this.element.getBoundingClientRect();
      const outsideViewport = rect.top < 8 || rect.top + this.definition.feet + 8 > innerHeight;
      if (this.state === 'perched' && outsideViewport && !offscreenDelayElapsed) {
        if (this.offscreenTimer === undefined) {
          this.cancelAction();
          this.offscreenAt = this.after(2000);
          this.waitOffscreen();
        }
        return;
      }
      const targets = current ? [current] : this.scene.places(this);
      if (targets.length) this.move(choose(targets), 'flying');
      else this.suspend();
    }
  }
  private waitOffscreen() {
    this.offscreenTimer = window.setTimeout(() => {
      this.offscreenTimer = undefined;
      this.offscreenAt = undefined;
      this.settle(false, true);
    }, Math.max(0, this.offscreenAt! - performance.now()));
  }
  private wake() {
    clearTimeout(this.timer);
    if (this.sleeping || this.state !== 'perched' || this.animations.length) return;
    this.timer = window.setTimeout(() => this.tick(), Math.max(0, Math.min(...Object.values(this.deadlines)) - performance.now()));
  }
  private tick() {
    if (this.sleeping || this.state !== 'perched' || this.animations.length) return;
    const now = performance.now();
    if (this.deadlines.departure <= now) { this.depart(); return; }
    const due = this.deadlines.flight <= now ? 'flight' : this.deadlines.walk <= now ? 'walk' : undefined;
    if (due && this.blockedEscape?.kind === due) this.scene.watchPointer();
    else if (due === 'flight') this.flight();
    else if (due === 'walk') this.walk();
    else if (this.deadlines.idle <= now) this.idle();
    else this.wake();
  }
  private depart() {
    this.leaving = true;
    const from = this.position!;
    const left = from.x - scrollX < innerWidth / 2;
    this.move({ ...from, x: scrollX + (left ? -this.definition.size - 64 : innerWidth + 64),
      y: scrollY + Math.max(24, Math.min(innerHeight - this.definition.size - 24, from.y - scrollY - 160)) }, 'flying');
  }
  private async idle() {
    this.lastIdle = (this.lastIdle + 1 + Math.floor(Math.random() * 2)) % this.baseDefinition.actions.length;
    const name = this.baseDefinition.actions[this.lastIdle];
    this.element.dataset.idle = name;
    if (await this.run(gesture(name))) {
      this.cancelAction();
      this.deadlines.idle = this.after(this.baseDefinition.idleDelay);
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
      return true;
    }
    this.deadlines.walk = this.after(this.baseDefinition.walkDelay);
    this.wake();
    return false;
  }
  private flight(awayFrom?: { x: number; y: number }, from = this.position!) {
    const targets = this.scene.places(this).filter(p => Math.hypot(p.x - from.x, p.y - from.y) > 60);
    const dx = awayFrom ? from.x + this.definition.size / 2 - awayFrom.x : 0;
    const dy = awayFrom ? from.y + this.definition.size / 2 - awayFrom.y : 0;
    const away = targets.filter(p => (p.x - from.x) * dx + (p.y - from.y) * dy >
      .1 * Math.hypot(p.x - from.x, p.y - from.y) * Math.hypot(dx, dy));
    const preferred = away.length ? away : targets;
    const other = preferred.filter(p => p.element !== from.element);
    if (preferred.length) {
      this.position = from;
      this.move(choose(other.length ? other : preferred), 'flying');
      return true;
    }
    this.deadlines.flight = this.after(this.baseDefinition.flightDelay);
    this.wake();
    return false;
  }
  private async run(action: Action, opening?: Map<string, string>) {
    const start = document.timeline.currentTime;
    this.animations = action.map(({ part, keyframes, timing }) => {
      const target = part ? this.element.querySelector<SVGElement>(`.pigeon-${part}`)! : this.element;
      const initial = opening?.get(part);
      const animation = target.animate(initial ? [{ ...keyframes[0], transform: initial },
        ...keyframes.slice(1).filter(frame => frame.offset !== 0)] : keyframes, { ...timing, fill: 'forwards' });
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
    // Recover gesture-only parts (e.g. a stretched foot or preening wing) on
    // the movement's timeline too, so cancellation doesn't snap them upright.
    const poses = this.opening ?? this.pose();
    this.opening = undefined;
    for (const part of poses.keys()) {
      if (action.some(track => track.part === part)) continue;
      const duration = Number(action[0].timing.duration);
      action.push({ part, keyframes: [0, Math.min(1, 120 / duration), 1].map(offset => ({ offset, transform: 'none' })), timing: { duration, easing: 'linear' } });
    }
    const opening = poses.size ? new Map(action.filter(a => a.part).map(a => [a.part,
      poses.get(a.part) ?? getComputedStyle(this.element.querySelector(`.pigeon-${a.part}`)!).transform])) : undefined;
    this.cancelAction();
    this.blockedEscape = undefined;
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
      if (this.leaving) {
        this.suspend();
        this.scene.departed(this);
        if (this.sleeping) this.scene.settle();
        return;
      }
      this.settle(true);
      if (this.sleeping) this.scene.settle();
    }
  }
}
