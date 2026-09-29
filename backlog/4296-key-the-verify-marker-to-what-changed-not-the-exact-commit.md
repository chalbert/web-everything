---
bornAs: xsndck6
kind: story
size: 3
status: resolved
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Key the verify marker to what changed, not the exact commit

Today we:scripts/verify-lane.mjs's marker is keyed to the exact HEAD sha (readVerifyMarker/verifyGateDecision in we:scripts/lib/lane-verify.mjs; the finish-write compare-and-set in we:scripts/verify-lane.mjs) — any new commit on the lane, including a no-op merge of origin/main, invalidates the green marker and forces a fresh full run. Evidence: a mid-work merge of main (#2818/#2819 landing meanwhile) forced a re-run even though it conflicted only on we:scripts/operations/ci-heal-pr-dispatch.mjs, a file outside the lane's own touch-set. Change the marker's validity key from exact-sha to no-lane-relevant-file-or-affected-test changed since the marker was recorded, reusing the same changed-file/affected-test computation we:scripts/lib/verify-lane-gate.mjs's resolveDefaultGate already derives for gate selection, so a merge touching none of those files keeps the marker green while a genuinely overlapping merge still forces a re-run. Must stay safe for we:scripts/pr-land.mjs's finish-guard (#3321): it must still refuse to land on a marker whose recorded sha predates a real overlapping change.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/lib/__tests__/verify-lane-gate.test.mjs we:scripts/__tests__/lane-verify.test.mjs we:scripts/__tests__/pr-land.test.mjs we:scripts/__tests__/verify-lane.test.mjs we:scripts/__tests__/pr-land-finish-guard.test.mjs`
   passes, including two real-git integration suites that reproduce the exact bug — a real merge commit
   conflicting only on a file outside the lane's own touch-set — and show the marker still reads `green` for the
   new HEAD, a counter-case proving a genuinely overlapping merge still forces `unverified`, AND a lane-side
   REVERT of its own already-verified edit (found by an independent red-team, see Progress) still forcing
   `unverified` too: `we:scripts/__tests__/verify-lane.test.mjs` (the `check` CLI end to end) and
   `we:scripts/__tests__/pr-land-finish-guard.test.mjs` (`resolveFinishGuardVerdict`, the function
   `we:scripts/pr-land.mjs`'s finish-guard actually calls, added at converge round 1 once source-regex-only
   coverage of the landing path was flagged). RED (stash the four implementation files, keep every test file):
   25 failed / 250 passed. GREEN (restore the implementation): 275/275 passed.

## Progress
- 2026-09-29 — Implemented. Added `laneRelevantChangeSince` (`we:scripts/lib/verify-lane-gate.mjs`) — reuses the
  same base-diff shape `resolveDefaultGate` derives for gate selection — and threaded it into
  `verifyGateDecision`'s `matches` test (`we:scripts/lib/lane-verify.mjs`) as an optional param that promotes a
  stale-sha record to a match only when the computed overlap is an empty array (`undefined`/`null` still fail
  closed to the pre-existing exact-sha behavior). Wired both `we:scripts/verify-lane.mjs` call sites (bare
  `check`, and `check --wait=` via a new `resolveLaneRelevantChangeSince` callback on `waitForVerifySettle`) and
  `we:scripts/pr-land.mjs`'s finish-guard — all three now go through ONE shared guard+compute wrapper,
  `laneRelevantChangeSinceForRecord`, and pass `base` explicitly (`origin/main` in `we:scripts/verify-lane.mjs`,
  `${REMOTE}/${BASE}` in `we:scripts/pr-land.mjs`, so a POC branch target is handled correctly too) rather than
  relying on either side's own default.
- 2026-09-29 — `/converge` (elevated care, 5-lens panel: correctness, security, simplicity,
  standards-conformance, claim-accuracy). Round 1 (7 findings, all carve-out/nit) drove: extracting
  `we:scripts/pr-land.mjs`'s finish-guard into the directly-testable `resolveFinishGuardVerdict`, a new real-git
  behavioral test for it (`we:scripts/__tests__/pr-land-finish-guard.test.mjs`), and deduplicating the "is this
  record even worth comparing" guard from three independent copies into one
  (`laneRelevantChangeSinceForRecord`). Round 2 (9 findings, all carve-out/nit) drove: rejecting a non-hex
  `recordSha`/`headSha` before it reaches `git` as a positional revision argument, adding a trailing `--` to
  every `git diff --name-only` call, removing the one remaining partial guard copy in `waitForVerifySettle`,
  passing `base` explicitly everywhere, and fixing this card's own Done-when to name every test file the change
  added — this round reached `accept` on all 5 lenses. The independent RED-TEAM that ratifies an accept then
  found a genuine BLOCKER (introduced, worse-than-base, NOT parallelizable — the one combination that earns a
  round): filtering `changedSinceRecord` against only `diff(base, headSha)` (the lane's touch-set AT `headSha`)
  missed a lane-side REVERT of its own already-verified edit — a file the lane edited (and was verified)
  reverted back to `base`'s content in a later lane commit drops out of a `headSha`-only relevance check even
  though the revert itself was never run through the suite. Fixed by unioning in `diff(base, recordSha)` too (a
  file relevant at EITHER end stays relevant), with a real-git regression test
  (`we:scripts/__tests__/verify-lane.test.mjs`). The remaining findings across both rounds and the red-team are
  carve-out/nit (real-but-not-blocking) with a named test/doc already added in response, except ONE documented
  accepted limitation: "lane-relevant" follows the lane's own diff against `base`, not the import/dependency
  graph, so a merge that changes a file the lane's code imports (but never edited) can carry a stale green
  forward; this is not a regression against the pre-#4296 base (which was no safer for that shape either) since
  the required CI check still runs the full suite regardless, and closing it fully means intersecting with
  `resolveDefaultGate`'s own `vitest related` targets — a genuine follow-on feature, not a fix, and left as such
  in `we:scripts/lib/verify-lane-gate.mjs`'s own doc comment on `laneRelevantChangeSince`.
- 2026-09-29 — A third `/converge` panel pass (post revert-fix) found zero correctness findings and no
  blockers; the remaining cosmetic/nit findings — a JSDoc block that had drifted onto the wrong symbol
  (`HEX_SHA_RE` instead of `laneRelevantChangeSince`, from inserting the constant mid-block), a stale
  `waitForVerifySettle` doc comment still claiming the resolver is called "ONLY when the sha differs" after
  round 2 removed that guard, a malformed `{@link}` tag, an inaccurate "not a regression against base" claim
  (corrected to state plainly that the LOCAL gate is looser than before and the required CI check is what makes
  that safe), and dead code (`void main;`, an unused import) in the new test file — were all fixed directly.
