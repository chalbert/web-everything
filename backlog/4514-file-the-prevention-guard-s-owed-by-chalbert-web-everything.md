---
bornAs: xvprtq3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "42f196507bc96376405269b0b7b192e31777eab7"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2969's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` — Add deterministic CLI coverage with fresh positive and negative cached verdicts: bypass ignores both, refreshes at most two pending IDs per tick, rotates through the stale population, persists successful fresh results, and replays them on a later ordinary tick. Preserve unrelated cache entries. See the premise correction below.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2969@8463550d6c465421ffda6fc27904cd2ee6d97f9c

## Progress

Preparation research found factual drift; the prevention goal remains seeded-cache bypass regression coverage.

- **Old premise/scope:** the cited test at line 163 was expected to prove all stale IDs are queried inline, fresh results affect that invocation, and bypass leaves the whole store unchanged. Scope was the single integration test file.
- **Corrected premise/scope:** commit `230098d70c6e0e3cdd602f1268c8610f2a416f46` replaced inline enrichment with bounded background refresh. Bypass skips cache reads, not worker writes; successful results affect a subsequent non-bypass tick. Every eligible unknown ID is reached across successive settled refreshes, not within one invocation. Scope remains test-only in `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs`; its local fixture helpers can change in the same file. No production source edit is required or included, so no source/test pairing is missing from scope.
- **Evidence:** `we:scripts/readiness/dispatch-plan.mjs:901` begins the local-first enrichment; the bypass condition at line 919 suppresses cached verdicts and line 932 starts background refresh. `we:scripts/readiness/already-done-refresh.mjs` defines the two-check ceiling, round-robin selection by attempts, and successful cache writes in `refreshAlreadyDone`. `we:scripts/readiness/already-done-cache.mjs` merges checked verdicts while preserving other entries.
- **Remaining gap:** `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs:142` starts bypass coverage with an empty store and also sets negative cooldown to zero. The positive replay test starts at line 154; the old line 163 citation now points inside that different test. Neither tests bypass against fresh positive AND negative seeds with normal cooldowns. The existing guard therefore does not deliver this item's corrected goal.

- **Observed baseline:** the targeted Vitest run of `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` passed all six existing tests during preparation. This establishes the current baseline, not coverage of the missing seeded-bypass case.

## Design

Extend `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` using its real CLI, local shallow git repository, fake GitHub host, isolated cache, and refresh-lock settlement helpers. Parameterize the fixture locally to create two ready IDs (8000, 8001) and two blocked/not-ready IDs (8100, 8101), retaining current defaults for existing tests. Shallow history deliberately prevents local negative evidence from short-circuiting the network scenario.

Seed fresh positives for 8000 and 8100 and fresh negatives for 8001 and 8101, with normal positive and negative cooldowns explicitly supplied to avoid inherited environment overrides. Add an unrelated sentinel cache entry outside the fixture queue. Use valid merged PR responses for 8001 and 8101 and no matches for 8000 and 8100: fresh results deliberately reverse both signs in both populations. The existing host can return both PRs; production title filtering selects the matching ID. Include matching numeric titles, merged state, implementation branch names, URLs and non-documentation changed-file metadata accepted by `we:scripts/operations/dispatch-lane-io.mjs`'s `filterAlreadyDoneCandidates`.

Invoke the CLI through `fixtureRun` with `--no-already-done-cache`. Assert `groundTruth.cached` is zero, all four IDs remain pending with shallow history, and neither seeded positive creates an `already-done` hold. After each invocation await `waitRefresh` before inspecting calls or cache state. Two successive bypass ticks must select two disjoint pairs and make exactly one metered search per fixture ID overall. Refreshed results are persisted even in bypass mode; retain the sentinel exactly and preserve unselected entries until their refresh occurs. Run a final ordinary tick to prove the new positives hold both ready and not-ready rows, the former positives lose their already-done holds, and no further search is needed. Other readiness holds are allowed: absence of `already-done` does not imply dispatch eligibility.

No new interface, schema, policy or migration is involved. Deliver as one test-only change; retained size 3 covers asynchronous fixture orchestration and mutation proof.

## MVP

1. **Must 1:** Seed genuinely fresh positive and negative verdicts for both ready and not-ready populations, plus an unrelated sentinel; use normal nonzero cooldowns.
2. **Must 2:** Prove bypass ignores both signs and preserves the two-search ceiling while successive settled ticks cover every eligible fixture ID exactly once.
3. **Must 3:** Prove successful refresh overwrites selected verdicts, preserves unselected/unrelated entries, and an ordinary subsequent tick applies the reversed results to both populations without new searches.
4. **Must 4:** Retain existing integration coverage and isolate all subprocesses, throttle state, git fixtures and cache files; await refresh settlement before cleanup even on assertion failure.

## Done when

1. Musts 1–3 are asserted by a named seeded-bypass regression in `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs`, including exact queried-ID sets and cache contents rather than only total call counts.
2. Must 4 and the full targeted suite pass. From the WE checkout, run `npx vitest run` with `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` as the target (strip the `we:` repository marker for the shell argument).
3. The new regression fails when the bypass cache-read suppression is removed, then passes after restoring production code; record the failing assertion and restored passing command. This is a test-debt item: unchanged production code should already satisfy the new assertions, so an unmodified-before/after red-to-green claim would be misleading.

## Test plan

Implement the fixture sizing and seeded scenario in the scoped test file, then run its full Vitest suite. Verify fresh timestamps through `getCachedVerdict` from `we:scripts/readiness/already-done-cache.mjs` or equivalent explicit freshness assertions before invoking the CLI. Parse the fake host's actual GraphQL search arguments to compare queried IDs against each reported refresh pair and the complete four-ID set. Inspect cache JSON only after lock settlement; compare verdict signs and PR identities and verify timestamps remain valid. Compare untouched entries deeply, rather than requiring byte-identical whole-file serialization after a legitimate write.

Use contradictory seeds/results to expose accidental replay. Avoid timing sleeps as correctness evidence, external GitHub, real conveyor state, or assumptions that worker results appear in the initiating plan. Keep the existing large-queue and zero-cooldown tests.

## Proof plan

During implementation, capture the new named test passing on the actual CLI. Temporarily remove only the bypass conditional in `we:scripts/readiness/dispatch-plan.mjs` so fresh cache entries are read despite the flag; the seeded regression must fail on cache count, pending count or stale positive holds. Restore immediately. Separately suppress the cache write in `we:scripts/readiness/already-done-refresh.mjs`; the new regression must fail on refreshed cache contents or subsequent replay. Restore immediately; these mutation targets are proof-only and must not enter the delivered diff.

Record the failing assertions and final clean targeted-suite result. Runner-owned preparation checks and independent parked review remain separate from this implementation proof; this preparation does not stamp or claim build completion.

## Follow-ups

None required for the corrected prevention guard. Restoring all-ID inline queries or read-only bypass storage would change the currently shipped contract and is outside this test-only story. If implementation reveals a production defect, report the exact failed invariant and amend scope with matching source/test paths before changing production behavior.
