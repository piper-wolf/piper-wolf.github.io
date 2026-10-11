# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Publishing photos

Manage photos through the sibling `pigeon-queue` repository's `./bin/serve` web UI.
That app owns image preparation, captions, alt text, and publication. Its website
target writes prepared JPEGs to `src/assets/`, updates `src/data/pigeons.ts`, and
commits and pushes both together with a `.pigeon-queue/<id>` receipt. Keep these
receipts: they prevent duplicate posts on retries and enforce the scheduled daily
limit. This repository only renders and deploys the published content.

`src/data/pigeons.ts` is publisher-owned output, with an ownership warning kept
at the top by `pigeon-queue/pigeon/website.py`. Do not hand-edit its photo records.
Change publication output in that generator or unpublished content through the
queue editor. Handwritten types live in `src/data/pigeon-photo.ts`; sorting and
descriptive page titles live in `src/data/pigeon-posts.ts`. Titles use the existing
published alt text instead of a second, independently maintained photo field.

Posts are sorted by publication date and use permanent, explicit numbers in
`src/data/pigeons.ts`; never reassign a number because it determines the public
URL. New numbers increase monotonically. The publisher adds a queue ID marker to
each new post so it can wait for deployment. Capture dates and photographic
settings come from the source JPEG's EXIF; optimized image variants may omit EXIF.
The queue strips location and other private metadata before saving uploads.

## Validation

Use Node.js 22.12 or later. Install dependencies with `npm ci`, then install the test browser once with `npx playwright install --with-deps chromium webkit`.

- `npm run check` checks Astro and TypeScript diagnostics.
- `npm test` type-checks and builds the static site and runs browser checks against Astro's production preview.
- `npm run test:browser` checks an existing build.
- `npm audit` checks dependencies for known advisories.

The browser suite runs in Chromium and WebKit and covers phone, tablet, and desktop layouts, enlarged text, keyboard navigation, touch targets, reduced motion, image sizing, missing pages, internal links, browsing without JavaScript, and automated WCAG accessibility checks. External requests are blocked in tests so they do not generate analytics traffic. Automated checks complement visual and keyboard review; they do not establish complete accessibility conformance.

GitHub Pages deployment requires passing type checks, build, and browser tests.
The dependency audit runs independently and does not block static-site publication. Failed browser checks retain traces and screenshots as workflow artifacts for seven days.

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
