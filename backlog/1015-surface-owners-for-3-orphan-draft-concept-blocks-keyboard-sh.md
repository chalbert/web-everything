---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1041-graduate-3-orphan-blocks-keyboard-shortcuts-trusted-html-beh.md
tags: []
---

# Surface owners for 3 orphan draft/concept blocks (keyboard-shortcuts, trusted-html-behavior, breakpoint-observer)

Impl-surface L2 coverage check (audit section 9): of 46 draft/concept blocks, 43 are tracked (gap-sweep #315, per-block items, or demos) but 3 are orphans with zero backlog refs, no demo, and no item driving them to active: keyboard-shortcuts, trusted-html-behavior (pairs with trusted-html), breakpoint-observer (pairs with flex-row / breakpoint intent). Decide per block: give it an owning item + demo to graduate it, fold it into its sibling block, or retire the stub. Intents (55) and capabilities (21) were swept clean — 0 orphans.

## Progress (batch-2026-06-18)

Triaged. The 3 orphan blocks (keyboard-shortcuts, trusted-html-behavior, breakpoint-observer) now have an
owning item — scaffolded **#1041** (story·5, tagged `webblocks`) with each block's sibling pairing noted.
Surfacing only: the per-block graduate / fold-into-sibling / retire call is the non-destructive default
(owner+demo) deferred to #1041, not decided here. Intents (55) + capabilities (21) were swept clean — 0
orphans — so no further owners needed there.
