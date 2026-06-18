---
type: issue
workItem: story
size: 3
parent: "872"
status: resolved
blockedBy: ["873"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "blocks/selection/contract.ts (+ audit, lifecycle, master-detail, stepper, tree-select contract.ts — pure-contract halves factored from runtime, byte-identical WE+FUI; #694 families)"
tags: []
---

# Factor #694 block-family contract halves into @webeverything/contracts (FUI-coordinated)

The six #694-migrated block families (audit, lifecycle, master-detail, selection, stepper, tree-select) carry mixed contract types (e.g. SelectionModel/SelectionOptions/SelectionChange) plus runtime, but their canonical copies are locus:frontierui and WE keeps byte-identical copies under the #170 drift guard. #873 could not factor them WE-only without breaking byte-identity, so it factored only the WE-owned planes (guard, validity-merge, validator-resolution). This factors each family's pure-contract half into a @webeverything/contracts entry, done in lockstep across WE+FUI (or folded into the #875 FUI migration) so byte-identity is preserved. Provides the family contract entries #874 packages and #875 imports.

## Progress

Done (lockstep, byte-identical WE + FUI). For each of the six families a sibling `we:contract.ts` now holds the pure-contract half (types/interfaces only, fully compile-erased), following the #873 file-seam precedent — the runtime file `import type`s what it uses and re-exports the whole surface (`export type * from './contract'`) so every existing importer keeps one import site (public surface unchanged):

- `we:blocks/audit/contract.ts` — `AuditChange`, `AuditEvent`, `AuditQuery`, `CustomAuditProvider` (runtime: `DefaultAuditProvider`, `CustomAuditRegistry`, `registerAudit`, `auditLifecycle`).
- `we:blocks/lifecycle/contract.ts` — `StatusTone`, `EntityRef`, `ActorRef`, `LifecycleTransition`, `LifecycleStateMeta`, `LifecycleDefinition`, `LifecycleEvent`, `GuardResolver`, `CustomLifecycleProvider`.
- `we:blocks/master-detail/contract.ts` — `FocusFlow`, `EmptyState`, `MasterDetailOptions`.
- `we:blocks/selection/contract.ts` — `SelectionModel`, `SelectionOptions`, `SelectionChange`.
- `we:blocks/stepper/contract.ts` — `Progression`, `StepperOptions`.
- `we:blocks/tree-select/contract.ts` — `TreeNode`, `TreeModel`, `TreeSelectOptions` (internal `Flat` stays runtime-side).

Byte-identity preserved: the 12 files (6 `we:contract.ts` + 6 edited runtime) are byte-for-byte identical in `webeverything/blocks/` and `frontierui/blocks/` (the #170 drift guard). Verified: 37 family unit tests green, standalone `tsc --noEmit` clean on both repos' copies (incl. FUI's extra `fui:lifecycle/AttributeLifecycle.ts`), `check:standards` 0 errors. These six `we:contract.ts` entries are the family contracts #874 packages under `@webeverything/contracts/<family>` and #875 imports.
