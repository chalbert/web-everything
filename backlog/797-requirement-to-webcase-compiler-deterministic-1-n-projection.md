---
type: idea
workItem: story
size: 5
parent: "099"
status: resolved
blockedBy: ["100"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: webcases/compileRequirement.ts
tags: [requirement-as-code, webcases, conformance, compiler, evergreen]
relatedProject: webcases
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code slice A (#100)" }
---

# Requirement-to-webcase compiler — deterministic 1:N projection of a typed requirement record into webcases

Slice B of requirement-as-code ([#100](/backlog/100-requirement-as-code/)): a deterministic compiler that projects a typed requirement record (the #100 slice-A schema) into one-or-many webcases — the **compile-to** relationship ratified in [#714](/backlog/714-requirement-meta-schema-bdd-like-format-relationship-to-webc/) fork 2. WE-resident and dependency-free (the `we:webcases/driftCheck.ts` pattern); the AI test-generator for non-compilable requirements is a separate Plateau-served provider ([#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) no-leakage). Demoable: a fixture requirement compiles to a webcase. Blocked on #100 (the schema).

## Build

- A deterministic `we:webcases/compile-requirement.ts` that takes a validated requirement record (the #100
  slice-A type) and emits **one-or-many** webcase artifacts — the 1:N projection: one requirement's
  `then` observables can imply several machine-checkable checks.
- The emission target is a `webcases/`-shaped artifact in the existing suite's style (the pure,
  dependency-free `we:webcases/driftCheck.ts` is the precedent for the artifact shape). The **exact
  emitted-webcase format** is a slice-B authoring detail, not a fork — #714 fork 2 already ratified that
  requirements compile *to* webcases and the suite stays the single machine-checkable target.
- Compiles only the typed, registry-grounded subset (deterministic); requirements that don't ground are
  the **AI test-generator's** domain — a Plateau-served provider, **out of scope here** (no-leakage).

## Acceptance

A fixture requirement record compiles to the expected webcase(s); the compile is deterministic (same
input → same output) and dependency-free. Fixture-driven demo per the Definition of Done.

## Sequencing

Blocked on **#100** (slice A — the schema this compiler consumes). The format-interop adapter
([#794](/backlog/794-gherkin-ears-interop-adapter-for-requirement-as-code-emit-de/)) sequences after the
#100 impl exists, alongside this.

## Progress (resolved 2026-06-16) — cascade-freed by #100 in batch-2026-06-16
- New [`we:webcases/compileRequirement.ts`](../webcases/compileRequirement.ts) (pure, dependency-free, the `we:driftCheck.ts` pattern): `compileRequirement(record): WebCase[]` projects a #100 `RequirementRecord` into the in-memory webcase shape `{ id, title, description, code }` that `we:src/_data/cases.js` parses — a `WEB CASE` header carrying the typed Given/When/Then (`Given validation.execution = blur` / `When Commit Policy` / `Then validation observes invalid-state-announced at L1`) plus a machine-readable `assert: protocol/observe/tier` line.
- **Deterministic** (same record → byte-identical output, no I/O/clock) and **1:N-ready**: the projection maps over the record's `then` outcomes (slice-A schema carries one → compiles 1:1; the array return + per-outcome fan-out keep multi-outcome records 1:N). `slugify` gives stable ids.
- Out of scope (per #714): non-grounding requirements are the AI test-generator's domain (Plateau-served, #475).
- Tests [`we:webcases/__tests__/compileRequirement.test.ts`](../webcases/__tests__/compileRequirement.test.ts) (5/5) using the #714 worked example: the typed scenario emits, the compile is deterministic, the return is an array, and a changed outcome (tier L1→L2) reflects with no stale projection. `tsc --noEmit` + `check:standards` clean.
