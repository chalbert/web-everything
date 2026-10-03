---
bornAs: xhrmvts
kind: story
size: 3
parent: "4795"
status: open
blockedBy: ["4919", "4925"]
scope: ["we:scripts/conveyor/health-responder-stranded-finish.mjs", "we:scripts/conveyor/__tests__/health-responder-stranded-finish.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: finish stranded finished work instead of releasing it

Operator, 2026-10-02. On 2026-10-01 seven job lanes held finished, verified-green commits that were never opened as PRs (a record-lookup bug); releasing them, as story 4925 proposes for stranded lanes, would have discarded the work. When a stranded lane holds committed work whose verify record is green, the responder finishes it: re-verify, then open the PR through the declared open-pr operation, then release. It never commits uncommitted changes and never pushes to an existing PR branch. Every step is a decision-log record. Replay: the 2026-10-01 lanes (#4416, #4447, #4429, the #4623/#4624 splits).

## Detection and finish contract

#4925 emits `stranded-lane` candidates including clean lanes with locally committed, unpushed work; remote reachability is a release condition, never a detection condition.

**Detection path for committed-but-never-pushed work.** The finish candidate is a lane commit that is not on origin and has no live owner. Take the set of unpreserved commits from the same signal the lane pool uses: `reclaim --lane=N --dry-run --json` of we:scripts/lane-pool.mjs, field `unpreservedCommitShas` (computed by `laneReclaimPreservationProof`, we:scripts/lane-pool.mjs:3542; it is read-only under `--dry-run` and reports a held lane as kept, never reclaimed). A non-empty `unpreservedCommitShas`, together with the watch's positive dead-worker proof and unchanged lease, is the committed-never-pushed candidate. An empty set means every own commit is already preserved on a remote ref or patch-equivalent, so the lane is not a finish candidate. This reuses the pool's own proof; the responder adds no second commit-preservation parser, and reading it never resets, salvages or reclaims anything. A lane whose commits are pushed but not on main (no PR, or only an open PR) is a candidate too, from the watch's publication/main/open-PR coverage facts. The watch supplies exact lease/run/head, positive dead-worker proof, commit publication/main/open-PR coverage and head-bound verify evidence. Unknown coverage holds; live workers and dirty lanes are never finished or released. If finishing is disabled or unavailable, the lane stays held and is reported, never passed to release.

For a dead, unchanged lane with committed work not on main, call declared `verify` (the existing verify-lane owner), then declared `open-pr` for that exact verified head. The existing open-pr owner may publish this new branch; the responder never commits, modifies code/cards, or pushes to an existing PR branch. Recheck for a concurrently created PR before publication; reuse only an exact-head existing PR without pushing. After confirmed remote reachability and matching open-PR coverage, targeted lease-reaper/lane-pool release may run using #4925's same receipt and lease guard. Unknown publication outcomes hold the lane. Cap one verify/open attempt per lease/head, one release per lease, two finishes per host per day, A1/P and the four-releases/hour cap. Reserve each effect separately; a cap between steps leaves the lane safely held.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #4932 owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

A raw watch fixture with dead worker and clean green local-only commits must emit an episode, re-verify, open a PR through the declared owner and only then release. Cover pushed/no-PR work too. Dirty tree, stale/red verify, head/lease replacement, concurrent PR, existing-PR branch, ambiguous publish and unavailable finishing all preserve work; no commit or existing-branch push is called.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-stranded-finish.test.mjs'
npx vitest run "${responder_test_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #4932 records its soak, canary and operator enablement.
