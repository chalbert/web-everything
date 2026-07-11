---
bornAs: x14u8be
kind: story
size: 3
status: open
dateOpened: "2026-07-11"
tags: []
---

# watch-mode lander keeps enforcing retired policy after its own code changes on main — self-detect staleness and exit

A long-running we:scripts/merge-ai-prs.mjs --watch process executes the code loaded at start. Observed 2026-07-11 and self-diagnosed in PR #407's post-merge panel audit (comment 02:59Z): PR #401 (#2425) removed the review-escalation merge-anyway timer and landed mid-watch, yet the pre-land watch process later timer-merged parked PR #407 UNREVIEWED at the 30-min mark — enforcing policy main had already retired.

## Build

Each watch pass compares the running lander's source identity — the git blob shas of we:scripts/merge-ai-prs.mjs plus its gate/lib deps (we:scripts/lib/review-escalation.mjs, we:scripts/lib/review-core.mjs) recorded at start — against origin/main now. On drift in any of those modules, exit cleanly with a distinct staleness exit code and a "lander code changed on main — restart me" message (the operator or a wrapper relaunches on fresh code). Unrelated file changes never trigger it.

## Acceptance

A simulated change to a gate module on main makes the next pass exit with the staleness code; a change to an unrelated file does not; a bare (non-watch) pass is unaffected.
