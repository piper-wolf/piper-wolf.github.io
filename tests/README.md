# Tests

Run `npm test` for type checking, a fresh production build, and Playwright.
Every Playwright invocation builds once in `serve.mjs` before starting preview,
including focused `npm run test:browser -- tests/pigeon-animation.spec.ts` runs.
There is no browser-test path that silently reuses an older `dist` directory.
CI uses the same path, with no duplicate standalone build.

Local defaults use one worker to bound memory use, stop on the first failure,
and allow a 60s default per-test budget; CI retains two workers, complete failure
reporting, and its 30s default. These are maximum budgets, not waits:
fast checks finish immediately in either environment. Assertions and coverage
are identical; retries stay disabled and assertion timeouts are unchanged.
Local passing runs do not record full traces; failures still retain screenshots
and error context. For a focused diagnostic use `--trace=on`. CI keeps its
existing failure-trace capture. [Playwright documents the cost of tracing every
test](https://playwright.dev/docs/trace-viewer#recording-a-trace); keeping that
instrumentation out of routine local runs avoids paying it for passing checks.

`helpers/browser.ts` gives every browser suite the same external-network
isolation, including animation checks. Extra contexts use its shared helper too;
analytics must not influence loading, timing, or generate test traffic.

Animation fixtures start from a fixed fake-clock epoch, not the host's current
time. Native animations are paused and explicitly completed. For deadline/frame
checks, finish unrelated paused gestures before the retry deadline, then advance
through the requested animation frame before reading counters. Do not infer
native-promise or animation-frame completion from a timer-only clock advance.
Controlled perch fixtures also wait for native ResizeObserver delivery before
advancing the geometry debounce, so strict read-count assertions start settled.
Pointer bursts batch counter reset, event dispatch, and snapshots to reduce
browser-protocol round trips without weakening per-frame assertions.

Before pushing, finish the relevant focused checks, then run `npm test` against
a fixed source tree. Do not edit files during that validation run or dismiss
failures as environmental without reproducing the cause. Changes after a run
invalidate its affected results. A timeout is a failure, not a passing check.

- `site.spec.ts`: responsive layout and images in the same page visits,
  accessibility, enlarged text, and touch navigation.
- `integrity.spec.ts`: sitemap, links, assets, metadata, RSS, original dates,
  no-EXIF details, 404 recovery, and browsing without JavaScript.
- `pigeon-animation.spec.ts`: deferred loading, action transitions, geometry,
  independent birds, and lifecycle. Pose/variation checks cover neutral endpoints,
  bounded timing, reproducible takes, planted support feet, and mirrored perch
  contact at variation extremes and between poses. Interruption/suspension is a
  separate scenario so it does not overload the pose test. `helpers/pigeons.ts`
  shares deterministic setup, safety assertions, clock advancement, and animation completion.
- `publication.spec.ts`: data-contract validation, run once in the `contracts`
  project because it does not depend on a browser. Rendering checks run in
  Chromium and WebKit.

Prefer extending an existing scenario for related regressions. Share setup and
assertions, retain distinct viewport and browser coverage, and avoid repeated
navigation for checks that can use the same page. Use fake JS time for animation
scheduling and explicit native-animation completion; retain real time only when
the delay itself is under test. Do not improve speed by removing assertions or
increasing concurrency to hide unnecessary work.
