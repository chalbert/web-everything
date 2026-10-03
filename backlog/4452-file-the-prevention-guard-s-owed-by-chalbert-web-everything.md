---
bornAs: xwohax9
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/pool-leftovers.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2866's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/pool-leftovers.test.mjs:45` — Assert the classification `reason` (or stub `readLiveCwds`) in IO integration tests so a keep or delete cannot come from an unrelated rule. A lint or review-lens item is enough.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2866@82e5d7ec5dd0f77863fcde0a3b99a5b4259f5481

## Progress

- Premise check (2026-09-30, against `origin/main` bc9db934c): not delivered. `git log` shows no commit for #4452 / `4452` beyond the JIT-numbering one; the test file's last change is 82e5d7ec5 (#4272), and it still asserts only `action` (`we:scripts/lib/__tests__/pool-leftovers.test.mjs:51`, `:71`) and never `reason`, and never stubs `readLiveCwds`.
- Citation drift: the card cites `:45`, which is now the "age the directory" comment inside the first test (`:44-46`); the actual defect sites are the two assertions at `:51` and `:71`. Scope (`we:scripts/lib/__tests__/pool-leftovers.test.mjs`) is correct as-is.

## Design

`sweepPoolLeftovers` (`we:scripts/lib/pool-leftovers.mjs:80`) calls the real `readLiveCwds()` (`:84`, `we:scripts/lib/lane-salvage.mjs:178`, a live `lsof`). Both IO tests run against that real process table, and `live()` (`:85`) returns `true` for EVERY path when `lsof` is unreadable (`cwds === null`). `classifyPoolLeftover` then returns `keep` / `'a live process has its cwd inside'` (`:38`) before it ever reaches the mtime rule (`:40`). So the first test's `expect(action).toBe('keep')` (`:51`) can pass because of the live-cwd rule, with the #4272 nested-mtime recursion deleted — the guard it claims to be isn't one. The second test is the mirror image: a stray live cwd (or null `lsof`) flips `delete` to `keep` and fails for an unrelated reason.

Fix, test-file only:
1. Partially mock the `lane-salvage` module with `vi.mock` (relative import from the test; hoisted, so the named import in `pool-leftovers` gets the stub; precedent: `we:scripts/lib/__tests__/nnn-collision-heal.wiring.test.mjs:12`) as `async (orig) => ({ ...(await orig()), readLiveCwds })`, where `readLiveCwds` is a `vi.hoisted` `vi.fn(() => [])`. An empty list means `pidsWithCwdIn` finds no live process, so the live-cwd rule can never fire. Everything else (`pidsWithCwdIn`, salvage helpers) stays real; the `vi.fn` can be set per-test for the mutation proof.
2. Assert the classification `reason` in each test: keep case `toMatch(/^touched -?\d+\.\dd ago \(< 7d\)$/)` — negative-tolerant, because `nowMs` is sampled before `deep.txt` is written so `ageDays` is a tiny negative and `toFixed(1)` yields `-0.0` (the mtime rule, not `a live process…`, `a pool lane`, `symlink`); delete case `toMatch(/^scratch dir, idle \d+d$/)` (cheap documentation: a non-git dir that is deleted can only be the scratch-dir rule, so the stub is the useful part here).

## MVP

Musts only: the `readLiveCwds` stub plus the two `reason` assertions in `we:scripts/lib/__tests__/pool-leftovers.test.mjs`. No production-code change.

OUT of scope (Follow-ups): a lint/review-lens rule generalising "IO integration tests must assert the classification reason", and any change to the `cwds === null ⇒ live` fail-safe in `we:scripts/lib/pool-leftovers.mjs:85` (it is correct for production).

## Test plan

- *keep (nested-fresh) test asserts `reason`* — expects the `touched …d ago (< 7d)` reason. RED proof: temporarily revert `walk` recursion (#4272) so the tree ages out → action becomes `delete`, the test fails on `action` as before; AND separately, with the stub in place, making the stub return a cwd INSIDE the entry (`[{pid: 1, cwd: join(poolDir, 'scratch-old-top-fresh-deep')}]` — it must be the entry itself or beneath it, not `poolDir`, or `pidsWithCwdIn` won't match) turns the action into `keep` with reason `a live process has its cwd inside`, which the NEW `reason` assertion rejects while the OLD test passed.
- *delete (fully-stale) test asserts `reason`* — expects `scratch dir, idle Nd`. RED proof: with a stub cwd inside `scratch-fully-stale` the action flips to `keep` and the test fails (already caught by the `action` assertion); the `reason` assertion is low-value documentation here and the stub is the real fix.
- *stub is effective* — the first test no longer depends on host `lsof`; verified manually by running the suite with `lsof` unavailable (e.g. `PATH` stripped, using an absolute `node` path) and seeing it still pass.

## Proof plan

Run `npx vitest run pool-leftovers`: green after the change. Then show the two mutations above (drop `walk` recursion; force a live cwd) each turning the suite red, with before/after output pasted into the PR. No CLI probe is needed (no production change).

## Follow-ups

- File a lint / review-lens item: IO integration tests over a classifier must assert the classification reason (or stub the environmental inputs), not just the action.
- (Optional) share a `stubLiveCwds` test helper if other `lane-salvage` consumers' tests hit the same ambient-`lsof` dependency.

## Done when

1. **Executable** — `npx vitest run pool-leftovers` passes, and fails if `newestMtime`'s `walk` recursion is removed or if `readLiveCwds` reports a live cwd in the pool dir.
