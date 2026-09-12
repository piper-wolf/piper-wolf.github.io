# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Importing photos

For unattended imports, both metadata fields can be provided explicitly:

```sh
bin/import /path/to/photo.jpg --caption 'A pigeon at the café' --alt-text 'A gray pigeon perched on a railing.'
```

`bin/import` is an alias for `bin/import-photo`. Supplying `--alt-text` skips
Codex; supplying `--caption` skips the caption prompt (an empty string is valid).
The importer requires a clean checkout and still commits and pushes the result.
The pigeon queue uses `--prepared` to preserve its already resized JPEG and
`--queue-id ID` to commit a publication receipt in `.pigeon-queue/`. Repeating an
ID retries the push without creating a duplicate post. Keep those receipts.

Use `bin/import-photo` to resize a photo into the site's public assets and add its pigeon photo metadata:

```sh
bin/import-photo /path/to/photo.jpg
bin/import-photo /path/to/photo.jpg 1200x
```

The default size is `1920x`. The converted JPEG is written to `src/assets/` using the date it is imported, for example `src/assets/2026-08-16.jpg`. Multiple photos imported on the same day receive suffixes such as `2026-08-16-2.jpg`. Astro optimizes these imported images during the build.

Requires ImageMagick, ExifTool (`libimage-exiftool-perl` on Debian/Ubuntu; `exiftool` on Homebrew/Termux), Node.js, Git, and the Codex CLI.

The command stages the source photo locally, asks headless Codex to generate alt text, prompts for an optional caption, and then adds the new photo to `src/data/pigeons.ts`. Posts are sorted by post date and automatically assigned post numbers in chronological order, with the oldest post as number 1. Capture datetime stays in the JPEG's EXIF, including subseconds and a timezone offset when the camera recorded them. Without an offset, it remains camera local time.

Imported JPEGs retain an explicit allowlist of photography EXIF: camera/lens make and model, capture datetime, aperture, shutter speed, ISO, focal length, exposure compensation/program, metering, flash, and white balance. All other source metadata is stripped, including GPS, XMP/IPTC locations, maker notes, serial numbers, and embedded previews. Photos are auto-oriented before resizing. At build time, detail pages read EXIF directly from the source JPEG and display available fields alongside the post date. No photography metadata is added to post data. Existing photos are untouched, and photos without EXIF simply omit the details panel. Astro's optimized image variants may strip EXIF; the imported JPEG remains the metadata source of truth.

After a successful resize and metadata update, the command commits the generated asset and metadata and pushes the current Git branch. The image and metadata are only written after the resize succeeds.

On Android, grant Termux access to photos/files and run `termux-setup-storage` before importing from `/sdcard/` or `/storage/emulated/`.

## Validation

Use Node.js 22.12 or later. Install dependencies with `npm ci`, then install the test browser once with `npx playwright install --with-deps chromium webkit`.

- `npm run check` checks Astro and TypeScript diagnostics.
- `npm test` type-checks and builds the static site and runs browser checks against Astro's production preview.
- `npm run test:browser` checks an existing build.
- `npm run test:import` checks real imports with and without EXIF, including removal of GPS and XMP/IPTC locations (requires ImageMagick and ExifTool; Git and Codex are stubbed).
- `npm audit` checks dependencies for known advisories.

The browser suite runs in Chromium and WebKit and covers phone, tablet, and desktop layouts, enlarged text, keyboard navigation, touch targets, reduced motion, image sizing, missing pages, internal links, browsing without JavaScript, and automated WCAG accessibility checks. External requests are blocked in tests so they do not generate analytics traffic. Automated checks complement visual and keyboard review; they do not establish complete accessibility conformance.

GitHub Pages deployment runs the dependency audit, type checks, build, and browser suite before publishing. Failed browser checks retain traces and screenshots as workflow artifacts for seven days.
