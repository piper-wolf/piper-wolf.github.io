export type Gesture = 'look' | 'peck' | 'stretch';
export type Action = { part: string; keyframes: Keyframe[]; timing: KeyframeAnimationOptions }[];
type Part = [string, Keyframe[]];
const frames = (transforms: string[]): Keyframe[] => transforms.map(transform => ({ transform }));
const catalog: Record<Exclude<Gesture, 'peck'>, { duration: number; parts: Part[] }> = {
  look: { duration: 1500, parts: [['head', frames(['none', 'translateY(-1px) rotate(-9deg)', 'rotate(8deg)', 'none'])]] },
  stretch: { duration: 1800, parts: [['wing', frames(['none', 'rotate(-38deg) scaleY(.8)', 'rotate(-20deg) scaleY(.9)', 'rotate(-38deg) scaleY(.8)', 'none'])]] },
};
export const transform = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;
export function gesture(name: Gesture): Action {
  if (name === 'peck') return peck();
  const action = catalog[name];
  return action.parts.map(([part, keyframes]) => ({ part, keyframes, timing: { duration: action.duration, easing: 'ease-in-out' } }));
}
// Theunissen, Reid & Troje (2017), https://doi.org/10.1242/jeb.147850:
// two head stops help aim a peck before its final approach. Ostheim et al.
// (2020), https://doi.org/10.1242/jeb.223313: serial feeding was ~3 pecks/s;
// eyelids narrow rather than fully close during contact. Their feeding bouts
// were much longer (50–200 pecks). Our 2–5-peck snippets and upright pauses
// are a decorative foraging choice, not a measured natural bout distribution.
function peck(): Action {
  const count = 2 + Math.floor(Math.random() * 4);
  const period = 1000 / (2.6 + Math.random() * .6);
  const lead = 240, recovery = 360;
  const duration = lead + count * period + recovery;
  const body: Keyframe[] = [{ offset: 0, transform: 'none' }, { offset: lead / duration, transform: 'rotate(18deg)' }];
  const head: Keyframe[] = [{ offset: 0, transform: 'none' }];
  const eye: Keyframe[] = [{ offset: 0, transform: 'none' }];
  const neck: Keyframe[] = [{ offset: 0, transform: 'none' }];
  // The body leans about the feet; neck extension and head rotation together
  // put the beak tip near SVG y=58 (the perch), without moving the feet.
  for (let i = 0; i < count; i++) {
    for (const [phase, pose, squint] of [
      [0, 'translate(0px, 4px) rotate(12deg)', 'none'],
      [.18, 'translate(0px, 4px) rotate(12deg)', 'none'],
      [.32, 'translate(-1px, 9px) rotate(35deg)', 'none'],
      [.48, 'translate(-1px, 9px) rotate(35deg)', 'none'],
      [.62, 'translate(-2px, 14px) rotate(55deg)', 'scaleY(.35)'],
      [.68, 'translate(-2px, 14px) rotate(55deg)', 'scaleY(.35)'],
      [.9, 'translate(0px, 4px) rotate(12deg)', 'none'],
      [1, 'translate(0px, 4px) rotate(12deg)', 'none'],
    ] as const) {
      const offset = (lead + (i + phase) * period) / duration;
      head.push({ offset, transform: pose });
      eye.push({ offset, transform: squint });
      // Tuck the upright neck silhouette as the head reaches down; retain
      // an overlapping connection rather than leaving a spike above the head.
      neck.push({ offset, transform: phase >= .62 && phase <= .68 ? 'rotate(45deg) scaleY(.3)' :
        phase >= .32 && phase <= .48 ? 'rotate(30deg) scaleY(.65)' : 'rotate(8deg) scaleY(.9)' });
    }
  }
  body.push({ offset: (lead + count * period) / duration, transform: 'rotate(18deg)' }, { offset: 1, transform: 'none' });
  head.push({ offset: 1, transform: 'none' });
  eye.push({ offset: 1, transform: 'none' });
  neck.push({ offset: 1, transform: 'none' });
  const parts: Part[] = [['body', body], ['head', head], ['eye', eye], ['neck', neck]];
  return parts.map(([part, keyframes]) => ({
    part, keyframes, timing: { duration, easing: 'linear' },
  }));
}

