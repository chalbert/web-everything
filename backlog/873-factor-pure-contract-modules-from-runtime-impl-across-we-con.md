---
kind: story
size: 5
parent: "872"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: guard/contract.ts (+ validity-merge/contract.ts, validator-resolution/contract.ts — pure-contract halves factored from runtime)
tags: []
---

# Factor pure-contract modules from runtime impl across WE contracts

Prerequisite for a type-only contract package: split each WE contract module into a pure-contract half (types/interfaces only, compile-erased) and a runtime-impl half. Pilot on we:guard/provider.ts — a mixed module carrying contract types (GuardRegion, GuardContext, GuardDecision, CustomGuardProvider) plus runtime (assertGuardDecision, ALLOW, GuardDecisionError, NativeGuardProvider) — then apply the pattern to the other contracts (validators, positioning, validity-merge, the #694 families). The pure-contract half becomes a @webeverything/contracts entry; the runtime half stays impl (→ FUI). Without this split, only whole-file byte-copy is possible (the #834 finding).

## Progress

Status: resolved · Branch: docs/standard-authoring-workflow

**The convention (established by the guard pilot).** Each mixed protocol module splits at a *file* seam, not a public-surface seam:
- `<plane>we:/contract.ts` — the **pure-contract half**: `export type` / `export interface` only, fully **compile-erased** (no runtime emit). This is the future `@webeverything/contracts/<plane>` entry (#874).
- `<plane>we:/provider.ts` — the **runtime-impl half**: classes, functions, `const` values (guards, errors, default providers/strategies). It `import type`s the contract types it needs from `we:./contract.js` and re-exports the whole contract surface via `export type * from 'we:./contract.js'`, so existing `we:./provider.js` (and barrel `we:./index.js`) importers are unchanged — zero consumer churn.
- `<plane>we:/registry.ts` — updated to `import type` its types from `we:./contract.js` and the runtime guard from `we:./provider.js`, modelling the clean dependency direction (registry → contract types + provider runtime).

**Done — three WE-owned contract planes split:**
- **guard** (pilot): `we:guard/contract.ts` (GuardRegionKind, GuardRegion, GuardEvent, GuardContext, GuardDecision, GuardRevocationListener, CustomGuardProvider) ← runtime stays in `we:provider.ts` (GuardDecisionError, assertGuardDecision, ALLOW, NativeGuardProvider).
- **validity-merge**: `we:validity-merge/contract.ts` (SourceState, SourceResult, ValidityMessage, MergedValidity, CustomValidityMergeStrategy) ← runtime stays (SOURCE_STATES, SurfaceContractError, isMergedValidity, assertMergedValidity, DEFAULT_PRECEDENCE, the two strategies).
- **validator-resolution**: `we:validator-resolution/contract.ts` (ValidationInput, AsyncResult, ValidationHandle, CustomValidatorResolution, ResolvedSource — imports SourceResult from `we:../validity-merge/contract.js`) ← runtime stays (RESOLVED_STATES, SourceContractError, isResolvedSource, assertResolvedSource, the two strategies).

**Verification:** `tsc --noEmit` (es2022/nodenext/strict) clean across all three planes; `vitest` 129 tests green (guard, validity-merge, validator-resolution + their webguards/webvalidation plugs); `check:standards` green.

**Scope calls (vs. the original item's target list):**
- **positioning** — *not a real module*. `CustomPositioningRegistry` appears only as a doc-comment peer reference in the three registries; there is no positioning plane to split. (No action.)
- **#694 block families** (audit, lifecycle, master-detail, selection, stepper, tree-select) — *deferred, can't be done WE-only*. These carry mixed contract types (e.g. SelectionModel/SelectionOptions/SelectionChange) but are `locus: frontierui` byte-identical copies (#694, kept content-equal under the #170 drift guard until #658). Splitting the WE copy alone diverges it from FUI and breaks byte-identity. Their contract-half factoring must be done in lockstep with FUI (or folded into the FUI migration) — filed as **#879** (sequenced before #875's family migration; #874 ships the three WE planes now and packages the family entries additively once #879 lands).
