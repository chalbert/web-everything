---
type: issue
workItem: story
size: 5
parent: "872"
status: resolved
blockedBy: ["874", "879"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "frontierui/blocks/{audit,lifecycle,master-detail,selection,stepper,tree-select}/*Behavior|Provider.ts + guard/provider.ts (import contract halves from @webeverything/contracts; 7 FUI byte copies deleted) — #834 byte-copy interim retired"
tags: []
---

# Migrate FUI byte-copied contracts to @webeverything/contracts imports

Replace FUI's byte-copied contract code with imports from @webeverything/contracts: guard (the #834/#836 copy) plus the contract types embedded in the #694-migrated families (audit, lifecycle, master-detail, selection, stepper, tree-select). FUI keeps the runtime impl; the contract halves come from the published package. Removes the corresponding #170 byte-equality drift gates for the migrated contracts (superseded by the package dependency). This is where the byte-copy interim ratified in #834 gets retired.

## Progress

Done — FUI now consumes the contract halves from `@webeverything/contracts` (resolved via the #878 dev-time path/alias), retiring the byte copies. WE keeps each `contract.ts` as the source the package re-exports (the FUI→WE arrow); WE files untouched.

- **6 #694 families** (clean): each FUI runtime file (`audit/AuditProvider.ts`, `lifecycle/LifecycleProvider.ts`, `master-detail/MasterDetailBehavior.ts`, `selection/SelectionBehavior.ts`, `stepper/StepperBehavior.ts`, `tree-select/TreeSelectBehavior.ts`) repointed `import type … from './contract'` + `export type * from './contract'` → `'@webeverything/contracts/<family>'`, and **deleted** its local `blocks/<family>/contract.ts` byte copy (6 files removed — the #879 FUI copies, now redundant).
- **guard**: FUI's `blocks/guard/provider.ts` was the pre-#873 *monolithic* byte copy (#836, before WE split guard) — types inline, no `contract.ts`. Stripped the seven inline contract declarations (`GuardRegionKind`, `GuardRegion`, `GuardEvent`, `GuardContext`, `GuardDecision`, `GuardRevocationListener`, `CustomGuardProvider`) and replaced them with `import type … from '@webeverything/contracts/guard'` + `export type * from '@webeverything/contracts/guard'`. The guard runtime (`GuardDecisionError`, `assertGuardDecision`, `ALLOW`, `NativeGuardProvider`) stays in FUI; the siblings (`registry.ts`, `accessControl.ts`, `index.ts`) and tests resolve unchanged via `provider`'s re-export.

**#170 drift gates:** there is no automated byte-equality gate in either repo's `check-standards` (verified by grep — only unrelated MaaS golden-vector byte checks). The byte-equality expectation for these contracts was advisory; it is now structurally superseded by the package dependency (FUI holds no copy to drift). #170 itself (`plugs-duplicated-across-webeverything-frontierui`) is about plugs, not these contracts, and is untouched.

**Verified:** project `tsc -p tsconfig.json --noEmit` clean across the migrated areas (cross-repo resolution to `../webeverything/contracts/*` works); 72 FUI tests pass (6 families + guard registry 13 + accessControl 11); FUI `check:standards` 0 err/0 warn; the guard-consuming **loan-origination** exercise app boots clean on `:3001` (45 `#app` descendants, 0 console/page errors). The `export type *`/`import type` are compile-erased, so the guard runtime the apps load is behaviourally identical. Retires the #834 byte-copy interim for these contracts (#170's contract-copy half).
