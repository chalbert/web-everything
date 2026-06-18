---
type: issue
workItem: task
parent: "170"
status: resolved
blockedBy: ["725"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plugs/core/CustomRegistry.ts
tags: []
---

# Reconcile webvalidation registries' define() override with the CustomRegistry base type (FUI tsc)

The ported webvalidation registries (CustomValidityMergeRegistry/CustomValidatorResolutionRegistry) override define(strategy, asDefault) — structurally incompatible with the base CustomRegistry.define(name: string, ...args), yielding 4 tsc --noEmit errors (2 TS2416 + 2 cascading TS2345 in bootstrap) once FUI typechecks the ported plugs tree. Latent in WE too (WE tsconfig is src-only, never typechecks plugs/), so #725 ported it faithfully rather than diverging the copy. Ungated today (FUI check:standards/vitest/build:demo don't tsc the plugs tree) but FUI's plugs tree is otherwise tsc-clean. Reconcile the registry-base contract so the typed define() override is valid in both repos (keep WE↔FUI byte-identical). #170-family registry reconciliation.

## Progress (resolved 2026-06-18)

Reproduced `npx tsc --noEmit` on the FUI plugs tree: **6** errors, not 4 — #950's in-flight `webguards`
port added a third value-first registry (`CustomGuardRegistry.define(provider, asDefault?)`) with the
identical incompatibility, so the count is now 3× TS2416 (guard/validity-merge/validator-resolution) +
3× cascading TS2345 in `we:plugs/bootstrap.ts`.

**Fix = the registry-base contract, once** (as the title scopes). Changed the base
`CustomRegistry.define` first parameter from `name: string` → `name: unknown` (and the matching
`Registry` interface signature). TS checks method parameters bivariantly; a `string` base param admits
neither direction against a value-shaped override (`define(strategy, …)`), so it errored — `unknown`
accepts every override shape (value→unknown holds) while the body is unchanged (`this.set(name as Key,
…)`). This validates all three value-first overrides at once and restores subclass→base assignability,
clearing the 3 cascading bootstrap TS2345s too.

- Edited `we:plugs/core/CustomRegistry.ts` + `we:plugs/core/Registry.ts` in WE; copied **byte-identical** to FUI.
- FUI `npx tsc --noEmit`: **6 → 0** errors. WE `check:standards`: 0 errors (scoped).
- vitest green: WE webvalidation+core (107), FUI webvalidation+webguards+core (69) — runtime unchanged
  (pure type-signature loosening).
