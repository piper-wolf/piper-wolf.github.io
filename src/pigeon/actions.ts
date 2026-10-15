import { variation, type Variation } from './variation';

export type Action = { part: string; keyframes: Keyframe[]; timing: KeyframeAnimationOptions }[];
type Part = [string, Keyframe[]];
const frames = (transforms: string[]): Keyframe[] => transforms.map(transform => ({ transform }));
const clip = (duration: number, easing: string, parts: Part[]): Action =>
  parts.map(([part, keyframes]) => ({ part, keyframes, timing: { duration, easing } }));

// Each factory samples bounded, coordinated parameters once, then produces an
// ordinary finite action. No random transforms during playback or shared state.
const catalog = {
  // Kano et al. (2018): rapid head saccades separated by fixation.
  // https://doi.org/10.1242/jeb.183475
  // Angles, tilt direction and timing are illustrative, not measured 3D gaze.
  look(v: Variation): Action {
    const direction = v.integer(0, 1) ? -1 : 1;
    const first = `translateY(-1px) rotate(${direction * v.range(7, 12)}deg)`;
    const second = `rotate(${-direction * v.range(5, 10)}deg)`;
    return clip(v.range(1350, 1750), 'linear', [['head', [
      { offset: 0, transform: 'none' }, { offset: .18, transform: 'none' },
      { offset: .23, transform: first }, { offset: .57, transform: first },
      { offset: .62, transform: second }, { offset: .9, transform: second },
      { offset: .95, transform: 'none' }, { offset: 1, transform: 'none' },
    ]]]);
  },
  peck,
  // Goodwin: backward wing/leg stretch on the same side, with tail spread.
  // https://greatlakespigeonrescue.org/ethogram-of-the-pigeon
  // One reach parameter coordinates the parts; angles/timing are art choices.
  stretch(v: Variation): Action {
    const reach = v.range(.85, 1.12);
    const wing = (angle: number) => `rotate(${angle * reach}deg) scaleX(${1 + .15 * reach})`;
    const foot = (amount: number) => `translate(${-16 * reach * amount}px, ${-2 * reach * amount}px) rotate(${32 * reach * amount}deg) scaleY(${1 + .15 * reach * amount})`;
    return clip(v.range(1650, 2050), 'ease-in-out', [
      ['wing', frames(['none', wing(22), wing(26), wing(22), 'none'])],
      ['foot-front', frames(['none', foot(.8), foot(1), foot(.8), 'none'])],
      ['tail', frames(['none', `rotate(${-6 * reach}deg)`, `rotate(${-9 * reach}deg)`, `rotate(${-6 * reach}deg)`, 'none'])],
    ]);
  },
  // Waite et al. (2012): bill-directed plumage grooming.
  // https://darwin.biology.utah.edu/PDFs/113.pdf
  // Stroke depth, count and duration are stylized rather than measured bouts.
  preen(v: Variation): Action {
    const depth = v.range(-5, 5), strokes = v.integer(2, 3);
    const head = ['none'], neck = ['none'], wing = ['none'];
    for (let i = 0; i < strokes; i++) {
      head.push(`translate(-3px, -1px) rotate(${125 + depth}deg)`, `translate(-1px, -3px) rotate(${115 + depth}deg)`);
      neck.push('rotate(30deg) scaleY(.65)', 'rotate(25deg) scaleY(.7)');
      wing.push('rotate(8deg)', 'rotate(4deg)');
    }
    return clip(v.range(350, 420) * (strokes * 2 + 1), 'ease-in-out', [
      ['head', frames([...head, 'none'])], ['neck', frames([...neck, 'none'])], ['wing', frames([...wing, 'none'])],
    ]);
  },
  // Goodwin: raised feathers, wings held away, shake, then tail movement.
  // https://greatlakespigeonrescue.org/ethogram-of-the-pigeon
  // Shared vigor coordinates the puff and shake; amplitudes/timing are art.
  ruffle(v: Variation): Action {
    const vigor = v.range(.8, 1.2);
    return clip(v.range(950, 1300), 'ease-in-out', [
      ['body', frames(['none', `scale(${1 + .06 * vigor}, ${1 + .04 * vigor})`, `scale(${1 + .02 * vigor}, ${1 + .01 * vigor})`, `scale(${1 + .05 * vigor}, ${1 + .03 * vigor})`, 'none'])],
      ['wing', frames(['none', `rotate(${6 * vigor}deg)`, `rotate(${-3 * vigor}deg)`, `rotate(${4 * vigor}deg)`, 'none'])],
      ['tail', frames(['none', `rotate(${-8 * vigor}deg)`, `rotate(${6 * vigor}deg)`, `rotate(${-4 * vigor}deg)`, 'none'])],
    ]);
  },
} satisfies Record<string, (v: Variation) => Action>;
export type Gesture = keyof typeof catalog;
export const transform = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;
export function gesture(name: Gesture, random: () => number = Math.random): Action {
  return catalog[name](variation(random));
}

