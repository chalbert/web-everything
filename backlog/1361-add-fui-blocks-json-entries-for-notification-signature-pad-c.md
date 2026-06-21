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
`blocks/notification/` and `blocks/signature-pad/` each have a real block-family dir but **no entry** in
`fui:src/_data/blocks.json`, so the every-folder-registered invariant is violated. Both dirs were
committed *after* #784 resolved green (notification in `c8265c1`, "the notification block runtime + loan
app consumes it" #358), re-introducing the red, and #784 is resolved so nothing tracks it — the FUI gate
has been persistently red across unrelated sessions. Add the two manifest entries
(`id`/`name`/`type`/`status`/`summary`/`protocol`/`weSpecPath`/`sourcePath`/`demoFile`) mapped per the
#783 grammar, plus a demo each (or a `DEMO_PENDING` listing if coverage is genuinely owed, #972/#973), so
`fui:npm run check:standards` returns to **0 errors**. Surfaced during batch-2026-06-20-1344-1342, where
every gate run stepped over these two as not-this-batch's red.
