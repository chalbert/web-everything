---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Lane release never resets the tree — known scratch litter accumulates until the whole pool is unacquirable

Live-observed 2026-09-07: 46 of 48 we:.lanes/web-everything lanes were simultaneously DIRTY (untracked scratch files: we:.commit-msg.txt, we:.pr-body.md, we:.pr-body.txt, review-*-output.json, commit-msg-fix-*.txt), the other 2 clean-but-1-commit-ahead — the ENTIRE pool read 0 acquirable at once, and node we:scripts/readiness/dispatch-plan.mjs --json showed 0 launch / 71 held / 0 free lane(s) with 34 queued items starved on 'no free lane' as a direct consequence. Root cause: we:scripts/lane-pool.mjs's cmdRelease only rmSync()s the lease marker — it never resets or cleans the tree — while we:skills-src/conveyor/delivery-agent-brief.md:267 explicitly instructs every delivery agent to write its scratch files (e.g. we:.commit-msg.txt) INSIDE the lane. Auto-pick's dirty/ahead refusal in we:scripts/lane-pool.mjs (laneDirtyOrAhead, chooseFreeLane) is deliberate and correct — it protects real uncommitted work per the documented lane-11 incident (#3390) — but nothing distinguishes known-safe litter from real work, and no periodic mechanical pass (we:skills-src/conveyor/runner.mjs's makeCliMechanicalPasses has no such pass; we:scripts/conveyor/tick-core.mjs never calls lane-pool refresh/provision) ever reclaims it. The pool therefore degrades monotonically toward zero acquirable lanes as sessions complete and release without ever being force-refreshed. Needs a root-cause fix: e.g. cmdRelease git-cleans a small NAMED allowlist of known scratch patterns before dropping the lease, and/or a periodic reap pass mirroring we:scripts/conveyor/duplicate-pr-watch.mjs's structural template — the exact approach is an open implementation choice, not dictated here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
