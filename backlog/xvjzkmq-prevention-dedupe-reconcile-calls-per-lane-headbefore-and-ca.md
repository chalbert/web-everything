---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/lib/lane-history.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/lib/__tests__/lane-history*.test.mjs", "we:scripts/lib/__tests__/lane-journal.test.mjs", "we:scripts/conveyor/health-smells/__tests__/lane-destructive-reachability.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "afb711055c4f300be8c01a8e32eef92ec8c71733"
tags: []
---

# Prevention — Dedupe reconcile calls per (lane, headBefore) and cap the count per probe run. Add a test asserting tha… (from chalbert/web-everything#3286 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-watch.mjs#probeLaneJournal` — dedupe remote-reachability checks per (pool-qualified lane, headBefore), and cap checks across the whole probe invocation. N identical eligible entries must trigger one Git check.
2. `we:scripts/lib/lane-history.mjs#readLaneJournalTail` and `readLaneJournal` — discard persisted `remoteReachableNow` evidence on read. Only a successful reconciliation during the current probe may suppress a commit-loss alert; stale journal evidence must not do so.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3286@ed1c9ae1e2baafdaabcbefeb4709a7e8b7e8cacb

## Progress

Preparation checked the current implementation; the goal is not already delivered.

- **Validation repair:** the prepared scope omitted the required matching test scope for `we:scripts/lib/lane-history.mjs`. Add `we:scripts/lib/__tests__/lane-history*.test.mjs`, which includes the existing `we:scripts/lib/__tests__/lane-history.test.mjs` regression suite for that module. Retain `we:scripts/lib/__tests__/lane-journal.test.mjs` as the targeted home for the reader-sanitization cases; the completed design and implementation scope remain unchanged.

- **Old premise/scope:** the review cited `we:scripts/conveyor/health-watch.mjs:415` and `we:scripts/lib/lane-history.mjs:205`, and listed the general history and health-watch test files. It suggested either a separate reconciliation verdict or stripping persisted evidence, plus a possible map/subprocess lint.
- **Corrected premise:** `we:scripts/conveyor/health-watch.mjs:406-419` still maps every recent integer-lane entry through reconciliation, without a cache or run-wide budget. The subprocess is indirect: `we:scripts/lib/lane-history.mjs:379-384` calls `snapshotGit`, whose timeout is 30 seconds. A syntax check for direct subprocess calls inside a map would miss this path. The predicate trusts `remoteReachableNow` at `we:scripts/lib/lane-history.mjs:204`; both journal readers at `we:scripts/lib/lane-history.mjs:461-502` retain arbitrary parsed fields.
- **Observed evidence:** a temporary journal containing an otherwise alerting clean-tree destructive reset with `remoteReachableNow:true` produced `persistedFlag:true`, `breachWithPersistedFlag:false`, and `breachWithoutFlag:true` when read through the real tail reader and evaluated by the real predicate. The temporary fixture was removed. This is a reproduced suppression, not a delivered fix.
- **Corrected scope:** retain both source files and `we:scripts/conveyor/__tests__/health-watch.test.mjs` for probe budget tests. Replace the unrelated per-lane ledger test with `we:scripts/lib/__tests__/lane-journal.test.mjs` for both journal readers. Include `we:scripts/conveyor/health-smells/__tests__/lane-destructive-reachability.test.mjs`, which already exercises real Git reachability through the probe and episode closure. No smell API change or standards-lint implementation is needed for the reader-sanitization approach.

## Design

Keep the existing entry-shaped reconciliation result and probe output. Strip `remoteReachableNow` from parsed object entries in both journal readers in `we:scripts/lib/lane-history.mjs`, without modifying journal bytes, other fields, rotation handling, or malformed-line tolerance. A new probe must always establish reachability anew.

In `we:scripts/conveyor/health-watch.mjs#probeLaneJournal`, allocate a cache and budget once per invocation, outside the pool loop. Key the cache by the full lane directory and exact `headBefore`, so equal lane numbers in different pools cannot share evidence. Cache only reachability outcomes, never a whole entry: different events sharing a commit retain their own action, timestamp, dirty state, and at-time counts.

Only entries that the existing loss predicate considers alerting, with an integer lane, a valid supported SHA, and no positive effective dirty count are candidates. Share this eligibility check from `we:scripts/lib/lane-history.mjs` between reconciliation and the probe so non-candidates consume no budget. Preserve the existing treatment of unknown dirty counts and explicit `unpushed:false`.

