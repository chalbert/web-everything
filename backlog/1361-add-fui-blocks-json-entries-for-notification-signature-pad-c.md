---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [frontierui, blocks, catalog, gate, completeness]
---

# Add fui:blocks.json entries for notification + signature-pad (clear persistent #784 catalog red)

The FUI `check:standards` catalog-completeness gate (#784/#783) fails with **2 errors**:
`blocks/notification/` and `blocks/signature-pad/` are real block-family dirs with **no entry** in
`fui:src/_data/blocks.json`, violating the every-folder-registered invariant. Both landed *after* #784
resolved green (notification in `c8265c1` #358), re-introducing the red — and #784 is resolved, so nothing
tracks it; the FUI gate has been persistently red across sessions. Add the two manifest entries (per the
#783 grammar) plus a demo each (or a `DEMO_PENDING` listing, #972/#973) so `fui:check:standards` returns
to **0 errors**. Surfaced at batch-2026-06-20-1344-1342, where every gate run stepped over these as
not-this-batch's red.

## Progress (2026-06-21 — batch-2026-06-20-1358-1357, RESOLVED)

Added the two missing entries to `fui:src/_data/blocks.json` (`notification` → `blocks/notification`,
`signature-pad` → `blocks/signature-pad`), each `type: Component`, summaries drawn from the element
headers + the WE catalog (`we:src/_data/blocks/notification.json` / `we:src/_data/blocks/signature-pad.json`,
which back the `weSpecPath`). No `fui:demos/` page exists for either yet, so — per the card's stated option —
I took the DEMO_PENDING route instead of building demos: listed both ids in the `DEMO_PENDING` allowlist in
`fui:scripts/check-standards.mjs` (#972/#973) and filed **#1367** to author the demos + clear the allowlist.
FUI `npm run check:standards`: **2 errors → 0** (the #784 catalog red is gone; the 6 remaining are
pre-existing #840 CEM-drift warnings, not errors).
