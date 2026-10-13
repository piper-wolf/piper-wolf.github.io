import { perchMargin, type BirdDefinition } from './definition';
export interface Point { x: number; y: number; element: HTMLElement }
interface Rect { left: number; right: number; top: number; bottom: number }
interface Edge { element: HTMLElement; left: number; right: number; line: number }
export interface Reservation { from: Point; to: Point; definition: BirdDefinition }
const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
export class Geometry {
  private edges: Edge[] = [];
  private blockers: Rect[] = [];
  measure() {
    this.blockers = [...document.querySelectorAll('header a, main a, main p, main h1, main h2, main h3, main time, main figcaption, main img, button, input, select, textarea, footer > *')]
      .filter(el => !el.querySelector('img')).map(el => el.getBoundingClientRect())
      .filter(r => r.width && r.height && r.bottom > 0 && r.top < innerHeight)
      .map(r => ({ left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY }));
    this.edges = [...document.querySelectorAll<HTMLElement>('[data-pigeon-landing]')].map(element => {
      const rect = element.getBoundingClientRect();
      const header = element.dataset.pigeonLanding === 'header';
      // Consider the whole divider; blockers below trim any unsafe link space.
      const left = Math.max(perchMargin, rect.left + perchMargin);
      const right = Math.min(document.documentElement.clientWidth - perchMargin, rect.right - perchMargin);
      return { element, left: left + scrollX, right: right + scrollX, line: (header ? rect.bottom - 1 : rect.top) + scrollY };
    });
  }
  private bounds(from: Point, to: Point, definition: BirdDefinition): Rect {
    const c = definition.clearance;
    // Photo tops are valid perches even when mobile removes the frame border.
    const below = to.element.dataset.pigeonLanding === 'photo' ? 0 : c.below;
    return { left: Math.min(from.x, to.x) - c.left, right: Math.max(from.x, to.x) + definition.size + c.right,
      top: Math.min(from.y, to.y) - c.above, bottom: Math.max(from.y, to.y) + definition.feet + below };
  }
  current(point: Point, definition: BirdDefinition, reservations: Reservation[]): Point | undefined {
    const edge = this.edges.find(edge => edge.element === point.element);
    if (!edge) return;
    const current = { ...point, y: edge.line - definition.feet };
    if (current.y - scrollY < 8 || edge.line - scrollY + 8 > innerHeight ||
        point.x < edge.left + perchMargin || point.x + definition.size > edge.right - perchMargin) return;
    const blockers = [...this.blockers, ...reservations.map(r => this.bounds(r.from, r.to, r.definition))];
    if (!blockers.some(b => overlaps(this.bounds(current, current, definition), b))) return current;
  }
  places(definition: BirdDefinition, reservations: Reservation[], walkFrom?: Point): Point[] {
    const blockers = [...this.blockers, ...reservations.map(r => this.bounds(r.from, r.to, r.definition))];
    const result: Point[] = [];
    for (const edge of this.edges) {
      const y = edge.line - definition.feet;
      if (edge.right - edge.left < definition.size + 2 * perchMargin || y - scrollY < 8 || edge.line - scrollY + 8 > innerHeight) continue;
      const below = edge.element.dataset.pigeonLanding === 'photo' ? 0 : definition.clearance.below;
      // Subtract obstacles into safe horizontal intervals for the bird's origin.
      let intervals = [[edge.left + perchMargin, edge.right - definition.size - perchMargin]];
      for (const b of blockers) {
        if (b.bottom <= y - definition.clearance.above || b.top >= edge.line + below) continue;
        const low = b.left - definition.size - definition.clearance.right;
        const high = b.right + definition.clearance.left;
        intervals = intervals.flatMap(([l, r]) => high <= l || low >= r ? [[l, r]] : [[l, Math.min(r, low)], [Math.max(l, high), r]].filter(([a, z]) => z > a));
      }
      for (const fraction of [.2, .5, .8]) {
        // Preserve the original preferred samples, then use interval space if needed.
        const preferred = edge.left + perchMargin + (edge.right - edge.left - definition.size - 2 * perchMargin) * fraction;
        const interval = intervals.find(([l, r]) => preferred >= l && preferred <= r) ?? intervals[Math.floor(fraction * intervals.length)];
        if (!interval) continue;
        const x = Math.max(interval[0], Math.min(interval[1], preferred));
        const point = { x, y, element: edge.element };
        const from = walkFrom?.element === edge.element ? walkFrom : point;
        if (!blockers.some(b => overlaps(this.bounds(from, point, definition), b))) result.push(point);
      }
      if (walkFrom?.element === edge.element) {
        // A bird can be outside the three preferred samples and still have
        // room to retreat. Include the ends of its current safe interval.
        const interval = intervals.find(([left, right]) => walkFrom.x >= left && walkFrom.x <= right);
        for (const x of interval ?? []) {
          if (result.some(p => p.element === edge.element && Math.abs(p.x - walkFrom.x) > definition.size * .3 &&
            (p.x - walkFrom.x) * (x - walkFrom.x) > 0)) continue;
          const point = { x, y, element: edge.element };
          if (!blockers.some(b => overlaps(this.bounds(walkFrom, point, definition), b))) result.push(point);
        }
      }
    }
    return result;
  }
}
