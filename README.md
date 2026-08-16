# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Importing photos

Use `bin/import-photo` to resize a photo into the site's public assets:

```sh
bin/import-photo /path/to/photo.jpg
bin/import-photo /path/to/photo.jpg 1200x
```

The default size is `1920x`. The converted JPEG is written to `public/assets/` using the photo's creation date, for example `/assets/2026-08-16.jpg`. Multiple photos created on the same day receive suffixes such as `2026-08-16-2.jpg`.
