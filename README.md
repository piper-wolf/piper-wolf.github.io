# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Publishing photos

Manage photos through the sibling `pigeon-queue` repository's `./bin/serve` web UI.
That app owns image preparation, captions, alt text, scheduling, and independent
website/Bluesky retries. Its website target writes prepared JPEGs to `src/assets/`,
updates versioned `src/data/pigeons.json`, and commits both with a public
`.pigeon-queue/<id>` website receipt. Preserve those receipts and permanent numbers.
This repository only renders and deploys published content; it never reads the
private queue or full upcoming schedule.

`pigeon-queue/pigeon/publication.schema.json` owns the JSON Schema, copied here to
`src/data/publication.schema.json`. The publisher validates before writing and the
handwritten `src/data/pigeons.ts` adapter validates at build time with Ajv, then
resolves JPEGs to Astro image metadata. Never hand-edit generated records. The
adapter, `pigeon-photo.ts`, `pigeon-posts.ts`, and presentation are site-owned.
Publisher writes do not depend on TypeScript formatting or rewrite these modules.

Posts have permanent explicit numbers and are sorted by publication date.
Never reassign numbers: they determine public URLs, including links reserved
before website publication succeeds. Each new post has a queue-ID marker for
website-only deployment confirmation. Website failures cannot block Bluesky or
later daily posts; Bluesky failures cannot block this site. A link may briefly
return 404 if Bluesky succeeds first. Private queue state tracks unfinished targets.

Descriptive titles derive from published alt text; capture dates and photographic
settings come from source JPEG EXIF. The editor strips location/serial metadata
before saving uploads. Minor exposure around an individual started publication is
acceptable; keeping the full unpublished schedule private is the repo split's goal.

## Validation

Use Node.js 22.12 or later. Install dependencies with `npm ci`, then install the test browser once with `npx playwright install --with-deps chromium webkit`.

- `npm run check` checks Astro and TypeScript diagnostics.
- `npm test` type-checks and builds the static site and runs browser checks against Astro's production preview.
- `npm run test:browser` builds the current source and runs browser checks; append Playwright filters for focused work.
- `npm audit` checks dependencies for known advisories.

The browser suite runs in Chromium and WebKit and covers phone, tablet, and desktop layouts, enlarged text, keyboard navigation, touch targets, reduced motion, image sizing, missing pages, internal links, browsing without JavaScript, and automated WCAG accessibility checks. External requests are blocked in tests so they do not generate analytics traffic. Automated checks complement visual and keyboard review; they do not establish complete accessibility conformance.

GitHub Pages deployment requires passing type checks, build, and browser tests.
The dependency audit runs independently and does not block static-site publication. Failed browser checks publish GitHub annotations and retain traces and screenshots as workflow artifacts for seven days.

## Layout conventions

Keep the browser's default root font size. Use `rem` for typography and layout
spacing, `em` for icon sizes/letter spacing/underlines, and `px` for thin borders,
focus outlines, intrinsic image dimensions, and the 44px minimum touch-target
floor. Fluid headings and section spacing combine `rem` with viewport units so
text preferences still affect them. Keep line heights unitless.

`src/styles/layout.ts` shares gutters, frame padding, grid gaps, breakpoint, and maximum width
between the stylesheet and image `sizes` hints. Update both together when changing
columns or breakpoints. Grid tracks and children must be allowed to shrink; never
hide overflow to mask layout bugs. Portrait phone feed/detail photos intentionally
bleed to the viewport edges, while their text keeps the page gutter.

Scope flex/touch-target styles to action links; links inside prose remain inline.
Use page/section headers and preserve the heading hierarchy, landmarks, image alt
text, visible focus, and reduced-motion behavior.