// Troje & Frost (2000), https://doi.org/10.1242/jeb.203.5.935:
// head bobs synchronize with footfalls (~3–8Hz), with a world-stable hold
// followed by a fast forward thrust. Use a leisurely 3.6–4.8 steps/s.
// The stride length and stance fraction are SVG-scale choices; deriving
// duration from strides keeps long walks from becoming fast sliding feet.
function walking(from: { x: number; y: number }, to: { x: number; y: number }, size: number): Action {
  const distance = Math.abs(to.x - from.x) * 64 / size;
  const strides = Math.max(1, Math.round(distance / 16));
  const stride = distance / strides;
  const cadence = 3.6 + Math.random() * 1.2;
  const duration = strides * 2000 / cadence;
  const stance = .62, hold = .65;
  const samples = Math.ceil(duration / 1000 * 120);
  const parts: Part[] = ['foot-back', 'foot-front', 'body', 'head'].map(part => [part, []]);
  for (let i = 0; i <= samples; i++) {
    const offset = i / samples;
    const cycle = offset * strides;
    const bob = -.8 * (1 - Math.cos(cycle * Math.PI * 4));
    for (let foot = 0; foot < 2; foot++) {
      const phase = (cycle + stance / 2 + foot * .5) % 1;
      const swing = (phase - stance) / (1 - stance);
      const x = phase < stance ? stride * (stance / 2 - phase) : stride * stance * (swing - .5);
      const lift = phase < stance ? 0 : -3 * Math.sin(Math.PI * swing);
      const fade = Math.min(1, offset * duration / 100, (1 - offset) * duration / 100);
      parts[foot][1].push({ offset, transform: i === samples ? 'none' : `translate(${x}px, ${lift * fade}px)` });
    }
    // During hold, local head velocity cancels forward translation. Undo the
    // body's small vertical bob too; thrust happens in the remaining 35%.
    const phase = (cycle * 2 + hold / 2) % 1;
    const advance = stride / 2;
    const x = phase < hold ? advance * (hold / 2 - phase) : advance * hold * ((phase - hold) / (1 - hold) - .5);
    parts[2][1].push({ offset, transform: i === samples ? 'none' : `translateY(${bob}px)` });
    parts[3][1].push({ offset, transform: i === samples ? 'none' : `translate(${x}px, ${-bob}px)` });
  }
  return [{ part: '', keyframes: frames([transform(from), transform(to)]), timing: { duration, easing: 'linear' } },
    ...parts.map(([part, keyframes]) => ({ part, keyframes, timing: { duration, easing: 'linear' } }))];
}

