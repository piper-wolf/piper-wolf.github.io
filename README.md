# Piper Wolf's Webpage

A minimal Astro site deployed to GitHub Pages at [piper-wolf.com](https://piper-wolf.com).

## Importing photos

Use `bin/import-photo` to resize a photo into the site's public assets and add its pigeon photo metadata:

```sh
bin/import-photo /path/to/photo.jpg
bin/import-photo /path/to/photo.jpg 1200x
```

The default size is `1920x`. The converted JPEG is written to `src/assets/` using the date it is imported, for example `src/assets/2026-08-16.jpg`. Multiple photos imported on the same day receive suffixes such as `2026-08-16-2.jpg`. Astro optimizes these imported images during the build.

The command stages the source photo locally, asks headless Codex to generate alt text, prompts for an optional caption, and then adds the new photo to `src/data/pigeons.ts`. Posts are sorted by post date and automatically assigned post numbers in chronological order, with the oldest post as number 1. When available, the original capture date is retained in the JPEG copyright comment. After a successful resize and metadata update, the command commits the generated asset and metadata and pushes the current Git branch. The image and metadata are only written after the resize succeeds.

On Android, grant Termux access to photos/files and run `termux-setup-storage` before importing from `/sdcard/` or `/storage/emulated/`.
