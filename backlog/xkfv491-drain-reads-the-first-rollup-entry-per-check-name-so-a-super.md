---
kind: task
status: resolved
dateOpened: "2026-08-05"
dateResolved: "2026-08-05"
tags: [drain, ci, gate]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Drain reads the FIRST rollup entry per check name, so a superseded run jams the queue

`isRequiredCheckGreen` and `isRequiredCheckFailed` both took `roll.find(...)` — the first rollup entry
matching the check name. GitHub returns the rollup in creation order, so that reliably picked the OLDEST
run of a check rather than the one describing the current tree.

## Why it is owed

A head SHA routinely carries several runs of the same check: a workflow `concurrency` group cancels the
in-flight run when a new push supersedes it, leaving a CANCELLED entry beside the SUCCESS that actually
finished. Observed on PR #1042 — `test` had CANCELLED at 18:34:02 at index 0 and SUCCESS at 18:35:32 at
index 1, so the drain skipped the PR as `required check "test" is not green` on every pass while
`gh pr checks` reported a pass. The two disagreed because `gh` collapses to the latest run per name and
the drain did not.

Three PRs were held at once (#1042, #1046, #1012). The failure is silent: the queue simply stops moving,
and it surfaces only if someone compares the drain's view against `gh`. Re-running CI does not clear it —
the cancelled entry stays in the rollup and a re-run only appends another.

The twin `isRequiredCheckFailed` shares the flaw in the opposite direction: it would stamp `ci:failed` on
a PR whose current run is green, because a superseded CANCELLED run counts as a red conclusion.

## Build

- `latestRequiredCheck(pr, name)` — the newest matching rollup entry, exported and shared by both predicates.
- The rollup arrives in creation order, so the newest entry is simply the LAST matching one. No timestamp is
  read and no sorting happens.
- A CheckRun outranks a legacy StatusContext: when any CheckRun matches the name, only CheckRuns are
  considered. A StatusContext decides only when the workflow produced nothing at all.

## Acceptance

- Latest-wins, NOT "ignore CANCELLED": if the newest run is cancelled the check has no current verdict and
  the PR must not land. A PR whose only run is cancelled still reads not-green.
- A single-run rollup and a missing check behave exactly as before.
- `isRequiredCheckFailed` no longer fires on a superseded cancelled run when the latest run is green.
- A `test`-named commit status posted after a red check run can NEVER clear the merge gate.

## Why no timestamp ranking (review of PR #1049)

The first cut ranked entries by a timestamp, to survive a rollup ordering GitHub does not emit. Two
independent review panels found it bought three defects and no observed benefit:

- it compared one run's `completedAt` against another's `startedAt` — different clocks, so a run that ENDED
  late outranked the newer run that had only STARTED;
- an entry with no usable stamp ranked as globally OLDEST, so an in-flight run could never suppress a stale
  SUCCESS;
- pooling CheckRuns and StatusContexts under last-wins let a posted `test` status override a real FAILURE and
  clear the merge gate — a bypass the pre-fix `find` did not allow.

Trusting GitHub's documented creation order removes all three and needs no special case for the
`0001-01-01T00:00:00Z` sentinel it reports for an unfinished run. If a rollup ever arrives out of order,
that is the moment to revisit.
