# Tests

Run `npm test` for type checking, a production build, and Playwright. Run
`npm run test:browser` against the latest build for browser-only checks.

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