// Research: Angela M. Berg & Andrew A. Biewener (2010),
// "Wing and body kinematics of takeoff and landing flight in the pigeon
// (Columba livia)", Journal of Experimental Biology 213:1651–1658.
// https://doi.org/10.1242/jeb.038109
// Seven pigeons flew between perches 6–8m apart; these are short-flight
// observations, adapted below for a small side-view SVG.
export function movement(from: { x: number; y: number }, to: { x: number; y: number }, kind: 'walking' | 'flying', size = 40): Action {
  if (kind === 'walking') return walking(from, to, size);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const dy = to.y - from.y;
  const rise = Math.min(110, 40 + distance * .12);
  // Measure the swoop in pixels, then time it by distance travelled rather
  // than applying a trip-wide easing curve (which dilutes long-trip acceleration).
  const path = Array.from({ length: 97 }, (_, index) => {
    const t = (index / 96) ** 2;
    const vertical = (Math.log1p(63 * t) - t * 63 / 64) / (Math.log(64) - 63 / 64);
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + dy * vertical - (Math.abs(dy) < 1 ? Math.sin(Math.PI * vertical) * rise : 0),
    };
  });
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const length = lengths.at(-1)!;
  // Fig. 2: acceleration peaked on takeoff wingbeat 2 (~9.1m/s²);
  // braking intensified before contact (~−8.5m/s² on the final wingbeat).
  // Our constant acceleration/braking phases simplify that varying force.
  // Pixel values, the cruise cap, climb penalty, and swoop are visual tuning,
  // not measured accelerations, speeds, or reconstructed flight trajectories.
  const acceleration = 1800, braking = 1500; // Screen pixels/s², independent of destination.
  const verticalShare = Math.abs(dy) / (distance || 1);
  const cruise = 650 * (1 - verticalShare * (dy < 0 ? .5 : .25));
  const speed = Math.min(cruise, Math.sqrt(2 * length / (1 / acceleration + 1 / braking)));
  const launch = speed / acceleration, landing = speed / braking;
  const coast = speed ? Math.max(0, (length - speed * speed / (2 * acceleration) - speed * speed / (2 * braking)) / speed) : 0;
  const seconds = launch + coast + landing;
  const duration = Math.max(1, seconds * 1000);
  const easing = 'linear';
  // Sample elapsed time densely, then interpolate the measured path. This
  // keeps the first and last strokes of motion smooth even on long journeys.
  let segment = 1;
  const samples = Math.max(96, Math.ceil(seconds * 120));
  const keyframes = Array.from({ length: samples + 1 }, (_, index) => {
    const offset = index / samples;
    const time = offset * seconds;
    const travelled = time < launch ? acceleration * time * time / 2 :
      time > launch + coast ? length - braking * (seconds - time) ** 2 / 2 :
      speed * speed / (2 * acceleration) + speed * (time - launch);
    while (segment < path.length - 1 && lengths[segment] < travelled) segment++;
    const fraction = (travelled - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1] || 1);
    const start = path[segment - 1], end = path[segment];
    return { offset, transform: transform({
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction,
    }) };
  });
  // Fig. 4: wingbeats declined from 8.88 to 7.68Hz over four takeoff
  // strokes, versus 6.57Hz mid-flight and a 7.78Hz pre-landing peak.
  // Takeoff also had broader, faster downstrokes. Effort approximates these
  // trends; the .45s taper, SVG angles, and stroke split are visual choices.
  // Keep wingbeats on elapsed time so longer journeys add strokes.
  const wing: Keyframe[] = [{ offset: 0, transform: 'none' }];
  // Stowers, Matloff & Lentink (2017), https://doi.org/10.1098/rsif.2017.0224:
  // elbow/wrist coupling changes span, sweep, and wing area. Articulate the
  // outer feather fan at the wrist rather than flattening the entire wing.
  // Crandell & Tobalske (2011), https://doi.org/10.1242/jeb.051342:
  // pigeons use a twisted, tip-reversal upstroke in slow flight. Preserve more
  // span during takeoff/landing; suggest a narrower recovery stroke in cruise.
  // Rotation and foreshortening below are 2D visual cues, not measured joints.
  const hand: Keyframe[] = [{ offset: 0, transform: 'none' }];
  let time = 0;
  while (time < seconds) {
    const takeoff = Math.max(0, 1 - time / .45);
    const approach = Math.max(0, Math.min(1, (time - seconds + landing) / (landing || 1)));
    const effort = Math.max(takeoff, approach * .8);
    const period = 1 / (6.6 + 2.3 * effort);
    for (const [phase, angle] of [[.45, -75 - 35 * effort], [1, 5 + 15 * effort]]) {
      const at = time + phase * period;
      if (at < seconds) wing.push({ offset: at / seconds, transform: `rotate(${angle}deg)` });
    }
    for (const [phase, pose] of [
      [.45, 'none'], // Spread primaries on the power stroke.
      [.72, `rotate(${45 - 20 * effort}deg) scale(${.7 + .25 * effort}, ${.8 - .35 * effort})`],
      [1, 'none'], // Reopen before the next downstroke.
    ] as const) {
      const at = time + phase * period;
      if (at < seconds) hand.push({ offset: at / seconds, transform: pose });
    }
    time += period;
  }
  wing.push({ offset: 1, transform: 'none' });
  hand.push({ offset: 1, transform: 'none' });
  const launchOffset = seconds ? launch / seconds : 0;
  const brakeOffset = seconds ? (launch + coast) / seconds : 1;
  const parts: Part[] = [
    ['flight-wing', wing],
    ['hand-wing', hand],
    // Figs. 3/5: body, tail, and wing planes become more upright on
    // approach, increasing drag and redirecting force for braking.
    // These modest SVG rotations suggest that change, not the measured angles.
    ['body', [
      { offset: 0, transform: 'none' },
      { offset: launchOffset * .5, transform: 'rotate(-14deg)' },
      { offset: launchOffset, transform: 'rotate(8deg)' },
      { offset: brakeOffset, transform: 'rotate(8deg)' },
      { offset: brakeOffset + (1 - brakeOffset) * .65, transform: 'rotate(-20deg)' },
      { offset: 1, transform: 'none' },
    ]],
    // Hover can interrupt a peck. Recover its head/neck pose promptly,
    // while preserving the opening transform to avoid a visible snap.
    ...['head', 'neck'].map(part => [part, [0, Math.min(1, .12 / (seconds || 1)), 1].map(offset => ({ offset, transform: 'none' }))] as Part),
    ['feet', [
      { offset: 0, transform: 'none' },
      { offset: launchOffset, transform: 'translateY(-3px) scaleY(.55)' },
      { offset: brakeOffset, transform: 'translateY(-3px) scaleY(.55)' },
      { offset: 1, transform: 'none' },
    ]],
    // Fig. 3: tails were somewhat wider in landing than takeoff;
    // within-phase spread changes were not significant. Scaling suggests a fan.
    ['tail', [
      { offset: 0, transform: 'none' },
      { offset: launchOffset, transform: 'rotate(8deg)' },
      { offset: brakeOffset, transform: 'rotate(8deg)' },
      { offset: brakeOffset + (1 - brakeOffset) * .65, transform: 'rotate(-12deg) scaleY(1.25)' },
      { offset: 1, transform: 'none' },
    ]],
  ];
  return [{ part: '', keyframes, timing: { duration, easing } },
    ...parts.map(([part, keyframes]) => ({ part, keyframes, timing: { duration, easing } }))];
}
