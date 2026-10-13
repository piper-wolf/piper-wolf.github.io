# Pigeon visitors

`PigeonVisitor.astro` renders hidden, decorative SVGs and a small loader. The
loader waits for page load, idle time, and 300ms before dynamically importing
`scene.ts`. It watches visibility and motion preferences even before loading.
Keep this dynamic import: browser tests verify production request timing and
that the scene is absent from preload links.

- `definition.ts` describes dimensions, foot anchors, clearance, gestures, and
  delay ranges (minimum plus random spread). One to three birds use the same
  behavior; the first has the city palette and others choose red, white, or dark.
- `scene.ts` owns page lifecycle and cached geometry. It observes sizes, DOM/style
  edits, image completion, and fonts. Invalidation debounces reconciliation
  without canceling actions or resetting deadlines. Count and colors survive
  suspension; birds act independently.
- `geometry.ts` subtracts content and bird reservations into safe intervals.
  Walks reserve their full corridor; flights reserve their destination. Existing
  positions are validated directly, keeping safe birds in place.
- `bird.ts` manages one bird's state, facing, position, reservations, deadlines,
  and animations. Entrances randomly face left or right and start beyond the
  opposite viewport edge, facing inward, staggered by 320ms. A cursor within
  28px of a perched bird triggers flight without blocking nearby links. One timer wakes the next idle, walk, or flight deadline.
  Gestures finish before timed movement; flight takes priority when overdue.
  Hover can interrupt a gesture, preserving its opening pose in the flight.
  Walks preserve the flight deadline. Landings commit their held endpoint before
  cancellation, then reconcile fresh geometry. Suspension cancels all work;
  stale completions cannot restart it.
- `actions.ts` returns finite keyframes and timing only. Walking parts complete
  whole cycles at the movement endpoint; all poses end neutral. The manager
  starts each action on one native timeline origin. No animation library or
  frame loop is required. Flights follow a logarithmic vertical progression
  that flattens into a horizontal approach; level flights retain a lift arc.
  Arc-length timing uses fixed acceleration (1800px/s²) and braking (1500px/s²),
  with a capped cruise speed and slower climbing than descending. Short flights
  reach a lower peak speed; long flights add cruise time, not slower acceleration.
  Wingbeats run on elapsed time: broad ~8.9Hz takeoff strokes taper to ~6.6Hz
  cruise, then strengthen toward ~7.8Hz during braking. The body pitches upright,
  tail spreads, and feet extend for landing. These are screen-scale adaptations
  of [Berg & Biewener (2010)](https://doi.org/10.1242/jeb.038109), rather than a
  physical simulation; all parts still finish neutral at the movement endpoint.

`data-state` (`suspended`, `perched`, `walking`, `flying`) and `data-idle` are the
rendering contract. Translation belongs to the outer element, facing to the SVG,
body poses to `.pigeon-body`, and CSS breathing to its separate `.pigeon-breath`
wrapper. Breathing pauses during movement and pecking; blinking continues while
visible. Ambient loops retain their phase across active states and stop when
suspended. Birds stay hidden when no safe space exists.

To add a gesture, extend the action catalog and definition's choices. Another
SVG anatomy must provide the named parts plus its own size, foot anchor, and
clearance. Palettes share anatomy and behavior.

Browser coverage lives in `tests/pigeon-animation.spec.ts`, grouped by loading,
actions/transitions, and independent birds/layout. Shared helpers control JS
deadlines and explicitly finish native animations; one real-time loading check
verifies the deferred production request. Extend existing scenarios for related
regressions instead of duplicating setup and coverage.
