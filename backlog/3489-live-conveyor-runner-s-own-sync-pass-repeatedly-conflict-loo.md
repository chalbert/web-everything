---
bornAs: x6e7sbm
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/runner.mjs", "we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Live conveyor runner's own sync pass repeatedly conflict-loops merging origin/main into we:skills-src/conveyor/runner.mjs, we:scripts/verify-lane.mjs, we:scripts/readiness/dispatch-plan.mjs, we:scripts/conveyor/tick-core.mjs, we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs -- checkout stays stuck behind, queued items never become ready

Caught live 2026-09-04 while queuing #3443's graduation slices into the live conveyor. The live runner (pid resolved via ~/.claude/conveyor-runner-locks/, cwd confirmed via lsof) runs from a checkout literally checked out on lane/mechanical-dispatcher, not main -- exactly the epic's own stated current state (we:backlog/3383-*.md: 'only once everything has transferred does the real system execute from main instead of the branch'). Its sync.log shows repeated CONFLICT (content) failures merging origin/main into this branch on the SAME file set every attempt: we:skills-src/conveyor/runner.mjs, we:scripts/verify-lane.mjs, we:scripts/readiness/dispatch-plan.mjs, we:scripts/conveyor/tick-core.mjs, we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs -- each attempt cleanly aborts (no stuck MERGE_HEAD found), so the working tree is not corrupted, but it also never advances: confirmed 3 commits behind origin/main at the time of this finding. Effect: node we:scripts/conveyor/queue.mjs add <N> against this checkout's sidecar reports the item queued (cleared) but we:scripts/readiness/dispatch-plan.mjs immediately reports it cleared-but-not-ready, because the checkout's own we:backlog/ doesn't yet contain the newly-landed items. This directly blocks tonight's graduation-acceleration priority: slices queued for this exact runner cannot dispatch until it advances past the conflict. Distinct from we:backlog/3478-*.md (queue-target resolution, unbuilt) and we:backlog/3472-*.md/we:backlog/3464-*.md (general checkout staleness) -- this is the sync mechanism itself failing on a specific, recurring, file-identified conflict set, not merely a stale-and-unaware checkout. The same file set is independently corroborated by tonight's #3443 slicing work, which flagged these exact files as having real overlap between the branch and main's independent evolution.

## Done when

1. **Executable** — a test/repro exercises the live runner's own sync pass against a fixture repo shaped like
   this conflict (`main` and the tracked branch both touching `we:skills-src/conveyor/runner.mjs`), and proves
   either (a) the pass detects and reports the stuck state loudly (distinct from silent no-progress), or (b)
   the pass resolves it (e.g. by landing the graduation slices this session filed, which is the actual root
   cause -- once `#3481`-`#3488` land, the branch and `main` stop diverging on these files and the merge
   should go clean).
2. `node we:scripts/conveyor/queue.mjs add <N>` against the live runner's resolved checkout, followed by a
   real tick, dispatches a queued-and-ready item without a human noticing and manually diagnosing the
   conflict loop by hand (the exact recovery this item's own discovery needed tonight).
