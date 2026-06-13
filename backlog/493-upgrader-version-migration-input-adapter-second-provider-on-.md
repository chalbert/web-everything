---
type: issue
workItem: story
size: 3
parent: "097"
status: resolved
blockedBy: ["491", "492"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Upgrader version-migration input adapter — second provider on upgraderEngine, verifyUpgrade-gated

Build slice (c) of the ratified #191 version-migration upgrader (Fork 1A). Wire the version-migration kind as a SECOND provider into the upgrader's devtools provider seam (NOT a runtime registry — see #191's reframe): an input adapter that consumes already-conformant source + a changelog-manifest delta, drives the planner (slice a) → declarative interpreter (slice b) → existing `verifyUpgrade` gate, so migrated call sites are only offered when they re-parse, round-trip, and conform. One engine, two input adapters (legacy→standard from #094, version→version here), no second tool, no drift. Blocked on a (plan) + b (interpreter). Align with the analyzer-seam cleanup if that lands first.

## Progress

Resolved 2026-06-13 — slice (c) built as
[analyzers/versionMigration.ts](../blocks/renderers/upgrader/analyzers/versionMigration.ts), completing
the #191 version-migration trio (a=#491 planner, b=#492 interpreter, c=#493 this).

**Second input adapter on one engine.** `makeVersionMigrationAnalyzer(config)` /
`registerVersionMigrationAnalyzer(registry, config)` register a `CustomAnalyzer` (id `version-migration`)
into the engine's devtools analyzer seam, beside #094's legacy→standard reference analyzer. It claims
input tagged `language: 'version-migration'`. Its `analyze()`:

1. `parseDefinition(input.code)` — the source is an already-conformant `<component>`; lift name/shadow/template.
2. `planVersionMigration(...)` (slice a) → ordered, intermediate-spanning plan.
3. `applyMigrationPlan(templateHTML, plan, { codemods })` (slice b) → migrated template.
4. Return the neutral `ComponentIR` → the engine's existing `generateComponentSource` + **`verifyUpgrade`**
   gate offers it only when it re-parses, round-trips, and conforms.

One engine, two input adapters (legacy→standard, version→version), no second tool, no drift.

**Flag, don't fake.** Throws (→ `offered: false` diagnostic) when the plan can't reach target, an
imperative codemod is untrusted/missing, or a `retire-provider` has no replacement. A benign no-match
(a transform whose attribute this component doesn't use) is not a failure; a soft warning (value moved
verbatim) surfaces as a note but still offers. Aligned with #494's analyzer-seam cleanup — the registry
is caller-owned and injected (no global).

Gate: `check:standards` green; 4 new unit tests pass (full renderer suite 634 green, 2 skipped). The
#494/#492/#493 cascade closed the version-migration build-out under #097.
