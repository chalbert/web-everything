---
kind: task
parent: "005"
status: resolved
blockedBy: ["266"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: capability-manifest/fixtures.ts
tags: []
---

# Partial-implementation validation conformance fixtures

Author partial-implementation test fixtures — impls that declare a subset of features in their capability manifest (#266) — so the build-time check, runtime guard, and report format can all be exercised against known out-of-capability cases. The shared fixture base for the other slices.

## Progress

**Resolved 2026-06-10.** Authored the shared fixture base at
[we:capability-manifest/fixtures.ts](../capability-manifest/fixtures.ts) (re-exported from the
`capability-manifest` barrel), consuming the #266 model. Two sets:

- **`CAPABILITY_FIXTURES`** — 7 valid-manifest scenarios, each pairing a contract-valid manifest with
  the features a consuming app *uses* and the pinned **out-of-capability** diff (`used − declared`):
  fully-in-capability (L2 rich + L1 Core-only), single out-of-capability (`async`), multi
  out-of-capability (`async`+`cross-field`+`conditional`), an L2 reaching past its declared optionals
  (`schema`), and the L0 render-only tier in two shapes (compliant + overreach into `control-validity`).
- **`INVALID_MANIFEST_FIXTURES`** — 6 reject-path values `assertCapabilityManifest` must throw on
  (L1 missing a Core feature, malformed `specVersion`, unknown feature id, bad conformance level,
  `concerns` not a record, non-object).
- **`outOfCapability(manifest, used)`** — the canonical `used − declared` diff (via `manifestSupports`)
  defined once here with the fixtures, so #267/#268/#269 share one definition rather than re-deriving it.

A self-consistency suite ([we:__tests__/fixtures.test.ts](../capability-manifest/__tests__/fixtures.test.ts),
6 tests) asserts every valid fixture's manifest passes `assertCapabilityManifest`, each pinned
`expectedOutOfCapability` equals the computed diff, every invalid fixture is rejected, the base covers
both in- and out-of-capability shapes, and names are unique. All 21 capability-manifest tests pass;
gate green. Unblocks #268 (guard) and #269 (report) — both batched next.
