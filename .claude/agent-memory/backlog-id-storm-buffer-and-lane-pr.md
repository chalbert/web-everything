---
name: backlog-id-storm-buffer-and-lane-pr
description: Filing a new backlog item during a concurrent-session id storm — hand-picked next-free ids collide repeatedly; buffer ahead + land via lane→PR
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a0c46cd-a2cf-4c9b-9cb4-2c2c916ea4eb
---

Creating a new backlog item by hand-picking `max+1` FAILS under heavy concurrent sessions: peers grab
the same id in the seconds between compute and land. On 2026-07-03 one card collided FOUR times
(2199→2215→2216→2218), each time a peer had taken the id. A **duplicate id turns CI red** —
`src/_data/__tests__/backlogGraph.test.ts` ("carries the #254 leverage fields") asserts tier parity per
node, and two nodes sharing an id make the two derivations disagree (`expected 'A' to be 'B'`). So a
collision is not silent; it blocks the merge.

**Why:** the id space was in an active write-storm (peers were themselves landing items about this exact
problem — #2215 "publish scaffolded items via gated lane-PR", #2218 "pr-land report crashes"). `pr-land`
does NOT self-heal id collisions at open time (that heal is drain-time, #2181); it just opens the PR and
CI fails on the dup.

**How to apply:** don't direct-write backlog items to the shared primary tree (the lane guard blocks it
and untracked files get wiped by a peer merge/clean — that is how the first draft vanished). Instead:
(1) work in a **mapped lane clone** synced to `origin/main`; (2) **buffer the id ahead of the storm
front** — pick `max + ~6`, not `max+1` (gaps are harmless, ids need not be contiguous); (3) verify
`ls backlog/*.md | grep -oE '/[0-9]+' | uniq -d` shows **no dup** before committing; (4) land via
`pr-land --ref=lane/<slug>` and merge when the `test` check is green (`cla` is non-blocking). `pr-land`
waits ~1.5–2 min for CI, so its wait may exceed a 2-min Bash timeout — watch checks in the background,
then `gh pr merge`. See [[shared-index-commit-race]], [[pr-land-dogfood-mechanics]],
[[single-session-should-use-a-lane]].
