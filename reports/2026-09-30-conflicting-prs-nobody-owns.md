# Conflicting PRs Nobody Owns (Diagnosis)

Why PRs #3176 and #3215 (both conflicting) showed no owner. Each causal claim names the code that produces it; where the evidence does not settle the cause, this report says so.

## Root Causes & Evidence

**1. How the phase is derived (`we:scripts/progress-board.mjs#classifyPr`)**
Labels are checked in strict order: `review:changes` (`bounced`) > `review:human` without `review:accepted` (`needs-human`) > `ci-red` > `mergeStateStatus` of `DIRTY` or `BEHIND` (`conflicted`) > `review:pending` (`needs-review`) > `review:accepted` (`queued`). The reconcile pass (`we:scripts/conveyor/reconcile-core.mjs`) consumes this phase; it does not derive it.

**2. Why the log read `phase 'queued'` for #3176/#3215 — cause NOT settled**
The refusal lines (`reconcile-refused nothing-owed … phase 'queued'`) came before `review:changes` was applied (PR 3215 got `review:accepted` at `22:51:01Z`, `review:changes` at `22:56:15Z`). Since `classifyPr` checks `DIRTY`/`BEHIND` before `review:accepted`, a PR read as `queued` was **not** seen as `DIRTY`/`BEHIND` at that moment. Two candidates remain, and the logs do not say which applied:
- `mergeStateStatus` was `UNKNOWN`, stale or cached (GitHub computes it lazily after a push to the base).
- `mergeable` and `mergeStateStatus` disagreed (e.g. `mergeable: CONFLICTING` while `mergeStateStatus` had not yet turned `DIRTY`).

The queued-conflict grace window is **not** a candidate: `we:scripts/conveyor/parked-pr-conflict-watch.mjs#isQueuedConflictTarget` keys on `mergeable === 'CONFLICTING'` and only delays the watcher's bounce; it never changes the phase `classifyPr` returns.
Follow-up: card `xzv8r3e`. Once `review:changes` landed, `classifyPr` correctly returned `bounced`.

**3. Are `review:human` PRs skipped by conflict repair?**
No. `we:scripts/conveyor/parked-pr-conflict-watch.mjs` handles them under its parked-conflict "Fork 2" design (the `recheckCandidate` branch targets parked, conflicting `review:human` PRs).

**4. Is the label set `review:human` + `review:changes` a bug?**
No, it is Fork 2's design. The watcher posts a finding (which applies `review:changes`) to dispatch a mechanical conflict fix, and leaves `review:human` in place so a human still reviews the merged result.

**5. What blocked dispatch on #3176 — NOT identified**
A `live-process` refusal is derived in `we:scripts/conveyor/reconcile-core.mjs#assessLiveness` only from a bound session whose agent listing has `pidAlive === true`. It never reads the `review-status:reviewing` label; that label is an *output* of the same state (`we:scripts/conveyor/review-status-tag.mjs`), and the reconcile pass already re-derives and clears stale ones every tick. So the label (`20:32:52Z` to `23:00:37Z` on #3176) shows a session was bound, but this report did not identify which session or why its pid stayed live. That is the open question; a label sweep would not answer it, and none is proposed.

## Fix Design
No code change to the phase logic or label set: they work as designed.
1. Settle item 2 (card `xzv8r3e`): make the refusal log name the `mergeStateStatus` it saw, so a `queued` read on a conflicting PR is diagnosable.
2. Next time a `live-process` refusal outlasts its session, capture the bound session id and pid from `assessLiveness` at that moment, before the label clears. No card is filed for this yet: there is nothing to build until it recurs. (An earlier draft filed a label-sweep card for it; it was removed because the sweep already exists and would not unblock dispatch.)
