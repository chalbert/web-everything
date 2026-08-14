---
bornAs: x0uqfsr
kind: task
status: open
dateOpened: "2026-08-14"
tags: [plateau-loop, operations, conveyor, dispatch, footgun]
scope:
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/__tests__/dispatch-lane.test.mjs
---

# `classifyDispatchPr` can attribute a later retry's merged PR to an earlier, unrelated dispatch entry

Found by the FIRST live run of the newly-built `review-pr` operation with `--aim` set (#3094's proof-of-concept,
2026-08-14), reviewing #3095's own PR (#1263) with a real spawned juror. The juror answered the operation's
own mutation-probe instruction unprompted: *"no named test pins this scenario, so no test reddens."* Verified
directly against the code on `we:scripts/operations/dispatch-lane-io.mjs`'s `classifyDispatchPr`
(`lane/build-3095`, line 800 — not yet on `main` at filing time, landing imminently via #3095).

## The bug

`classifyDispatchPr({ num, startedAt, prs })` matches candidate PRs by item number alone (`mine`, line 806),
then keeps any match whose merge instant is at or after the CALLER's `startedAt` (`attributable`, line 815).
That second check only proves the merge happened *after this entry started* — it does not prove the merged PR
*belongs to this entry's own attempt*.

**Concrete scenario:** item 100 is dispatched twice (a retry). Entry A starts at `T1` and is abandoned or
stuck (no PR, or a PR that never merges). Entry B, a later retry for the SAME item, starts at `T2 > T1` and
its PR merges at `T3 > T2 > T1`. When entry A's own observer pass runs
`classifyDispatchPr({ num: 100, startedAt: T1, prs })`, entry B's merged PR is in `mine` (same item number)
and passes the `attributable` filter (`T3 >= T1`) — so entry A resolves `succeeded` off a PR it has no
relationship to. A's own outcome (did IT actually land anything) is never checked.

This is the mirror image of the stale-guard #3095 already built: that guard correctly stops an EARLIER PR
from resolving a LATER retry (`mergedMs >= startedMs` on the same axis, same direction). Nothing stops the
reverse — a LATER PR resolving an EARLIER, dead entry — because "later than my start" is satisfied by
construction whenever a subsequent retry succeeds.

## Why this matters

Two dispatch entries for the same item, only one genuinely attributable, both racing the same observer pass.
If entry A is still actually in-flight (not dead, just slow) when B's PR merges, A gets incorrectly marked
`succeeded` and the waker stops tracking it — while A's own agent may still be running, about to open its
OWN PR and land a duplicate, unobserved.

## What is not yet established

- Whether real dispatch has produced double-retries for the same item yet (per #3096, real dispatch hasn't
  gone live in production — this is a capture from the first live-fire test, not a production incident).
- Whether the fix should be "each entry gets a unique attempt id woven into the branch name" (closes it
  structurally, more invasive) or "only trust an `attributable` PR whose branch was never claimed by another
  STILL-OPEN entry for the same item" (cheaper, checks against the run store's other entries at classify
  time).

## Done when

- [ ] A test reproduces the scenario above: two entries for one item, the later one's PR merges, and the
      test asserts the EARLIER entry does NOT resolve `succeeded` off it.
- [ ] The fix is stated as a decided design, not left to the builder to invent.
- [ ] `we:scripts/operations/dispatch-lane-io.mjs`'s docblock for `classifyDispatchPr` states this bound
      explicitly (mirroring how the existing stale-guard direction is already documented).

## Watch for

- Do not "fix" this by ALSO requiring the reverse direction's exact mechanism (`\ mergedRefs`-style
  subtraction) without checking whether it actually composes with the existing stale-guard — two guards on
  the same function need to agree on what "belongs to this entry" means, not each invent their own answer.
