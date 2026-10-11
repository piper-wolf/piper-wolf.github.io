# Repository workflow

- Always commit and push repository changes unless the user says otherwise.

## Generated content ownership

- `src/data/pigeons.ts` and `src/assets/` are publisher-owned output. Do not
  hand-edit photo records or add presentation fields there. Change publication
  output in sibling `pigeon-queue/pigeon/website.py`; edit unpublished photos
  through `pigeon-queue/bin/serve`.
- Website types and presentation belong in `src/data/pigeon-photo.ts` and
  `src/data/pigeon-posts.ts`, plus the Astro components/pages.
- `.pigeon-queue/` receipts and number reservations are publisher state, not
  editable content. Preserve them and existing permanent post numbers.
