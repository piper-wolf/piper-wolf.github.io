export type Gesture = 'look' | 'peck' | 'stretch';
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
export const walkDuration = (distance: number) => Math.max(1800, Math.min(5000, distance * 28));
export const flightDuration = (distance: number) => Math.min(2600, 1600 + distance * 1.2);
export function gesture(bird: HTMLElement, name: Gesture) {
  const action = catalog[name];
  return action.parts.map(([part, keyframes]) => bird.querySelector(`.pigeon-${part}`)!.animate(keyframes, { duration: action.duration, easing: 'ease-in-out' }));
}
export function locomotion(bird: HTMLElement, kind: 'walking' | 'flying', duration: number) {
  const parts: Part[] = kind === 'walking' ? [
    ['foot-back', frames(['translateX(2px)', 'translate(-2px,-2px)', 'translateX(2px)'])],
    ['foot-front', frames(['translate(-2px,-2px)', 'translateX(2px)', 'translate(-2px,-2px)'])],
    ['body', frames(['none', 'translateY(-1px)', 'none'])],
    ['head', frames(['translateX(-1px)', 'translateX(2px)', 'translateX(-1px)'])],
  ] : [
    ['flight-wing', [0, .06, .12, .18, .24, .30, .36, .44, .62, .70, .76, .83, .90, .96, 1].map((offset, i) => ({ offset, transform: i === 7 || i === 8 ? 'rotate(-25deg) scaleY(.9)' : i % 2 ? 'rotate(-105deg) scaleY(.7)' : 'rotate(10deg)' }))],
    ['body', frames(['none', 'rotate(-8deg)', 'rotate(-8deg)', 'rotate(5deg)', 'none'])],
    ['feet', frames(['none', 'translateY(-3px) scaleY(.55)', 'translateY(-3px) scaleY(.55)', 'none'])],
    ['tail', frames(['rotate(8deg)', 'rotate(8deg)'])],
  ];
  return parts.map(([part, keyframes]) => bird.querySelector(`.pigeon-${part}`)!.animate(keyframes,
    kind === 'walking' ? { duration: part === 'body' ? 180 : 360, iterations: Infinity } : { duration, easing: 'ease-in-out' }));
}
// Every finite action shares this cancellation-safe completion contract.
export async function completed(animations: Animation[]) {
  try { await Promise.all(animations.map(animation => animation.finished)); return true; }
  catch { return false; }
}
