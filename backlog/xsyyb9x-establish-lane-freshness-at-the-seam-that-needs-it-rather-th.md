---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-24"
tags: []
---

# establish lane freshness at the seam that needs it, rather than notifying about it

A lane acquired an hour ago goes stale when main moves, and nothing forces the update. `we:scripts/lane-pool.mjs status` already REPORTS behind-origin/main and `acquire` resets on lease, so freshness-at-acquire is solved; the gap is drift **during** work. PR #1526 hit it live — `mergeable_state: behind`, caught only by reading the PR state by hand.

## Why not a notification, and why not a poll

Both produce **a message someone must act on**, which is the failure mode, not the fix.

- **Notification** is unreliable on this surface by the harness's own statement: pushes, CI success and merge-conflict transitions arrive late or not at all. A freshness signal that silently does not arrive is worse than none, because it trains the reader to assume fresh.
- **Poll** is a background actor that can be off, and it reports after the fact.

The codebase idiom is stronger and already everywhere: **the operation that would do the wrong thing establishes the precondition itself.** `assertLaneCwd` refuses a non-lane rather than warning about one; `stage-pr-view` refuses an incomplete view; #2953 refuses a non-OPEN PR; the #2409 staleness gate refuses an acceptance that does not cover the head. None of them notify.

## The shape, graded by what staleness actually costs

| seam | action | why |
| --- | --- | --- |
| before opening a PR | **auto-merge `origin/main`** | the repair is deterministic (`git merge origin/main`); instructing a caller to run a command the tool could run is strictly worse |
| on merge conflict | **refuse**, name the conflicting paths | the only part that needs judgment |
| before recording a verdict | **refuse** if the reviewed sha is no longer the head | a verdict pinned to a superseded commit is the #1510/#1511 twelve-hour stall, exactly |
| anywhere else | report only (already does) | a lane behind main is usually harmless; blanket refusal is how a gate earns being ignored |

## The load-bearing invariant

Auto-merging is only safe **with a net-diff assertion**. Merge `origin/main`, then compare `git diff --name-only origin/main...HEAD` before and after: identical means the judged contribution is unchanged and any existing verdict still describes it. Different means the review is invalidated and must re-run.

This was done by hand on PR #1526 and it is the whole reason the auto-merge is not a silent rewrite of what was reviewed. Without it, "helpfully" merging main could change the diff under a recorded acceptance — the same class of defect as a green check belonging to a superseded commit.

## Done when

1. **Executable** — opening a PR from a lane behind `origin/main` merges main first and succeeds, with the net changed-file set asserted identical before and after. Red today (the PR opens `behind`), green after.
2. **Executable** — the same path on a CONFLICTING lane refuses, names the conflicting paths, and opens nothing.
3. **Executable** — recording a verdict whose `reviewed-sha` is not the PR's current head is refused. Red today, green after.
4. The auto-merge never runs where the net contribution would change: a test pins that a main-merge which alters the net diff aborts rather than proceeding.
