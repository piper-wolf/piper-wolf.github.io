# Pigeon visitors

`PigeonVisitor.astro` renders hidden, decorative SVGs and a small loader. The
loader waits for page load, idle time, and 300ms before dynamically importing
`scene.ts`. It watches visibility and motion preferences even before loading.
Keep this dynamic import: browser tests verify production request timing and
that the scene is absent from preload links.

- `definition.ts` describes dimensions, foot anchors, clearance, gestures, and
  maximum waits (sampled from zero) and escape radii. Birds render at 28px on narrow
  screens and 40px on desktop; geometry scales the foot anchor to the rendered
  size. Borderless photo tops remain valid perches. Five birds use the same
  behavior; the first is a blue bar rock pigeon. Each companion independently
  chooses from the full catalog in `appearances.ts` with equal probability,
  including blue bar; duplicates are allowed.
- `scene.ts` owns page lifecycle, one-time staggered entrances, and cached
  geometry. It observes sizes, DOM/style edits, image completion, and fonts.
  Invalidation debounces reconciliation
  without canceling actions or resetting deadlines. Count and colors survive
  suspension; birds act independently. Each entrance timer adds its bird once,
  even if the scene is hidden; reconciliation controls whether it can appear.
- `geometry.ts` subtracts content and bird reservations into safe intervals.
  The whole header divider is considered, not just the logo–navigation gap;
  mobile header padding and detail-photo spacing leave clearance above perches.
  Walks reserve their full corridor; flights reserve their destination. Existing
  positions are validated directly, keeping safe birds in place.
- `bird.ts` manages one bird's state, facing, position, reservations, deadlines,
  and animations. Entrances randomly face left or right and start beyond the
  opposite viewport edge, facing inward. The scene adds five birds at 100ms,
  10s, 40s, 90s, and 3 minutes after initialization. Birds have no entrance timers
  or delays: suspension cancels actions and resumption reconciles immediately.
  A cursor within 320px triggers walking away, with one gait scaled continuously
  from 0.5× at the outer edge to 2× near the 14px flight margin. Animation and
  travel share the same playback rate, preserving planted feet and head holds.
  Flight interrupts ground movement from its visible position. Ground movement
  checks the last cursor position each animation frame,
  so a stationary cursor also changes walking speed or triggers flight.
  Each landing rechecks the stationary cursor, continuing to walk away while
  it remains nearby. Blocked escapes retain their normal retry deadline.
  Leaving the page or blurring the window clears the cursor. Touch pointers are ignored. Escape paths lead away from the pointer
  along a safe corridor; blocked ground escapes wait instead of triggering flight.
  Pointer-triggered flights prefer safe destinations in the direction away from
  the cursor, falling back to other safe destinations when that direction is unavailable.
  One timer wakes the next idle, walk, or flight deadline.
  Gestures finish before timed movement; flight takes priority when overdue.
  Hover can interrupt a gesture, preserving its opening pose in the flight.
  Walks preserve the flight deadline. Landings commit their held endpoint before
  cancellation, then reconcile fresh geometry. Suspension cancels all actions;
  stale completions cannot restart it.
- `actions.ts` returns finite keyframes and timing only. Walks cover a few
  steps at 3.6–4.8 steps/s, with alternating planted feet and lifted recovery.
  Cursor proximity changes playback speed without changing the gait or restarting
  the step. The speed gradient and interaction radii are decorative choices.
  Travel duration follows stride length and cadence, scaled to the rendered
  bird size. Head motion cancels forward travel and body bob during each hold,
  then thrusts forward; see [Troje & Frost (2000)](https://doi.org/10.1242/jeb.203.5.935).
  Peck snippets contain 2–5 pecks at 2.6–3.2Hz, two aiming stops, brief beak
  contact at the perch, partial eye squinting, and an upright recovery pause.
  [Theunissen et al. (2017)](https://doi.org/10.1242/jeb.147850) informs the stops;
  [Ostheim et al. (2020)](https://doi.org/10.1242/jeb.223313) informs the rate
  and squint. Short bout counts, pauses, stride geometry, and posture angles
  are decorative choices, not measurements. All poses end neutral. The manager
  starts each action on one native timeline origin. No animation library or
  frame loop is required to animate movement. Flights follow a logarithmic vertical progression
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

`data-state` (`suspended`, `perched`, `walking`, `flying`) and `data-idle` are the
rendering contract. Translation belongs to the outer element, facing to the SVG,
body poses to `.pigeon-body`, and CSS breathing to its separate `.pigeon-breath`
wrapper. Breathing pauses during movement and pecking; blinking continues while
visible. Ambient loops retain their phase across active states and stop when
suspended. Birds stay hidden when no safe space exists.

To add a gesture, extend the action catalog and definition's choices. Another
SVG anatomy must provide the named parts plus its own size, foot anchor, and
clearance. Palettes share anatomy and behavior.

`appearances.ts` separates the palette, wing pattern, and breed for each variant.
Add a catalog entry to make it available to companions automatically. Palette keys
map to `--pigeon-*` custom properties, including iris color. `applyAppearance`
sets those properties and `data-pattern` / `data-breed`; the SVG switches reusable
marking and feather layers without changing animation anchors or foot placement.
Patterns include bars, checker, plain, grizzle, and pied. The Fantail adds a radial
tail fan, the Jacobin a feather hood, and the Old German Owl a crest and breast
frill. These are stylized breed cues, not show-standard illustrations. Muted contour strokes keep pale feathers visible on light backgrounds; the
white palette uses cool gray shadows. Hood seams and overlapping wing coverts
provide feather detail across breeds. Large eyes
and catchlights deliberately exaggerate the otherwise pigeon-shaped silhouette.
The anatomy follows [Cornell's rock pigeon identification](https://www.allaboutbirds.org/guide/rock_pigeon/id):
full breast, small head, thin bill, paired wing bars, and a dark tail band.

Browser coverage lives in `tests/pigeon-animation.spec.ts`, grouped by loading,
actions/transitions, and independent birds/layout. Shared helpers control JS
deadlines and explicitly finish native animations; one real-time loading check
verifies the deferred production request. Extend existing scenarios for related
regressions instead of duplicating setup and coverage.
