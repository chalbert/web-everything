---
type: idea
workItem: task
parent: "005"
status: resolved
blockedBy: ["266"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: capability-manifest/report.ts
tags: []
---

# Validation adherence report format

Define the adherence report format that the build-time check (and runtime guard) emit — which declared features an implementation honours, which usages fell out of capability — so conformance is a readable artifact, not just a pass/fail. Consumes the #266 manifest.

## Progress

**Resolved 2026-06-10.** Authored the report format at
[capability-manifest/report.ts](../capability-manifest/report.ts), re-exported from the
`capability-manifest` barrel. The format makes conformance a *relationship*, not pass/fail:

- **`AdherenceReport`** — structured, partitioning declared-vs-used into four buckets a reader cares
  about: **honoured** (declared & used — what the impl actually backs here), **unused** (declared, not
  exercised), **outOfCapability** (used, not declared — the #266 reportable case, via the shared #270
  diff), plus **missingCore** (manifest-level Core defect at L1+, #266 OP-18) and the headline
  **conformant** flag. Order-preserving (declared order / used order) so the artifact is diff-friendly.
- **`buildAdherenceReport(manifest, used)`** — the pure data transform both #267 and #268 emit.
- **`formatAdherenceReport(report)`** — plain-text rendering: a headline conformance line
  (`✓ in capability` / `✗ N out of capability`), the three usage buckets (ids shown short, prefix
  stripped for display while staying canonical in the data), and a `⚠ manifest defect` line when an
  L1+ claim is missing Core features.

Pure data → report (no I/O, no dev/prod gating — that's the guard's concern). Tests
([__tests__/report.test.ts](../capability-manifest/__tests__/report.test.ts), 6): the four-bucket
partition, the Core-defect flag, the conformant case, the rendering of both headlines + the defect
warning, and parity of `report.outOfCapability` with every #270 fixture's pinned diff. All 33
capability-manifest tests pass; gate green. This completes the agent-ready slices of #005's validation
spec-versioning epic that depend on #266 (the model), #270 (fixtures), #268 (guard), #269 (report);
the build-time check #267 remains.
