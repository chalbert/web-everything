---
type: issue
workItem: task
parent: "658"
locus: frontierui
status: resolved
blockedBy: ["693"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: ../frontierui/blocks/{audit,lifecycle,master-detail,selection,stepper,tree-select} (migrated to @frontierui/blocks, byte-identical)
tags: []
---

# Migrate the 6 single-file WE-only block families UP to @frontierui/blocks

S2a of #658. Migrate the 6 single-file WE-only families (audit/AuditProvider, lifecycle/LifecycleProvider, master-detail/MasterDetailBehavior, selection/SelectionBehavior, stepper/StepperBehavior, tree-select/TreeSelectBehavior) UP to @frontierui/blocks — impl + register + their unit tests — byte-verified against WE's copies, WITHOUT deleting WE's copies (the #170 migration-order guard: content-equal upstream first). Add each to the S1 exports map. Independent of S2b/S2c. Leaves both trees valid (FUI tests green; WE copies still serve demos).

## Progress

Resolved 2026-06-15. FUI-only (commit → frontierui); content-equal-upstream-first per the #170 guard — WE copies left untouched. Locus was unset; set `locus: frontierui` (edits `../frontierui` only).

- **Migrated 12 files** (6 impl + 6 unit tests) WE → `../frontierui/blocks/`, each **byte-identical** (`diff -q` clean): `audit/AuditProvider.ts`, `lifecycle/LifecycleProvider.ts`, `master-detail/MasterDetailBehavior.ts`, `selection/SelectionBehavior.ts`, `stepper/StepperBehavior.ts`, `tree-select/TreeSelectBehavior.ts` + their `blocks/__tests__/unit/<family>/*.test.ts`. The 6 form a closed set — internal deps only (`audit → lifecycle`, `master-detail → selection`), no external block/plug imports — so the copies resolve in FUI with no edits.
- **`blocks/package.json`** (S1 exports map) — added a bare entry per single-file family (`./audit` → `./audit/AuditProvider.ts`, …) + a deep-import wildcard (`./audit/*`, …) for all 6.

Verification (in `../frontierui`): `npm run build -w @frontierui/blocks` typechecks clean; the 6 migrated test dirs = **32 passed**; full `npm run test:unit` = **1582 passed / 8 skipped** (108 files, +32 vs the pre-migration 1550); `npm run check:standards` = 0 errors. WE's copies are byte-unchanged (`git status` clean) — both trees valid (FUI tests green; WE copies still serve the demos). The WE-copy deletion is the later #170-gated step, not this card.
