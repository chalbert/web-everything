---
bornAs: x3ei6wr
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/lib/main-staleness.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Review dispatch: refuse on a stale clone only when the missed commits touch the review code path

we:scripts/lib/main-staleness.mjs's guard, called from we:scripts/operations/review-dispatch.mjs (#3439), refuses a review dispatch when the dispatching clone is even 1 commit behind origin/main. The drain lands about one PR a minute and a daemon rebuild takes minutes (longer when its smoke check hits the GitHub rate limit), so the review daemon spends long stretches refusing: live 2026-09-28 the review-daemon log recorded 970 stale refusals before the 9:32 PM ET restart, and the clone sat 4-18 commits behind. MVP: compute the files changed in HEAD..origin/main and refuse only when one is on the review code path (the review operation and its imports: we:scripts/operations/review-pr.mjs, we:scripts/operations/review-dispatch.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/lib/ judge/jury/review modules — derive the set from the import graph or a declared list); otherwise dispatch and log the tolerated lag. Must: unit test for both branches; live proof: with the clone behind by commits that do not touch the review path, a review dispatches (before: refused). Follow-up: same rule for the fix and verify dispatchers.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs -t "#4387"`: a real
   managed clone behind origin/main in code OFF the review path dispatches (before: refused with the stale
   marker), and one behind in we:scripts/operations/review-pr.mjs still refuses.

## Progress

- `assertMainNotStale` (we:scripts/lib/main-staleness.mjs) takes an opt-in `dispatchPath` predicate: a MANAGED
  clone behind only in code files the predicate rejects dispatches and logs the tolerated lag
  (`behindOffDispatchPath`). Unknown/empty behind-file list still refuses (fail closed); unset keeps the #4044
  rule; unmanaged checkouts are unchanged (they auto-ff, or get the reason-specific refusal).
- we:scripts/operations/review-dispatch.mjs declares `isReviewCodePath` (review/judge/jury modules under
  `scripts/{operations,lib,conveyor}/`, we:scripts/operations/cli-adapter.mjs, and the guard itself) and passes
  it. A declared list, not the import closure: review-dispatch + review-pr + cli-adapter statically reach ~190
  files, so the closure would refuse on nearly every landed PR.
- Unit tests for both branches plus fail-closed cases (we:scripts/lib/__tests__/main-staleness.test.mjs);
  real-call-path tests through `dispatchReview` on a real temp git clone
  (we:scripts/operations/__tests__/review-dispatch.test.mjs).
- Follow-up (not in this item): the same rule for the fix (we:scripts/conveyor/reconcile-fix-dispatch.mjs) and
  verify dispatchers — pass their own `dispatchPath`.

## Follow-ups — stale recovery investigation, 2026-09-30

Local, uncommitted follow-up in we:scripts/lib/daemon-self-sync.mjs; daemon clones were read only.
The current path filter above and immediate rebuild both already existed. The remaining recovery hole was
that an adopted rebuild with **no daemon-imported changes** returned the failed tick instead of rediscovering
owed work. An adopted rebuild **with imported changes** could have its restart suppressed by the ordinary
600-second minimum uptime. The live incident contains both stale refusals and restart-deferred messages
(lines 286786 and 286822 of the review-daemon log). The log does not record each immediate rebuild's return
value, so it cannot establish which recovery branch each refusal took.

The follow-up retries discovery once in the same pass after adoption when the daemon's import closure is
unchanged. It releases the old read lock before rebuilding, reacquires it, and checks quarantine and HEAD
again before retrying. Imported/unknown changes restart immediately on stale recovery, bypassing the usual
restart debounce. A second refusal, unsuccessful rebuild, quarantine, or refused read lock ends recovery;
there is no unbounded retry and no raw fast-forward. Discovery runs again rather than replaying the previous
plan, since some jobs may already have started. The existing dispatch guard still runs on the retry.

### Exact guard and rebuild behavior

- we:scripts/lib/main-staleness.mjs fetches origin/main, then counts local **main..origin/main**, with
  the inverse range detecting divergence. It is not an age threshold. Managed clones disable auto-FF.
- Its #4044 tolerance reads **HEAD...origin/main** (merge-base diff). A nonempty, successfully read list
  containing only non-code files is tolerated. Code means JS/TS/JSON, excluding test files. #4387 also
  tolerates code outside the declared review path in we:scripts/operations/review-dispatch.mjs, including
  its sandbox import closure. Unknown/empty lists do not get those exemptions. Ordinary merges touching
  that path still trip the guard, even immediately after a rebuild. Rebuild smoke takes time while main moves.
