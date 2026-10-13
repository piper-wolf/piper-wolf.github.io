# Pigeon visitors

`PigeonVisitor.astro` renders hidden, decorative SVGs and a small loader. The
loader waits for page load, idle time, and 1200ms before dynamically importing
`scene.ts`. It watches visibility and motion preferences even before the scene
loads. Keep this dynamic import: a static runtime import would fetch the scene
up front. Browser tests inspect production asset requests and preload links.

- `definition.ts` describes dimensions, foot anchors, clearance, action choices,
  and delay ranges (minimum plus random spread). The first pigeon uses the city palette;
  companions independently choose red, white, or dark palettes and share a
  companion behavior definition. All share the SVG anatomy.
- `scene.ts` owns lifecycle, invalidation, cached page geometry, and scatter
  commands. Each page visit chooses one to three birds once; the count and colors
  survive suspension. Entrances and scatter flights share staggered timing. It observes container sizes, DOM/style edits, image completion, and
  fonts. It debounces layout and scroll changes without canceling movement.
- `geometry.ts` subtracts content and bird reservations into safe horizontal
  intervals. Walks reserve their entire corridor; flights reserve a destination.
  Reservations are allocated sequentially, including during resettling.
- `bird.ts` owns one bird's explicit movement state and active animations/timers.
  Data attributes render that state. Suspension cancels all actions; completion
  revalidates the landing. Walks preserve the next flight deadline.
- `actions.ts` owns finite gestures, movement timing, and part keyframes. Animation
  promises share a completion/cancellation contract. Scatter uses a shared native
  timeline start with a 120ms stagger. Only breathing and blinking use CSS loops.

To add an appearance, add a definition and palette in the component. An SVG with
another shape must implement the same named `.pigeon-*` parts used by the action
catalog and provide its own size/foot anchor/clearance. To add a gesture, extend
the catalog and definition's action choices. No animation library or frame loop
is required. Birds stay hidden when no safe space exists.

`pigeon-visitor.spec.ts` preserves the original one-bird behavior tests by
removing companion slots before initialization. `pigeon-scene.spec.ts` covers the
real one-, two-, and three-bird scenes, reservations, shared timing, and lifecycle regressions.
