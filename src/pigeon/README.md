# Pigeon visitors

`PigeonVisitor.astro` renders hidden, decorative SVGs and a small loader. The
loader waits for page load, idle time, and 300ms before dynamically importing
`scene.ts`. It watches focus, visibility, and motion preferences even before loading.
Keep this dynamic import: browser tests verify production request timing and
that the scene is absent from preload links.

- `definition.ts` describes dimensions, foot anchors, clearance, gestures, and
  maximum waits (sampled from zero) and escape radii. Birds render at 28px on narrow
  screens and 40px on desktop; geometry scales the foot anchor to the rendered
  size. Borderless photo tops remain valid perches. Up to three birds use the same
  behavior; the first randomly chooses among the ordinary rock-pigeon coats
  in `appearances.ts` with equal probability, excluding fancy breeds. Each companion
  independently chooses from the full catalog in `appearances.ts` with equal probability,
  including blue bar; duplicates are allowed.
- `scene.ts` owns page lifecycle, staggered entrances and replacements, cached
  geometry, and the cursor. Pointer events only update its latest position and
  request one shared frame. The frame reads each grounded bird's bounds before
  applying any reactions. It continues only while birds walk or run; landings and
  geometry changes request another check. It observes content sizes, DOM/style edits,
  image completion, and fonts, excluding the decorative SVG tree. Only content
  insertions/removals refresh observer targets; invalidations share one scheduled
  reconciliation rather than continually resetting its timer. Bird dimensions refresh with geometry rather
  than on every definition access.
  Ground movement uses this frame even without a cursor to accelerate and brake;
  perched birds with no cursor schedule no frames.
  Invalidation preserves actions and deadlines. Focus loss, hidden documents,
  and pagehide cancel grounded gestures and movement, preserving the bird's current
  position, and stop arrivals and action timers. Flights finish landing or departing
  before the scene sleeps and pauses CSS loops; old actions never resume on focus.
  Resuming shifts deadlines by the time asleep and refreshes geometry once;
  there is no background polling or catch-up burst. Reduced motion cancels and
  hides birds. Count and colors survive either lifecycle; birds act independently.
  One shared arrival timer only runs while awake.
  Perched birds scrolled outside the viewport's safe perch area wait an independent
  random 0–2 seconds before relocating. Further scroll events do not restart that wait; returning
  to a valid visible perch or suspending the scene cancels it.
  Navigation uses Astro's [persisted elements and swap lifecycle](https://docs.astro.build/en/guides/view-transitions/).
  The overlay and scene survive internal links and back/forward navigation.
  Before the swap, each active bird captures its rendered translation in viewport
  coordinates and all animated part poses, then invalidates old completions.
  After the swap and scroll restoration, fresh geometry supplies a safe destination.
  Flights start from the captured location and recover the interrupted pose,
  including walks and gestures. Reservations are rebuilt against the new document.
  Reloads start a new flock.
- `geometry.ts` subtracts content and bird reservations into safe intervals.
  The whole header divider is considered, not just the logo–navigation gap;
  mobile header padding and detail-photo spacing leave clearance above perches.
  Walks reserve their full corridor; flights reserve their destination. Existing
  positions are validated directly, keeping safe birds in place.
- `bird.ts` manages one bird's state, facing, position, reservations, deadlines,
  and animations. Entrances randomly face left or right and start beyond the
  opposite viewport edge, facing inward. The scene adds birds at 100ms, 90s,
  and 3 minutes of active time. Timed perch changes sample 0–3 minutes (previously
  0–1 minute). After 4–8 active minutes perched or moving, a bird flies offscreen;
  its slot receives a newly chosen companion 30–90 active seconds later. These
  timings are decorative choices. Birds have no entrance timers of their own.
  A cursor within 320px sets a desired ground speed, increasing continuously
  from 0.25 to 1.75 bird widths/second as it approaches the 14px flight margin.
  This is a target speed: ground velocity accelerates at 4 bird widths/s² and
  brakes at 6 bird widths/s². Short paths brake before their reserved endpoint
  and may never reach the target. These rates are screen-animation choices,
  not measured pigeon escape dynamics. Actual speed selects the gait: walking
  below 1.25 widths/second, a short grounded
  scurry above it, and walking again below 1.1 to avoid boundary chatter.
  Hysteresis affects only the gait; the same proximity always requests the same
  target speed. Running has quicker, longer alternating steps, springy body
  compression, folded wings and reduced head bob. Within 14px the bird flies.
  Ground gait changes blend the rendered pose over about 100ms and preserve
  the reserved endpoint and visible position. Animation and travel share the
  same playback rate, normalized from each action's
  distance and native duration to the current velocity. Stride rounding, cadence
  variation and gait changes preserve that velocity; endpoint braking limits
  travel on short corridors.
  A cursor on the opposite side requests a reversal: the bird keeps moving and
  facing its original direction while braking, replans a safe path from its
  rendered position at zero velocity, then flips and accelerates away. A blocked
  reversal stops and follows the usual retry deadline. The old corridor remains
  reserved throughout braking.
  With no cursor, ground movement approaches 0.5 bird widths/second and walks.
  Flight interrupts ground movement from its visible position. Ground movement
  uses the scene's last cursor position each animation frame,
  so a stationary cursor also changes gait or speed, or triggers flight.
  Each landing rechecks the stationary cursor, continuing to walk away while
  it remains nearby. One distance calculation selects flight, walking, running, or a
  ground speed adjustment; hover uses this same path. Blocked escapes retain
  their normal retry deadline without searching again on every pointer event.
  A changed escape direction, action, or geometry allows an earlier retry;
  flight directions use eight sectors. Deadline retries use the same cursor
  check, including when the cursor is stationary.
  Leaving the page or blurring the window clears the cursor. Touch pointers are ignored. Escape paths lead away from the pointer
  along a safe corridor; blocked ground escapes wait instead of triggering flight.
  Pointer-triggered flights prefer safe destinations in the direction away from
  the cursor, falling back to other safe destinations when that direction is unavailable.
  One timer wakes the next idle, walk, flight, or departure deadline.
  Gestures finish before timed movement; departure, then flight, takes priority when overdue.
  Hover can interrupt a gesture, preserving its opening pose in the flight.
  Walks preserve the flight deadline. Landings commit their held endpoint before
  cancellation, then reconcile fresh geometry. Suspension cancels all actions;
  stale completions cannot restart it.
