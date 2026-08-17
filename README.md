# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Importing photos

Use `bin/import-photo` to resize a photo into the site's public assets and add its pigeon photo metadata:

```sh
bin/import-photo /path/to/photo.jpg
bin/import-photo /path/to/photo.jpg 1200x
```

The default size is `1920x`. The converted JPEG is written to `src/assets/` using the photo's creation date, for example `src/assets/2026-08-16.jpg`. Multiple photos created on the same day receive suffixes such as `2026-08-16-2.jpg`. Astro optimizes these imported images during the build.

The command prompts for alt text and an optional caption, then adds the new photo to `src/data/pigeons.ts`. Posts are sorted by capture date and automatically assigned post numbers in chronological order, with the oldest photo as number 1. The image and metadata are only written after the resize succeeds.
