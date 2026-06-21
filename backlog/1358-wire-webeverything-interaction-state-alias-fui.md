---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: []
---

# Wire @webeverything/interaction-state alias (FUI)

Add `@webeverything/interaction-state` to `fui:tsconfig.json` + `fui:vite.config.mts` + `fui:vitest.config.ts`,
pointing at the sibling WE root tree `we:interaction-state/index.ts` (whole-package barrel — re-exports
`InteractionStateTracker` + `InteractionState`) — same sibling-alias pattern as the 40+ existing
`@webeverything/*` entries (and exactly mirroring the #1344 commitment-policy/error-summary wiring).
Foundational and unencoded: discovered during #1306 (batch-2026-06-20-1344-1342) — `fui:plugs/webvalidation/ValidityMergeField.ts`'s
hand-merge up to WE imports `InteractionStateTracker`, but FUI has no local `interaction-state/` dir and
no alias, so the import can't resolve. The #1306-creating `/split` carved #1344 for commitment-policy/error-summary
but missed this third WE-resident model. Unblocks #1306.

## Progress (2026-06-21 — batch-2026-06-20-1358-1357)

Added the `@webeverything/interaction-state` → `we:interaction-state/index.ts` alias to all three FUI
configs (`fui:tsconfig.json`, `fui:vite.config.mts`, `fui:vitest.config.ts`), mirroring the #1344
commitment-policy/error-summary entries exactly. Confirmed the WE barrel re-exports
`InteractionStateTracker` (value) + `InteractionState` (type), so the
`fui:plugs/webvalidation/ValidityMergeField.ts` import now resolves. Green FUI gate.