- `actions.ts` returns finite keyframes and timing only. Walks cover a few
  steps at 3.6–4.8 steps/s, with alternating planted feet and lifted recovery.
  Runs share the ground-motion factory, using 6.8–7.6 steps/s and longer
  strides with overlapping support. [Andrada et al. (2015)](https://doi.org/10.1038/srep13636)
  observed mixed walking/grounded-running mechanics in pigeons with no aerial
  phases on the treadmill. This informs alternating foot contact and springy
  compression instead of a two-foot airborne hop. [Davies & Green (1988)](https://doi.org/10.1242/jeb.138.1.71)
  found that running heads keep moving forward throughout the bobbing cycle;
  the run therefore cancels only part of forward travel. Within each gait,
  cursor proximity changes playback speed without restarting the step. Run
  cadence, stride geometry, bounce amplitude, bout length, speed gradients and
  interaction radii are illustration choices, not measured escape behavior.
  Travel duration follows stride length and cadence, scaled to the rendered
  bird size. Walking head motion cancels forward travel and body bob during each hold,
  then thrusts forward; see [Troje & Frost (2000)](https://doi.org/10.1242/jeb.203.5.935).
  Peck snippets contain 2–5 pecks at 2.6–3.2Hz. An initial higher aiming stop
  leads into low fixation; serial pecks return only to that lower stop, not
  upright between strikes. An accelerating ~80ms approach, 20ms contact and
  ~100ms eased withdrawal suggest the measured feeding sequence. The eyes
  narrow just before contact and reopen on withdrawal. Bounded horizontal
  reach/angle changes select nearby targets; the beak's depth is solved against
  the perch so variety cannot drive it through the surface. Feet remain planted.
  The head returns upright and holds briefly only after the snippet. The rounded
  breast avoids an upright throat ridge above the tucked head; the articulated
  neck supplies the throat silhouette. Each foot rotates about its own leg
  anchor, keeping the backward stretch attached rather than orbiting the SVG.
  [Theunissen et al. (2017)](https://doi.org/10.1242/jeb.147850) informs the stops;
  [Ostheim et al. (2020)](https://doi.org/10.1242/jeb.223313) informs the rate
  and squint. Short bout counts, pauses, stride geometry, and posture angles
  are decorative choices, not measurements. All poses end neutral. Scanning uses
  quick tilts with fixation pauses, informed by
  [Kano et al. (2018)](https://doi.org/10.1242/jeb.183475). A backward wing/leg
  stretch, wing-directed preen and brief ruffle/settle add variety. Bill grooming
  follows [Waite et al. (2012)](https://darwin.biology.utah.edu/PDFs/113.pdf);
  gesture angles and durations are illustration choices. Interrupted gestures
  recover every animated part on the movement timeline, including parts that
  the next movement would otherwise leave untouched. The manager
  starts each action on one native timeline origin. Native keyframes animate
  travel and poses; the shared scene frame controls ground speed. Flights follow a logarithmic vertical progression
  that flattens into a horizontal approach; level flights use a symmetric lift
  arc capped at a quarter of the travel distance, so tiny hops stay shallow
  instead of reversing vertically at peak speed.
  Arc-length timing uses fixed acceleration (1800px/s²) and braking (1500px/s²),
  with a capped cruise speed and slower climbing than descending. Short flights
  reach a lower peak speed; long flights add cruise time, not slower acceleration.
  Wingbeats run on elapsed time: broad ~8.9Hz takeoff strokes taper to ~6.6Hz
  cruise, then strengthen toward ~7.8Hz during braking. The body pitches upright,
  tail spreads, and feet extend for landing. These are screen-scale adaptations
  of [Berg & Biewener (2010)](https://doi.org/10.1242/jeb.038109), rather than a
  physical simulation; all parts still finish neutral at the movement endpoint.
  The flight SVG separates a broad inner wing from a tapered primary feather
  fan, with overlapping coverts and simplified feather tips. The outer wing
  twists at the wrist during recovery, retaining more span in slow flight.
  Geometry and wrist animation comments cite
  [Hieronymus (2016)](https://doi.org/10.1111/joa.12511),
  [Stowers et al. (2017)](https://doi.org/10.1098/rsif.2017.0224), and
  [Crandell & Tobalske (2011)](https://doi.org/10.1242/jeb.051342).

`data-state` (`suspended`, `perched`, `walking`, `running`, `flying`) and `data-idle` are the
rendering contract. Translation belongs to the outer element, facing to the SVG,
body poses to `.pigeon-body`, and CSS breathing to its separate `.pigeon-breath`
wrapper. Breathing pauses during movement and posed gestures other than looking; blinking continues while
visible. Ambient loops retain their phase across active states and stop when
suspended. Birds stay hidden when no safe space exists.

## Action variation

`variation.ts` supplies bounded `range(min, max)` and inclusive `integer(min, max)`
samples. Every idle action is a factory in `actions.ts` using that same sampler:
look changes tilt direction/angles and duration, stretch coordinates reach across
wing/leg/tail, preen varies depth/stroke count, ruffle varies vigor, and peck varies
count, timing, fixation and target for each strike. Parameters are sampled once
when building an action, never during playback. Related body parts share values,
all tracks share one duration, and every take ends neutral. No persistent variant
state, extra timers, per-frame randomness, or animation dependency is needed.

`gesture(name, random)` accepts an optional random source for reproducible takes
and boundary tests. Production defaults to `Math.random`. This is bounded uniform
variation, not a claim about the statistical distribution of pigeon behavior.
The same sampler can later parameterize walk/flight factories without changing
`bird.ts` or its interruption handling. Add parameters to the action factory,
not to the manager; keep contact constraints and neutral endpoints explicit.

Existing-option preflight: [GSAP's function/random values and repeat refresh](https://gsap.com/docs/v3/GSAP/gsap.to())
provide similar per-take parameter sampling. The native Web Animations timeline
already supplies playback and cancellation here; a dependency would not improve
the small range-sampling requirement. Avoid adding one just for randomness.

To add a gesture, extend the action catalog and definition's choices. Another
SVG anatomy must provide the named parts plus its own size, foot anchor, and
clearance. Palettes share anatomy and behavior.

`appearances.ts` separates the palette, wing pattern, and breed for each variant.
Add a catalog entry to make it available to companions automatically. Palette keys
map to `--pigeon-*` custom properties, including iris color. `applyAppearance`
sets those properties and `data-pattern` / `data-breed` / `data-features`; the SVG switches reusable
marking and feather layers without changing animation anchors or foot placement.
Patterns include bars, checker, plain, grizzle, and pied. The Fantail adds a radial
tail fan, the Jacobin a feather hood, and the Old German Owl a crest and breast
frill. The English Nun combines that crest with a colored bib, primary tips and
tail; the Lahore adds a white cheek and feathered feet; the Bavarian Pouter adds
a rounded crop, bib, white flights and feathered feet; the Indian Fantail combines
the fan, crest and feathered feet. `breedFeatures` composes those layers, and
each foot's shared template carries its boot through the same walking gait.
Common and fancy pigeons use one SVG template and animation system. Source
comments cite each breed standard and explain the simplified geometry.
These are stylized breed cues, not show-standard illustrations. Muted contour strokes keep pale feathers visible on light backgrounds; the
white palette uses cool gray shadows. Hood seams and overlapping wing coverts
provide feather detail across breeds. Large eyes
and catchlights deliberately exaggerate the otherwise pigeon-shaped silhouette.
The anatomy follows [Cornell's rock pigeon identification](https://www.allaboutbirds.org/guide/rock_pigeon/id):
full breast, small head, thin bill, paired wing bars, and a dark tail band.
Curved green/purple layers suggest neck iridescence, and the backward hallux is
visible without drawing subpixel joints or claws. Check/grizzle flecks are
compound paths generated from editable coordinates, with no individual motion.

Browser coverage lives in `tests/pigeon-animation.spec.ts`, grouped by loading,
actions/transitions, and independent birds/layout. Shared helpers control JS
deadlines and explicitly finish native animations; one real-time loading check
verifies the deferred production request. Extend existing scenarios for related
regressions instead of duplicating setup and coverage.
