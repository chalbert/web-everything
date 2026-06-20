---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webstates/CustomStorageStrategyRegistry.ts"
tags: []
---

# Reconcile fui:plugs/webstates UP to WE (contract-anchored)

Audit fui:plugs/webstates vs contract+vectors, then port 4 WE-only files (CustomChangeStrategy*, CustomStorageStrategy*) + reconcile index FUI-up.

## Progress

Reconciled `fui:plugs/webstates` UP to WE — a clean additive port (FUI lacked the strategy families
entirely; WE's index only adds their exports, no FUI-ahead lines):

- Ported 4 WE-only files byte-identical: `fui:plugs/webstates/CustomChangeStrategy.ts`,
  `fui:plugs/webstates/CustomChangeStrategyRegistry.ts`, `fui:plugs/webstates/CustomStorageStrategy.ts`, `fui:plugs/webstates/CustomStorageStrategyRegistry.ts`
  (change-tracking + storage-strategy registries; imports resolve to FUI's `../core/CustomRegistry`).
- `fui:plugs/webstates/index.ts` → WE's full export surface.
- Ported the 6 WE-only tests (the 4 strategy tests + `webstates-protocols.unplugged` +
  `webstates.unplugged`). FUI webstates tests green (93, 1 skipped).

FUI `check:standards` red only on the 2 pre-existing notification/signature-pad catalog errors (stepped over).
