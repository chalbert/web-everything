---
bornAs: xvwin4v
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/readiness/test-selection.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/verify-lane.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Docs-only changes run the full local test suite: give backlog and memory diffs a sound narrower run

FOUND 2026-09-20. Verifying a markdown-only change with node we:scripts/verify-lane.mjs runs the whole unit suite: the saved verify logs show 509 test files and 14,171 passing tests, taking 318 to 323 seconds in wall time (the operator recalled roughly 3 minutes), and the host sampler recorded load1 of 19 to 36 during those runs (last-hour p50 6.2, p90 19.0, max 36.2, mostly test runs). Diff-driven selection ALREADY EXISTS: we:scripts/readiness/test-selection.mjs (backlog 2681, off by default in CI, shadow-measured by the CI job test-selection-measure) and we:scripts/lib/verify-lane-gate.mjs already defaults it on for the local gate. It does not help a backlog-only or memory-only diff for two confirmed reasons: its deny-by-default allow-list (SHRINK_ALLOW_LIST) covers only docs/, research/ and test files, so backlog/ and the memory sources are not shrinkable; and backlog/ is in GLOB_FIXTURE_ROOTS, the roots the unit suite discovers by directory rather than by import, where the static import walk of vitest related is blind, so any change there forces the full suite by design. So the gap is not a missing selector, it is that the two surfaces we change most (backlog cards, memory) have no sound narrower answer. DESIGN: name the suites that genuinely read backlog/ and the memory sources by directory (the glob-discovered ones), run only those plus the gates that read them (locus-prefix lint, backlog standards, check:standards scoped to the changed files), and skip the rest, with a proof step so the selection can never skip a suite the diff could break. DESIGN TO SETTLE: (1) how the directory-reading suites are listed and kept current (derive by scanning for backlog/ reads, or an explicit registry with a test that fails when a new test reads the directory unlisted); (2) the proof step, for example run the full suite in CI shadow on every such diff and record any failure outside the selected set through the existing false-green record; (3) the memory files: which suites read them; (4) how this extends we:scripts/readiness/test-selection.mjs instead of forking it, and what the deny-by-default rule says about a diff that mixes backlog cards with anything else (the whole diff must be in the narrow class, otherwise full). Ties to the limits story 3737 (admission attribution): local runs are a large share of measured load. Related, not the same: backlog 3751 (environment-only failures turn docs-only verifies red). ACCEPTANCE: a diff that touches only backlog cards runs the listed directory-reading suites and the two gates, in under a third of the current wall time, and a diff that adds any file outside the class runs the full suite; a test fails if a test file that reads backlog/ by directory is missing from the list; a fixture proves a card with a bad locus prefix still fails the gate under the narrow run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
