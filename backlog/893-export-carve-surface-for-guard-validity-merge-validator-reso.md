---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["903"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
tags: []
---

# Export+carve surface for guard / validity-merge / validator-resolution (per #817 B1 ruling)

Implement #817's B1 split for the three planes guard/, validity-merge/, validator-resolution/ — the cut is the contract.ts file seam: only the contract (types) stays WE, all runtime moves to FUI. WE side: per plane, add a package.json + exports map scoped @webeverything/* (name == specifier, #239) exporting only contract.ts (pure types/interfaces, incl. any registry interface type). FUI side: lift the entire runtime half — provider.ts (error classes, assert*/is* guards, constant data ALLOW/DEFAULT_PRECEDENCE/SOURCE_STATES, native-default strategy classes NativeGuardProvider/SourceReductionStrategy/LastWriteWinsStrategy/VersioningResolution/CancellationResolution) and registry.ts (registry classes + the stateful engines ValiditySourceOrchestrator/AsyncValidationRunner) — plus the impl-coupled __tests__, into FUI beside the plug, re-pointed to import the contract from @webeverything/*. Add FUI tsconfig paths + vite alias mapping the three @webeverything/* specifiers to ../webeverything/<dir>. No implementation stays in WE (these planes have no check.ts gate, so nothing WE-side consumes the runtime — contrast capability-manifest #730/#814, which kept its whole plane WE because check.ts consumes its assert). Whole-file move, cleaner than #814's mid-file service.ts carve. Unblocks #725.

## Blocked — #817 B1 premise is false (found in batch-2026-06-17 pre-flight)

The lead paragraph asserts *"these planes have no check.ts gate, so nothing WE-side consumes the
runtime."* **This is false.** WE's own plugs import the runtime **values** of all three planes directly:

- `plugs/webguards/index.ts` + `plugs/webguards/CustomGuardRegistry.ts` → `NativeGuardProvider`,
  `GuardDecisionError`, `assertGuardDecision`, `ALLOW` (from `guard/provider.ts`) and
  `UnknownGuardProviderError`, `CustomGuardRegistry` (from `guard/registry.ts`).
- `plugs/webvalidation/CustomValidityMergeRegistry.ts` → `SourceReductionStrategy`,
  `LastWriteWinsStrategy`, `UnknownStrategyError`; `…/CustomValidatorResolutionRegistry.ts` +
  `AsyncValidatorField.ts` → `VersioningResolution`, `CancellationResolution`, `AsyncValidationRunner`,
  `ValiditySourceOrchestrator`.

These plugs are **WE-only** (no `guard`/`valid*` plug exists in `../frontierui/plugs/`). Moving the runtime
to FUI (B1) would break them, and WE may not import FUI (npm-scope-mirrors-layer — @webeverything never
imports Frontier UI, #239). The placement test
behind #817 was *"does a WE-side artifact consume the runtime?"* — and a WE plug qualifies exactly as the
capability-manifest `check.ts` consumer did (#730/#814 kept that plane WE for the same reason). So B1 cannot
be executed mechanically; it needs a design call. **Filed as decision [#903](/backlog/903-decide-runtime-placement-for-guard-validity-merge-validator-/)**
(lean B: keep the runtime in WE for these three planes as #817 exceptions); this item is now
`blockedBy: [903]`. Released to `open` rather than improvising a cross-repo move that breaks WE plugs.
