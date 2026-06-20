---
kind: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:conformance-vectors/schema.ts"
tags: []
---

# WE standards have no conformance-vector suites (0 of 12 implemented) — establish the pattern

L3 conformance check (audit section 10): NONE of the 12 implemented standards (webregistries, webinjectors, webcomponents, webbehaviors, webexpressions, webdirectives, webvalidation, webcontexts, webstates, webguards, webworkflows, webtheme) ships a conformance/vectors suite — only unit tests of the impl. There is no behavioral conformance vector set proving an impl meets the spec, which is the substrate the #899 behavioral-conformance tool is meant to run. Establish the conformance-vectors pattern (schema + per-standard vectors in WE; the runtime driver in plateau/FUI per #899) so 'is this impl conformant' becomes checkable rather than asserted.

## Progress (batch-2026-06-18)

Established the conformance-vectors pattern (was 0 of 12 standards). WE ships the **schema + per-standard
vectors**; the runtime driver stays plateau/FUI per #899 (#817 split · #091 hosted→plateau).
- `we:conformance-vectors/schema.ts` — the `ConformanceVector`/`ConformanceVectorSuite` shape (id, contract,
  timed `steps`, observable `expect` incl. the `neverObserved` temporal guard, `observeVia` surfaces) +
  a dependency-free `assertConformanceSuite` structural validator (the WE half of the KIT's "schema +
  verifier"). Generalizes the `we:wrapper-conformance/` golden-vectors precedent to any standard.
- `we:conformance-vectors/validator-resolution.vectors.ts` — the pattern-establishing exemplar suite,
  lifting #899's canonical temporal vector (`stale-async-dropped`) verbatim + 2 more (single-async-applied,
  cancellation/superseded-generation-abandoned). Judges only the observable surface, never impl internals.
- `we:conformance-vectors/index.ts` — exports + the `conformanceSuites` registry the driver enumerates.
- `we:conformance-vectors/__tests__/schema.test.ts` (7 green) — exemplar passes the schema; validator
  rejects empty/duplicate-id/no-`do`/no-`observeVia` corpora.
- Registered the dir in `we:vitest.config.ts`. The remaining 11 standards' suites are the #1042 backfill.