- we:scripts/lib/daemon-self-sync.mjs rebuilds before every tick and again on a detected stale refusal.
  There is no fixed rebuild timer. we:skills-src/conveyor/review-daemon.mjs has a nominal 120-second sleep;
  the observed event-driven mode advertises a 600-second safety-net sleep and wakes early on PR events.
- Local origin/main history for September 30 UTC has 560 commits, median adjacent commit-time gap 1.23
  minutes (all commits, not a count of merged PRs). The review clone's timestamped alerts have 52 cached
  candidate adoptions that day, median gap 13.46 minutes; this is a **subset** of adoptions, not a complete
  rebuild cadence. Six explicitly slow smokes have median 142.35 seconds, range 64.97–238.32 seconds.
  Thus even one slow smoke spans ordinary main movement; an immediate rebuild alone does not ensure a
  dispatch gets an opportunity afterward.

### Untracked cards

The review clone has 76 untracked hash-named backlog cards. A sampled card names PR #2852, says it was filed
mechanically on approval on September 28, and carries an approval-prevention idempotency key.
we:scripts/lib/prevention-landing-job.mjs documents the old approval/review-loop in-process filing bug and
its replacement by a detached landing job (#4493). This agrees with the sampled file's provenance; it does
not establish the authoring process of every leftover card.

we:scripts/lib/daemon-rebuild.mjs#findUnsafeLocalState checks tracked dirt with untracked files excluded,
preserves these cards, and logs `untracked-kept`. They do not change commit distance and do not normally
block rebuild; a collision with an incoming tracked path can block adoption. Conversely, the staleness
check's full porcelain status includes them, so `dirty=true` prevents its last-known-good fallback. No
leftover files were removed and no dirty-tree bypass was added.

### Evidence and limits

Snapshot: 287,529 log lines, **954** matches of `failed (non-fatal): review-dispatch: the dispatching checkout
is … STALE code from this checkout`. For time windows, unique rebuild-event payloads in the daemon log were
matched to the clone's timestamped alerts; nested `passedAt` values were not treated as log emission times.
Counts strictly between matched endpoints, UTC:

| Window | Refusals | Hours | Refusals/hour |
| --- | ---: | ---: | ---: |
| September 29 00:04:58.601–23:50:34.564 | 46 | 23.760 | 1.94 |
| September 30 00:41:11.435–22:48:02.995 | 10 | 22.114 | 0.45 |
| October 1 00:47:41.585–02:10:43.869 | 2 | 1.384 | 1.45 |

These are **all before this patch**. They are not a deployment comparison. Most log lines lack timestamps;
78 per-PR episodes from first stale refusal to next dispatch have a median of two intervening tick summaries
and one refusal. Two nominal 120-second intervals suggest four minutes of scheduling opportunity, but
rebuild/reap/discovery time and event wakeups make that **not an elapsed-time estimate**. Timestamp brackets
are too wide to establish a useful exact median; pending episodes are censored and are not in that sample.

PR #3176 was refused at lines 286773 (8 behind) and 286827 (5 behind), then dispatched at 286879 (PID 69830)
and 286979 (PID 7950). Its job log records starts at October 1 **00:58:38.150Z** and **01:08:46.020Z**;
the latter finished its loop at 01:14:36.725Z, parked with `needs-human`, and completed three additional
seats including two advisory lenses at 01:16:32.153Z. Its advisory did run; dispatch is not the same as
clearance. These are pre-patch observations, not success attributable to this change.

Validation: we:scripts/lib/__tests__/daemon-self-sync.test.mjs covers same-pass rediscovery, read-lock order,
quarantine/writer refusal on retry, urgent restart despite the debounce, and bounded recovery when main moves
again. A 50-pass simulated soak uses the real staleness assertion and self-sync wrapper, with git/rebuild
and dispatch effects injected; it is not a live smoke or paid review run.

Outstanding deployment proof: after human review and normal gated adoption, compare matching refusal rates
in an equal-duration window and inspect actual review job outcomes. This job explicitly forbids commit,
push, PR creation, and manual daemon-clone edits; the uncommitted patch cannot supply a live after window.

Verification result: `node we:scripts/verify-lane.mjs` ran 196 files: 194 passed, two failed;
8,428 tests passed, six failed, eight skipped. All six failures are real-process-table probes in
we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs and
we:scripts/operations/__tests__/restart-runner-io-real.test.mjs. Direct `ps -p $$ -o ppid=,command=`
returned exit 126, `/bin/ps: Operation not permitted` in this sandbox. The tests were not weakened or
skipped; the lane verification marker remains red pending a run with process-table access.

The separate `npm run check:standards` completed successfully with zero errors (existing warnings remain).
