---
type: issue
workItem: story
size: 8
parent: "658"
status: open
blockedBy: ["694", "695", "696", "604"]
dateOpened: "2026-06-15"
tags: []
---

# Delete WE's vendored blocks/ and repoint WE imports+build to @frontierui/blocks (the #604 client cutover)

S3 of #658. Delete WE's byte-identical vendored blocks/ families and repoint every WE blocks/… import + reconfigure WE's build (vite/tsc/module-resolution) to consume the cross-repo @frontierui/blocks. This IS the #604 client migration. Blocked by S2a/S2b/S2c (every WE-only family must be content-equal upstream first — the #170 guard) AND by #604 (held; its two open forks — published-package vs source-composition, in-page vs linked — decide HOW WE resolves @frontierui/blocks, so S3's own sub-seams aren't investigable until #604 rules). Re-/split S3 once #604 lands. Size 8 — not batchable as one.
