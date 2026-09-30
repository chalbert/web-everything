---
kind: story
size: 2
status: resolved
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/build-dispatch-hold-router.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-30"
preparedAgainstSha: "d3186871fc83413dc52420739864b4bde55fbaff"
tags: []
---

# Standalone worker that finds a card already done resolves it (graduatedTo), not a decline

2026-09-30 ~1 AM UTC: an agy standalone run on #3353 (via we:scripts/operations/probation-build-run.mjs) reported the card already delivered — its fixture and liveness checks already exist on main — but the runner treated it as worker-declined, tried to land a Findings note, the gate went red, and no PR opened, so the done card stays open and will be re-offered. The builder already has this path: the hold router classifies already-done and resolves with a cited commit (#4465, we:scripts/conveyor/build-dispatch-hold-router.mjs / we:scripts/operations/build-dispatch-hold-route-land.mjs). MVP: when the worker changes nothing and its final message says the work already exists, run the same already-done classifier (grep the card Done-when against main + git log for the delivering commit); if it classifies already-done, land the resolve with graduatedTo through the hold router landing pass; otherwise keep the worker-declined path. Test: fixture message "already exists ... all Done-when checks pass" → resolved with a commit; a genuine decline → held. Proof: replay #3353.

## Done when

1. **Executable** — `npx vitest related "$(git ls-files '*probation-build-run.mjs')" --run` passes: a no-change already-done report lands a card-only resolve with the delivering commit as `graduatedTo`; a genuine decline retains its hold and Findings path.

## Prep

The existing classifier is `planHoldRouting` / `classifyHoldReason`: it recognizes
`spec already done on main: commit <sha>`. It does not itself grep arbitrary Done-when prose.
The worker brief therefore requests verification against main and a git-log delivery citation in
that existing format. Classify the original final message before adding `worker-declined:`, which
intentionally overrides an embedded citation. An uncited assertion remains a decline.

Reuse `landRoute` in the already-acquired lane after restoring the pre-claim tree. The shared landing
pass fetches main, checks ancestry, card/bornAs references, non-backlog changes, and a full-delivery
subject before invoking `resolve --graduated-to`. Reserve the shared routing lease and dispatch hold
first; retain them through landing. Failed citation validation reports failure without resolving or
falling through to a decline. Keep the normal build and genuine-decline paths unchanged.

Replay #3353's reported already-exists outcome with the local history's delivery citation
`0ee967238` (`#3353: harden the three claude-agents liveness readings`), not a new live worker or PR.
Use isolated temporary Git repositories to prove the shared landing writes `graduatedTo`, rejects an
unrelated real commit, preserves scope, and leaves the launch checkout byte-clean. The existing decline
probes cover Findings, scope removal, the retained hold, and the verified parked PR.
