---
name: prototype-is-source-of-truth-for-mechanical-work
description: "Standing instruction — for now, treat origin/lane/mechanical-dispatcher (epic #3383's prototype branch) as the current source of truth for mechanical-dispatch work and what's actually running, not main."
metadata:
  type: feedback
---

**"The prototype" = `origin/lane/mechanical-dispatcher`, epic #3383's dedicated branch for the
background mechanical dispatcher** (dispatch-lane, the conveyor runner/supervisor, the fix/ci-heal
launch kinds, etc). The epic's own "How to build it" section deliberately builds this on a branch,
NOT incrementally merged to `main` — prove it under real, unattended use first, then split into
small reviewable PRs later. So the branch, not `main`, is where the mechanical-dispatch code
actually lives and what live scratch checkouts (e.g. `wev-scratch-dispatcher-4`) run from. PR #1853
("dispatch-lane: widen to fix/ci-heal launch kinds") is one incremental change living on that
branch, itself still unlanded.

**Why:** `main` regularly lags the branch by dozens of commits and is missing whole files the
branch has (`supervisor.mjs`, `route-pr-outcome.mjs`, the #3105/#3110 dispatch-guard work as of
2026-09). Reading `main`'s code to answer "what does the dispatcher do today" gives a stale or
wrong answer. See [[keep-prototype-branch-synced-after-each-merge]] for why the branch itself
still needs proactive syncing against `main`.

**How to apply:** When the operator says "the prototype," or asks about dispatch-lane, the
conveyor runner/supervisor, or "what's actually running" for mechanical delivery — check
`origin/lane/mechanical-dispatcher` first, not `main`. Cite the branch explicitly when describing
current dispatcher behavior or reviewing a PR against it (e.g. PR #1853 targets this branch, not
`main`). This is an operator-set "for now" default — revisit once the branch's pieces are split out
and landed to `main` for real (tracked across #3403/#3404/#3406 and this epic's own landing-order
notes).
