---
kind: story
size: 3
locus: frontierui
status: open
dateOpened: "2026-06-21"
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
