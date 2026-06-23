---
kind: story
size: 5
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/declared-rules/"
tags: []
---

# Per-app declared-rule registry + rule-to-conformance-vector linkage

Foundational substrate for the dev-browser conformance cluster: expose each app's declared conformance/visibility/validation rules as an enumerable per-app registry, and link each declared rule to the conformance vector(s) that exercise it (the @webeverything/conformance-vectors corpus already exists; the neutral runner is plateau:src/conformance-engine). Un-gates the standard-aware review assistant (#1640) and the declared-rule to test-coverage gap surfacer (#1641): #1640 reads the registry to judge a diff, #1641 computes coverage = rules-with-a-run-vector over all-declared-rules.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built the substrate as a new dev-browser module `plateau:src/dev-browser/declared-rules/`, mirroring the
forge/ide-bridge module convention (types + registry + index + test):

- **`plateau:src/dev-browser/declared-rules/types.ts`** — `DeclaredRule`
  (`kind: conformance|visibility|validation`, `contract`, optional `tier`, optional explicit `vectorIds`),
  `AppDeclaredRules` (per-app unit), `VectorIndex` (the corpus join key), `RuleVectorLinkage`, and
  `AppRuleCoverage` (the #1641 fraction made concrete).
- **`plateau:src/dev-browser/declared-rules/registry.ts`** — `DeclaredRuleRegistry`: per-app
  `register`/`rules`/`allRules` (the #1640 enumerable read), `linkage(appId, index)`, and
  `coverage(appId, index)` (`covered/total`, `1` when no rules — never `NaN`, uncovered rules named).
  `linkRuleToVectors` is the single linkage rule: explicit `vectorIds` authoritative (stale ids dropped),
  else contract-join narrowed by `tier` (tier-agnostic vectors always match).
- **`plateau:src/dev-browser/declared-rules/index.ts`** — public surface + `buildVectorIndex(suites)`, which
  projects WE-owned `ConformanceVectorSuite`s into the `byContract` map + id set. Registry is **decoupled**
  from the corpus: linkage takes the index, so plateau imports no new WE alias to use it (the forward edge
  holds — the test joins against the real `presentationA11ySuite`).
- **`plateau:src/dev-browser/declared-rules/declared-rules.test.ts`** — 9 tests, all green; linkage
  exercised end-to-end against the real `@webeverything/conformance-vectors/presentation-a11y` corpus plus
  synthetic tier/explicit-id/stale-id edges.

Un-gates #1640 (reads `registry.rules(appId)` to judge a diff) and #1641 (`registry.coverage(appId, index)`
= rules-with-a-run-vector over all-declared-rules). No real app declares rules yet — the substrate ships the
registry + linkage; app rule declarations land with their consumers.

**Gate note (not this changeset):** `npm test` shows one pre-existing red — `plateau:src/render-conformance.test.ts`
flags `plateau:src/conformance-engine/conformanceVectors.ts` as an untracked render-surface (density 0). That
file is committed by #1597 (a679bcb) and missing from the render-conformance baseline; it is independent of
this module (my files aren't flagged as surfaces, my 9 tests pass). Stepped over per the batch stop-rule's
external-red diagnosis; the baseline-staleness belongs to #1597/#1280, not here.
