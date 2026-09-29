---
bornAs: xulvi8k
kind: story
size: 8
parent: "4075"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "9d8fb472100e9bd306aab625fd0863f2767a2d3a"
tags: []
---

# Drain pass: dedupe the context vs candidate PR listing (double gh pr list per repo)

Investigating we:xNNN (why the drain pass is slow) found a real, evidenced double network cost in we:scripts/merge-ai-prs.mjs's sweepOnce(): whenever RECONCILE is on (true on every resident-daemon pass — it always passes --label=ready-to-merge), collectContext() already runs an UNSCOPED gh pr list --json number,title,body,labels,statusCheckRollup,headRefName,headRefOid across every constellation repo (the label/only-blind open-PR context), and then the very next step runs a SECOND, --label-scoped gh pr list --json number,title,body,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,labels across the SAME repos for the candidate set — two full gh pr list round-trips per repo per pass where one (widened to the superset --json field list) would do. NOT a safe drop-in: classifyPr's own certified = certifyLabel || aiGenerated || humanCleared means simply removing the server-side --label filter and reusing the unscoped context listing verbatim would let an AI-generated-but-unlabelled PR (one pr-land --label-on-green has not yet confirmed green) enter the candidate set — a real regression of the CI-gate the ready-to-merge label enforces. A correct fix reuses collectContext()'s already-fetched openPrContext.prsByRepo (widening its --json fields to the candidate superset, which is free on the same call) and re-applies the --label/--base match CLIENT-SIDE with the exact same semantics gh's own --label/--base flags have, verified against we:scripts/merge-ai-prs.mjs's existing narrowPrsByRepo/buildDrainVerdicts test suites (9 files, ~530 tests) plus new tests pinning the client-side label/base filter to gh's semantics. Scoped out of we:xNNN itself for lack of session budget to verify it as rigorously as a correctness-critical listing/certification path deserves; do this ONLY with real before/after pass-timing evidence (from we:xNNN's new result.timings) showing 'listing' actually dominates a real pass — don't guess.

## Design

`sweepOnce()` ran two SEQUENTIAL `gh pr list` round-trips per repo per pass whenever RECONCILE was on:
`collectContext()`'s own call (label/only-blind, `CONTEXT_LIST_FIELDS`), then `listOne()`'s candidate-set call
right after it (`CANDIDATE_ONLY_FIELDS`, already client-side label-filtered per #no-label-search). The fix widens
`listOne`'s `--json` to `SWEEP_LIST_FIELDS` (the union) ONLY while RECONCILE is on, moves that fetch ahead of the
context computation, and feeds the raw, pre-filter rows (`buildLiveListingsByRepo`) into `collectContext`'s
`listOpenPrs` for every repo in the sweep's own `REPOS` — one live `gh pr list` instead of two. `--base` (like
`--label`) is now matched CLIENT-SIDE (`filterOpenPrsByBase`), never passed to `gh` on this call, so the raw page
stays label- AND base-UNFILTERED — required because the reused rows must serve the context's documented
label/base-BLIND, constellation-wide carrier visibility (#2421) for the couple gate. A repo in `CONTEXT_REPOS`
but not `REPOS` (a narrowed `--repos`/`--this-repo` sweep's extra constellation-context repos — a no-op on the
common full sweep) is unaffected — it still falls through to the original shared-snapshot-or-live read.

## MVP

- Reuse the candidate listing's raw rows for the context (RECONCILE on, repo ∈ REPOS) — the one `gh pr list` cut.
- Client-side `--base` match (`filterOpenPrsByBase`), mirroring `--label` — a real correctness fix a converge
  round caught: a server-side `--base` on the reused call would have silently narrowed the base-blind context.
- Field widening gated on RECONCILE (`SWEEP_LIST_FIELDS` vs `CANDIDATE_ONLY_FIELDS`) — never pay the extra
  context fields on a bare, unlabelled sweep that has no reuse to spend them on.
- `buildLiveListingsByRepo` extracted + unit-tested so the "context gets `rows`, never `prs`" guarantee is
  pinned independently of the CLI-level call-count tests.
- Test coverage: `gh pr list` call-count (1 vs the old 2) at the CLI level, label/base candidate-filter
  correctness (unaffected by the reuse), the truncation/degraded check (`isDegradedOpenPrListing`) still fires
  identically whether `listOpenPrs` returns fresh or reused rows, and the RECONCILE-off field list staying
  unwidened.
- OUT of MVP (filed as a follow-up, not built here): an end-to-end couple/carrier integration test proving
  `listOne`'s REAL return (not a hand-built stub) reaches the couple gate's `held`/`deferred` decision — see
  Follow-ups.

## Test plan

Every test in `we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs` fails RED against the pre-fix code
(verified live — see Proof plan) and passes GREEN after: the CLI-level `gh pr list` call-count tests (1 vs the
old 2 per pass), the `SWEEP_LIST_FIELDS` widened-field-set test, the label/base candidate-filter correctness
tests, the RECONCILE-off unwidened-field test, the truncation/degraded-check tests (direct `collectOpenPrContext`
unit tests + a CLI-level 500+-PR escalation test), and the `buildLiveListingsByRepo` rows-vs-prs unit tests.

## Proof plan

Live before/after: `git stash` the source fix (keeping the new test file), run the dedupe test suite against
the UNMODIFIED pre-fix `we:scripts/merge-ai-prs.mjs` — 4 of 5 tests fail (`gh pr list` called twice per pass, 4
times across the 2-pass label-lag-repoll scenario); `git stash pop` restores the fix, same suite green (see PR
body for the captured run output). Plus: `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest
related we:scripts/merge-ai-prs.mjs we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs --run
--passWithNoTests` green (177 files / 8217 tests), and `check:standards` green via `we:scripts/verify-lane.mjs`.

## Follow-ups

- **we:xejvuqt** (blockedBy #4108) — add an end-to-end integration test proving a REAL cross-base or unlabelled
  carrier PR (via `listOne`'s actual return, not a hand-built stub) stays visible to the reused RECONCILE
  context through the couple gate's `held`/`deferred` verdict. Surfaced repeatedly by independent converge
  panel/red-team rounds as a real but parallelizable gap (never a blocker per the loop's own disposition rule),
  since `openPrContext` has no other externally-observable surface short of a full couple/manifest fixture.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run
   we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs` fails on the pre-fix `we:scripts/merge-ai-prs.mjs`
   (the `gh pr list` call-count assertions redden — 2 calls per pass, not 1) and passes once the fix lands.
