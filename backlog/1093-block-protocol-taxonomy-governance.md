---
type: idea
workItem: story
size: 3
parent: "1040"
status: resolved
blockedBy: ["1087"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: docs/agent/block-standard.md
tags: []
---

# Block protocol taxonomy governance

Define each block 'type' protocol category (Store/Parser/Behavior/Directive/Component/Module — BLOCK_TYPES at `we:scripts/check-standards.mjs:94`, enforced :147) with its meaning + selection guidance, as a governance section under #1087's spec home. Reconcile the drift: one block declares type:'Utility' (out of set → currently only warns) — either add it to BLOCK_TYPES or reclassify the block.
