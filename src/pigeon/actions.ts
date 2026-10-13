export type Gesture = 'look' | 'peck' | 'stretch';
export type Action = { part: string; keyframes: Keyframe[]; timing: KeyframeAnimationOptions }[];
type Part = [string, Keyframe[]];
const frames = (transforms: string[]): Keyframe[] => transforms.map(transform => ({ transform }));
const catalog: Record<Gesture, { duration: number; parts: Part[] }> = {
  look: { duration: 1500, parts: [['head', frames(['none', 'translateY(-1px) rotate(-9deg)', 'rotate(8deg)', 'none'])]] },
  peck: { duration: 1200, parts: [
    ['body', frames(['none', 'translateY(4px) rotate(22deg)', 'translateY(4px) rotate(22deg)', 'none'])],
    ['head', frames(['none', 'translateY(10px) rotate(45deg)', 'translateY(12px) rotate(48deg)', 'none'])],
  ] },
  stretch: { duration: 1800, parts: [['wing', frames(['none', 'rotate(-38deg) scaleY(.8)', 'rotate(-20deg) scaleY(.9)', 'rotate(-38deg) scaleY(.8)', 'none'])]] },
};
export const transform = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;
export function gesture(name: Gesture): Action {
  const action = catalog[name];
  return action.parts.map(([part, keyframes]) => ({ part, keyframes, timing: { duration: action.duration, easing: 'ease-in-out' } }));
}
export function movement(from: { x: number; y: number }, to: { x: number; y: number }, kind: 'walking' | 'flying'): Action {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const horizontalTravel = Math.abs(to.x - from.x);
  const dy = to.y - from.y;
  const rise = Math.min(110, 40 + distance * .12);
  const verticalTravel = Math.abs(dy) + (Math.abs(dy) < 1 ? 2 * rise : 0);
  // Horizontal cruise and vertical effort happen together. Climbing takes
  // longer than descending; takeoff and landing get their own time allowance.
  const duration = kind === 'walking' ? Math.max(1800, Math.min(5000, distance * 28)) :
    1200 + Math.max(horizontalTravel / .65, verticalTravel / (dy < -1 ? .3 : dy > 1 ? .45 : .35));
  const verticalShare = verticalTravel / (horizontalTravel + verticalTravel || 1);
  const easing = kind === 'walking' ? 'linear' : `cubic-bezier(${.2 + .2 * verticalShare}, 0, .65, 1)`;
  const keyframes = kind === 'walking' ? frames([transform(from), transform(to)]) :
    Array.from({ length: 49 }, (_, index) => {
      // Sample more densely near the steep start. Subtract the endpoint slope
      // from the logarithm so vertical travel settles to zero at the perch.
      const t = (index / 48) ** 2;
      const vertical = (Math.log1p(63 * t) - t * 63 / 64) / (Math.log(64) - 63 / 64);
      return { offset: t, transform: transform({
        x: from.x + (to.x - from.x) * t,
        y: from.y + dy * vertical - (Math.abs(dy) < 1 ? Math.sin(Math.PI * vertical) * rise : 0),
      }) };
    });
  const parts: Part[] = kind === 'walking' ? [
    ['foot-back', frames(['none', 'translateX(2px)', 'translate(-2px,-2px)', 'none'])],
    ['foot-front', frames(['none', 'translate(-2px,-2px)', 'translateX(2px)', 'none'])],
    ['body', frames(['none', 'translateY(-1px)', 'none'])],
    ['head', frames(['none', 'translateX(-1px)', 'translateX(2px)', 'none'])],
  ] : [
    ['flight-wing', [0, .06, .12, .18, .24, .30, .36, .44, .62, .70, .76, .83, .90, .96, 1].map((offset, i) => ({ offset, transform: i === 0 || i === 14 ? 'none' : i === 7 || i === 8 ? 'rotate(-25deg) scaleY(.9)' : i % 2 ? 'rotate(-105deg) scaleY(.7)' : 'rotate(10deg)' }))],
    ['body', frames(['none', 'rotate(-8deg)', 'rotate(-8deg)', 'rotate(5deg)', 'none'])],
    ['head', [0, .1, 1].map(offset => ({ offset, transform: 'none' }))],
    ['feet', frames(['none', 'translateY(-3px) scaleY(.55)', 'translateY(-3px) scaleY(.55)', 'none'])],
    ['tail', frames(['none', 'rotate(8deg)', 'rotate(8deg)', 'none'])],
  ];
  return [{ part: '', keyframes, timing: { duration, easing } }, ...parts.map(([part, keyframes]) => {
    const iterations = kind === 'walking' ? Math.max(1, Math.round(duration / 360)) * (part === 'body' ? 2 : 1) : 1;
    return { part, keyframes, timing: { duration: duration / iterations, iterations, easing } };
  })];
}
