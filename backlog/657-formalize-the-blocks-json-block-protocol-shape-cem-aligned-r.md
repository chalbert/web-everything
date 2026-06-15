---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["641"]
dateOpened: "2026-06-15"
tags: []
---

# Formalize the blocks.json block-protocol shape (CEM-aligned) + repoint every sourcePath to FUI

Execute Fork 1 of the #641 ruling: pin src/_data/blocks.json to a CEM-aligned structural-contract field set (implementsIntent/exports/events/traits/webStandards) as the canonical WE-side block-protocol shape, paired with each src/_includes/block-descriptions/{id}.njk behavioral spec. Fix the lying sourcePath on every entry — repoint from WE's vendored blocks/ copy to the canonical @frontierui/blocks impl (or add a typed implementedBy field). No new schema; extend the surface that already exists. Emitting a real custom-elements.json is a deferred sub-build, not in scope.
