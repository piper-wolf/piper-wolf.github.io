# Publisher-owned state — do not edit by hand

Generator: sibling `pigeon-queue/pigeon/website.py` (`Website.publish` and
`Website.upgrade_existing`); Bluesky reservations and results are maintained by
`pigeon-queue/pigeon/bluesky.py`.

Queue-ID files are publication receipts: JSON snapshots, or legacy ISO dates.
`next-number` reserves permanent post numbers. Do not add comments inside these
machine-readable files, delete receipts, change snapshots, or reassign numbers.
Change the owning publisher for format or behavior changes. Use the queue editor
for unpublished content; website presentation belongs in its handwritten modules.

New target-independent identities, attempted starts, frozen Bluesky content, and
results live in the private queue repository's `.pigeon-queue/` ledger. Public
receipts here describe website publication and preserve legacy reservations.
The publisher imports those legacy values without changing their identities.
Neither destination depends on the other being live. Never add the full upcoming
queue or schedule here.