// Theunissen, Reid & Troje (2017), https://doi.org/10.1242/jeb.147850:
// initial F1 and lower F2 aiming stops. Ostheim et al. (2020),
// https://doi.org/10.1242/jeb.223313, Results / Experiment I: serial pecks
// return only to F2, approach ~80ms, contact ~20ms, withdrawal ~100ms.
// Horizontal paths/fixation locations varied more than vertical excursions;
// eyes squinted, never fully shut. Their bouts lasted 50–200 pecks at ~3Hz.
// Our 2–5-peck snippets, bounded timing jitter and SVG poses are art choices.
function peck(v: Variation): Action {
  const count = v.integer(2, 5);
  const lead = v.range(280, 400), recovery = v.range(380, 520);
  const body: Keyframe[] = [{ offset: 0, transform: 'none', easing: 'ease-in-out' }, { offset: lead * .25, transform: 'rotate(18deg)' }];
  const head: Keyframe[] = [{ offset: 0, transform: 'none' }, { offset: lead * .5, transform: 'none', easing: 'ease-in-out' }];
  const neck: Keyframe[] = [{ offset: 0, transform: 'none' }];
  const eye: Keyframe[] = [{ offset: 0, transform: 'none' }];
  const fixation = () => `translate(${v.range(-1.5, .5)}px, ${v.range(7, 9)}px) rotate(${v.range(28, 34)}deg)`;
  const tucked = 'rotate(24deg) scaleY(.7)';
  head.push({ offset: lead, transform: fixation() });
  neck.push({ offset: lead, transform: tucked });
  let time = lead;
  for (let i = 0; i < count; i++) {
    const period = 1000 / v.range(2.6, 3.2);
    const approach = v.range(74, 86), contact = 20, withdrawal = v.range(90, 110);
    const strike = time + period - withdrawal - contact;
    const aim = strike - approach, release = strike + contact;
    const angle = v.range(53, 57), x = v.range(-3.5, -.5);
    // Solve the beak tip (61,20), head pivot (42,25), body pivot (34,51)
    // and body lean (18deg) against perch y=58. Vary reach/angle without
    // varying depth into the perch. These anchors match PigeonVisitor.astro.
    const radians = angle * Math.PI / 180, lean = 18 * Math.PI / 180;
    const tipX = 42 + 19 * Math.cos(radians) + 5 * Math.sin(radians) + x;
    const tipY = 25 + 19 * Math.sin(radians) - 5 * Math.cos(radians);
    const y = 51 + (7 - Math.sin(lean) * (tipX - 34)) / Math.cos(lean) - tipY;
    const touch = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
    head.push(
      { offset: aim, transform: head.at(-1)!.transform, easing: 'cubic-bezier(.4, 0, .9, .55)' },
      { offset: strike, transform: touch }, { offset: release, transform: touch, easing: 'ease-out' },
      { offset: time + period, transform: fixation() },
    );
    neck.push(
      { offset: aim, transform: tucked, easing: 'cubic-bezier(.4, 0, .9, .55)' },
      { offset: strike, transform: 'rotate(45deg) scaleY(.3)' },
      { offset: release, transform: 'rotate(45deg) scaleY(.3)', easing: 'ease-out' },
      { offset: time + period, transform: tucked },
    );
    eye.push(
      { offset: strike - 28, transform: 'none' }, { offset: strike - 8, transform: 'scaleY(.35)' },
      { offset: release, transform: 'scaleY(.35)' }, { offset: release + 50, transform: 'none' },
    );
    time += period;
  }
  body.push({ offset: time, transform: 'rotate(18deg)', easing: 'ease-in-out' });
  const duration = time + recovery;
  const parts: Part[] = [['body', body], ['head', head], ['eye', eye], ['neck', neck]];
  for (const [, keyframes] of parts) {
    keyframes.push({ offset: time + recovery * .7, transform: 'none' }, { offset: duration, transform: 'none' });
    keyframes.forEach(frame => { frame.offset = Number(frame.offset) / duration; });
  }
  return clip(duration, 'linear', parts);
}

// Troje & Frost (2000), https://doi.org/10.1242/jeb.203.5.935:
// head bobs synchronize with footfalls (~3–8Hz), with a world-stable hold
// followed by a fast forward thrust. The base walk uses 3.6–4.8 steps/s;
// cursor proximity scales playback of both the gait and travel together.
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
    // body's small vertical bob too.
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
  if (kind !== 'flying') return walking(from, to, size);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const dy = to.y - from.y;
  const level = Math.abs(dy) < 1;
  // A fixed minimum lift makes tiny trips nearly vertical round trips, with
  // a sharp reversal at peak speed. Scale lift down with the travel distance.
  const rise = Math.min(110, 40 + distance * .12, distance * .25);
  // Measure the swoop in pixels, then time it by distance travelled rather
  // than applying a trip-wide easing curve (which dilutes long-trip acceleration).
  const path = Array.from({ length: 97 }, (_, index) => {
    const t = level ? index / 96 : (index / 96) ** 2;
    const vertical = level ? t : (Math.log1p(63 * t) - t * 63 / 64) / (Math.log(64) - 63 / 64);
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + dy * vertical - (level ? Math.sin(Math.PI * t) * rise : 0),
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
