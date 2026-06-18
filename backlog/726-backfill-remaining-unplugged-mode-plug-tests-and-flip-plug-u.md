---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["725"]
dateOpened: "2026-06-15"
tags: []
---

# Backfill remaining unplugged-mode plug tests and flip PLUG_UNPLUGGED_TEST_ENFORCED to error

The #636 dual-mode gate warns on any plug domain missing an unplugged-mode (non-invasive) test. #649 backfilled 3, leaving 6 warning: webcontexts, webdirectives, webexpressions, webstates, webguards, webvalidation. Flipping `PLUG_UNPLUGGED_TEST_ENFORCED` (we:scripts/check-standards-rules.mjs) to true turns the warns into errors — fully automating the #606 "no plug may require plugged mode" invariant — but only goes green once ALL domains ship one. This item backfills the remaining 6 (modelled on #649's tests) then flips the flag. Note: webguards/webvalidation's home is FUI (#725), so coordinate their test placement with that port and #449's deletion of WE's `plugs/`.