Add a named default limit of 16 distinct eligible checks per invocation, with a nonnegative integer `maxReconcileChecks` option for deterministic tests (zero disables checks; invalid values fall back to the finite default). This is an implementation bound, not a change to loss policy. Consume a slot before attempting a check; failed and negative checks consume slots and are cached too. Once exhausted, leave uncached candidates alerting. Cached positive evidence can still be reused after exhaustion, but only on individually eligible entries; it must never clear dirty-work loss. Preserve journal entry order and pool traversal order. Cache and budget reset on the next invocation.

Provide an injectable reconciliation function in the probe options, defaulting to the existing implementation, to count attempts without real delays. Keep the existing read-only Git command and timeout; this item bounds subprocess count, not total tick latency. Do not fetch, reset, rewrite journals, or persist the cache.

## MVP

1. Sanitize transient reachability evidence in both readers and cover live and rotated journal reads in `we:scripts/lib/__tests__/lane-journal.test.mjs`.
2. Factor shared eligibility in `we:scripts/lib/lane-history.mjs`; add invocation-local outcome caching, the finite limit, and the test seam in `we:scripts/conveyor/health-watch.mjs`.
3. Add count and isolation cases in `we:scripts/conveyor/__tests__/health-watch.test.mjs`; extend the existing real-Git reachability test to cover forged persisted evidence and repeated entries.
4. Preserve public probe output, historical counts, dirty-work alerts, and normal episode closure after genuine current reachability proof.

## Test plan

- `we:scripts/conveyor/__tests__/health-watch.test.mjs`: N identical eligible entries make exactly one reconciliation attempt; distinct SHAs, lanes, and pools do not collide. With budget two, more than two distinct candidates across multiple pools make exactly two attempts. Duplicate successful, negative, and failed outcomes do not spend another slot. Non-candidates spend none; zero budget performs no checks; invalid budgets retain a finite default. Repeat the probe to prove there is no cross-run cache.
- In the same probe suite, mix clean and dirty entries for the same key and vary timestamps/actions/counts. Only clean eligible entries receive current positive evidence; output length, order, and per-entry historical fields remain unchanged. Exhausted or failed checks retain alerting entries.
- `we:scripts/lib/__tests__/lane-journal.test.mjs`: both readers strip saved true and false transient flags, retain unrelated fields, preserve corrupt-line tolerance, and do not rewrite journal bytes; full reads cover rotated files too.
- `we:scripts/conveyor/health-smells/__tests__/lane-destructive-reachability.test.mjs`: write a stale true flag for an unreferenced commit and assert the real probe still breaches. Create a remote-tracking ref and assert a fresh probe clears it; remove that ref and assert the next probe breaches again. Keep the existing dirty-work and normal episode-closure cases. Instrument the Git subprocess boundary for N duplicate clean events and count exactly one `for-each-ref` invocation, excluding fixture setup commands.

## Proof plan

During implementation, run the newly added regression cases against the parent implementation first: duplicate-count, cap, and saved-flag cases must fail for the stated reasons. Then run the three scoped suites with Vitest and record counts/results. Run `npx vitest run` with the repository-relative forms of `we:scripts/conveyor/__tests__/health-watch.test.mjs`, `we:scripts/lib/__tests__/lane-journal.test.mjs`, and `we:scripts/conveyor/health-smells/__tests__/lane-destructive-reachability.test.mjs` (the `we:` prefix identifies the repository and is not a shell path).

Use temporary fixture pools only. Capture the subprocess count and real smell verdicts, compare journal bytes before/after probing, and demonstrate that two pools share one budget without sharing lane evidence. Run `npm run check:standards` before implementation delivery. Preparation itself reproduced the saved-flag defect; it does not claim the planned tests or fix have passed. The runner owns preparation stamping and checks.

## Done when

- The three named Vitest suites pass with the new regressions, including one actual reachability Git call for N duplicate eligible entries and no more than the configured run-wide limit for distinct candidates.
- A persisted `remoteReachableNow:true` cannot clear a loss alert without fresh positive evidence. Failure, missing lane/commit, or budget exhaustion leaves the conservative verdict intact; discarded dirty work remains alerting even if the commit is reachable.
- Reconciliation preserves journal bytes and at-time counts, and the standards gate passes.

## Follow-ups

A general static rule for subprocess work inside probes is separate tooling work: direct `execFileSync`-inside-map matching cannot detect this indirect call. The deterministic guard for this item is the subprocess-count regression. A wall-clock budget or traversal fairness policy across repeated saturated probes would require separate operational evidence; neither is needed to deliver the requested finite per-invocation count and conservative fallback.
