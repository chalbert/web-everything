---
type: idea
workItem: story
size: 2
parent: "970"
status: resolved
blockedBy: ["971"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: frontierui/scripts/check-standards.mjs
tags: []
---

# Demo-completeness gate: every registered FUI block must map to a demo

Add a gate rule to fui:scripts/check-standards.mjs that FAILS if any registered fui:blocks.json entry lacks a resolvable demoFile (and that the referenced fui:demos/<file> exists), mirroring the #784 catalog-completeness gate and WE's we:check-demos folder-registration gate. Makes 'a live demo per block' an enforced invariant rather than hand-remembered, killing the same silent drift #731 killed for catalog entries. Depends on the demoFile field (#971); turns green only once #972 closes the authoring coverage — so it can land amber/allowlisted first, or last.

## Progress — resolved (batch-2026-06-18)

Landed the demo-completeness gate in `fui:scripts/check-standards.mjs` (after the
#784 catalog-completeness gate). Two checks:
1. **Dangling reference = hard error always** — a present `demoFile` must resolve to
   a real `demos/<file>` (trailing-slash dir form like `rich-text-editor/` handled).
2. **Missing demoFile = hard error unless allowlisted** — a `DEMO_PENDING` set holds
   the 26 blocks whose authoring coverage is still owed by #972; every block NOT on it
   must declare a `demoFile`. A new block can never silently skip a demo.

The allowlist is self-policing: a stale entry (block gone, or it now has a demoFile)
warns so the list tracks #972's progress and can't mask a regression. **#972 closure
= delete `DEMO_PENDING`** and the gate enforces all-blocks-have-demos. Gate green
(0 errors; 11 blocks enforced today, 26 pending). `npm run check:standards` in
`../frontierui`.
