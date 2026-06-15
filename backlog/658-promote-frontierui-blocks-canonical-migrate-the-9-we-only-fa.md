---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["657"]
dateOpened: "2026-06-15"
tags: []
---

# Promote @frontierui/blocks canonical, migrate the 9 WE-only families, delete WE's vendored blocks/

Execute Fork 2+3 of the #641 ruling: promote frontierui/blocks to a canonical granular @frontierui/blocks sub-package (sibling of @frontierui/plugs). Migrate the 9 WE-only families that carry real impl (audit, background-task-surface, data-grid, lifecycle, master-detail, selection, stepper, tree-select, type-ahead) UP to @frontierui/blocks BEFORE deleting anything — the #170 migration-order guard (never delete a tree not yet content-equal upstream). Then delete WE's byte-identical vendored blocks/ and repoint WE demos/site to consume @frontierui/blocks as the #604 client. Per-family classification at build time: genuine impl migrates, aspirational/empty stays a blocks.json contract with no sourcePath.
