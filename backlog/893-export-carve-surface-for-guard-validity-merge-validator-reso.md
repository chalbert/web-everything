---
kind: story
size: 3
status: resolved
blockedBy: ["903"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: contracts/package.json
tags: []
---

# Export+carve surface for guard / validity-merge / validator-resolution (per #817 B1 ruling)

> **PREMISE CORRECTED — do not action the lead as written.** A batch-2026-06-17 pre-flight against the real
> tree falsified the "no WE-side consumer → move all runtime to FUI" premise below: WE's own (WE-only)
> `webguards`/`webvalidation` plugs import these runtime *values* directly, so a blanket B1 runtime→FUI move
> would break WE (and WE may not import FUI). The placement is therefore **re-opened as decision #903**
> (`blockedBy: [903]`); the [constellation-placement](../docs/agent/platform-decisions.md#constellation-placement)
> consumer/`we:check.ts` test now points toward the runtime *staying WE* here as an #817 exception (contract types
> still cross). This card is the **build of whatever #903 rules** — see "Blocked — premise is false" below.

Implement #817's B1 split for the three planes guard/, validity-merge/, validator-resolution/ — the cut is the we:contract.ts file seam: only the contract (types) stays WE, all runtime moves to FUI. WE side: per plane, add a we:package.json + exports map scoped @webeverything/* (name == specifier, #239) exporting only we:contract.ts (pure types/interfaces, incl. any registry interface type).

FUI side: lift the entire runtime half — we:provider.ts (error classes, assert*/is* guards, constant data ALLOW/DEFAULT_PRECEDENCE/SOURCE_STATES, native-default strategy classes NativeGuardProvider/SourceReductionStrategy/LastWriteWinsStrategy/VersioningResolution/CancellationResolution) and we:registry.ts (registry classes + the stateful engines ValiditySourceOrchestrator/AsyncValidationRunner) — plus the impl-coupled __tests__, into FUI beside the plug, re-pointed to import the contract from @webeverything/*. Add FUI tsconfig paths + vite alias mapping the three @webeverything/* specifiers to ../webeverything/<dir>. No implementation stays in WE (these planes have no we:check.ts gate, so nothing WE-side consumes the runtime — contrast capability-manifest #730/#814, which kept its whole plane WE because we:check.ts consumes its assert). Whole-file move, cleaner than #814's mid-file we:service.ts carve. Unblocks #725.

## Resolved — delivered by the #873/#874 contract package, reshaped by #903 (2026-06-18)

#903 ratified: the three planes keep **both contract and runtime in WE** (corrects #817-B1's loose
premise); only the **contract types** are exported as the `@webeverything/*` package, and FUI's #725 plug
wrappers import the runtime from WE (FUI→WE allowed). That reshaped deliverable — "implement the
contract-type export" — is **already in place**, delivered by sibling work that landed and committed:

- **The carve (#873, resolved).** All three `we:contract.ts` are **pure-type / compile-erased** —
  verified 0 runtime value exports in `we:guard/contract.ts`, `we:validity-merge/contract.ts`,
  `we:validator-resolution/contract.ts`. The runtime halves (`we:provider.ts`, `we:registry.ts`) stay
  in WE per #903 (no move — B1's relocation is reversed).
- **The export (#874, resolved).** `@webeverything/contracts` ships the three subpath exports
  `./guard` → `we:contracts/guard.ts`, `./validity-merge` → `we:contracts/validity-merge.ts`,
  `./validator-resolution` → `we:contracts/validator-resolution.ts`, each a type-only
  (`export type *`) re-export of the canonical contract module. Package name == specifier (#239). This
  consolidated package is the ratified contract-distribution end-state (supersedes B1's per-plane
  `@webeverything/<plane>` packages).
- **No contract→runtime leak.** The three pure contracts reference none of the runtime-resident types
  (`SourceUpdate` in `we:validity-merge/registry.ts`, `AsyncValidator`/`SourceSink` in
  `we:validator-resolution/registry.ts`) — those are runtime types FUI imports directly from WE (#903),
  not part of the contract surface, correctly left in the runtime files.
- **No backwards edge to drop.** No item declares `blockedBy: 893`; #903's "drop the
  `#893-blocks-#725` edge" is already satisfied. #725 (FUI ports the plug wrappers) remains the
  FUI-side follow-on, importing the WE runtime + the `@webeverything/contracts` types.

Closed as delivered-by-sibling-work; `graduatedTo` the contract package. The B1 framing below is
retained for lineage only.

## Blocked — #817 B1 premise is false (found in batch-2026-06-17 pre-flight)

The lead paragraph asserts *"these planes have no we:check.ts gate, so nothing WE-side consumes the
runtime."* **This is false.** WE's own plugs import the runtime **values** of all three planes directly:

- `we:plugs/webguards/index.ts` + `we:plugs/webguards/CustomGuardRegistry.ts` → `NativeGuardProvider`,
  `GuardDecisionError`, `assertGuardDecision`, `ALLOW` (from `we:guard/provider.ts`) and
  `UnknownGuardProviderError`, `CustomGuardRegistry` (from `we:guard/registry.ts`).
- `we:plugs/webvalidation/CustomValidityMergeRegistry.ts` → `SourceReductionStrategy`,
  `LastWriteWinsStrategy`, `UnknownStrategyError`; `…we:/CustomValidatorResolutionRegistry.ts` +
  `we:AsyncValidatorField.ts` → `VersioningResolution`, `CancellationResolution`, `AsyncValidationRunner`,
  `ValiditySourceOrchestrator`.

These plugs are **WE-only** (no `guard`/`valid*` plug exists in `../frontierui/plugs/`). Moving the runtime
to FUI (B1) would break them, and WE may not import FUI (npm-scope-mirrors-layer — @webeverything never
imports Frontier UI, #239). The placement test
behind #817 was *"does a WE-side artifact consume the runtime?"* — and a WE plug qualifies exactly as the
capability-manifest `we:check.ts` consumer did (#730/#814 kept that plane WE for the same reason). So B1 cannot
be executed mechanically; it needs a design call. **Filed as decision [#903](/backlog/903-decide-runtime-placement-for-guard-validity-merge-validator-/)**
(lean B: keep the runtime in WE for these three planes as #817 exceptions); this item is now
`blockedBy: [903]`. Released to `open` rather than improvising a cross-repo move that breaks WE plugs.
