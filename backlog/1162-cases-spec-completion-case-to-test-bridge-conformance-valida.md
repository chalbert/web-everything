---
kind: story
size: 3
parent: "1038"
status: resolved
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webcases/caseToVector.ts"
tags: []
relatedProject: webcases
---

# Cases Spec completion — case-to-test bridge conformance + validator coverage

WE-layer Cases Spec (webcases) completeness on the existing we:webcases/ surface (we:webcases/requirementValidator.ts #100, we:webcases/compileRequirement.ts #797): close case-structure-validation + case-to-test bridge conformance coverage. Child of the #1038 webdocs spec-surface epic. The then.observe observable-state grounding gap is carved to decision #1160 (blocker), not bundled here. Demo: webcases conformance suite green.

## Surfaced fork (batch-2026-06-20)

The "case-to-test bridge" has **no implementation yet** — only `we:webcases/compileRequirement.ts` *produces* the `<!-- assert: protocol/observe/tier/kind -->` directive (the `kind` token was added by #1201 so the bridge can read-a-state vs await-an-event); nothing *consumes* it. A bridge that drives a component and checks the named observable at its tier **overlaps the #899/#1176 behavioral-conformance-vector driver** (`fui:tools/explorer/oracles/conformanceVectors.ts` — runner + judge + clock, built this same batch). So before building, an open design question: does the bridge **reuse** that vector driver (one runner, two front-ends — an assert-directive front-end and the vector-suite front-end) or stay a **separate** WE-side mechanism? The WE/FUI boundary bites here too (the driver is FUI-owned per #899 Fork-1; the bridge is WE-layer webcases), so a reuse path needs a contract seam, not a direct import. Likely a `type:decision` (bridge-vs-driver unification) before this builds.

## Resolved 2026-06-20 (batch-2026-06-20-1232-1220-1221) — reachability lowering per #1233-A

The surfaced fork was ratified as decision **#1233 → A (reachability lowering)** (the bridge reuses the one WE-side `ConformanceVector` contract; runtime drive stays FUI per #817/#899). Grounding check before building: the `ConformanceVector` contract is **already WE-resident** at `we:conformance-vectors/schema.ts` (#899/#1016) — the FUI `fui:tools/explorer/oracles/conformanceVectors.ts` is only the *driver* that consumes it — so #1162 builds standalone exactly as #1233 claimed (no WE↛FUI import, no contract extraction needed).

Shipped the case-to-test bridge `we:webcases/caseToVector.ts`:
- **`parseAssertDirective(code)`** — consumes the `<!-- assert: protocol observe tier kind -->` directive `we:webcases/compileRequirement.ts` emits (the "nothing reads it" gap the item named), returning its four facts.
- **`lowerRequirementToVector(record, lookup?)`** — lowers a validated requirement to a minimal **reachability** `ConformanceVector` (#1233-A): a `state` observable → `expect: { reached: <observe> }` read via its platform surface; an `event` → `expect: { fired: <observe> }` read via `events`; never a value (value-equality is the sanctioned follow-up #1235). `steps` replay the requirement's given-precondition then trigger; the new optional `tier` field rides the vector. `kind` resolves from the same injected `lookup` the compiler uses; unknown ⇒ `state` reachability (most-flexible default).
- **Schema:** `we:conformance-vectors/schema.ts` `ConformanceVector` gained the single optional `tier` field #1233 sanctioned.

**Verified:** 49/49 webcases + conformance-vector tests pass, incl. 11 new in `we:webcases/__tests__/caseToVector.test.ts` (directive parse incl. pre-#1201 no-kind + no-directive null; state→reached / event→fired / unknown→state-fallback; steps replay; `assertConformanceSuite` structural validity; a compiler↔bridge round-trip proving the directive and the lowering name the same facts). `tsc` clean for the new files (pre-existing `src/cases/webinjectors/*` fixture-parse errors are unrelated). Graduated to `we:webcases/caseToVector.ts`.
