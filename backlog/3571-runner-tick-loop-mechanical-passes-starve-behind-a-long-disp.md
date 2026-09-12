---
bornAs: xpshzms
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/__tests__/runner.test.mjs"]
dateOpened: "2026-09-07"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
tags: []
---

# Runner tick loop: mechanical passes starve behind a long dispatch-lane backlog

Live-caught 2026-09-07 root-causing PRs #1939/#1932 (2 stuck open PRs the mechanical layer should have already handled): we:skills-src/conveyor/runner.mjs's runLoop (on origin/lane/mechanical-dispatcher, not yet graduated to main -- #3443) runs dispatchPass (a sequential, blocking execFileSync spawn per dispatch-lane item, no timeout) BEFORE mechanicalPasses (we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/reconcile-fix-dispatch.mjs, the reapers). Confirmed live via a process sample of the resident runner (PID 73312, cwd wev-scratch-dispatcher-4): the main thread sat 100% inside node::SyncProcessRunner::Spawn dispatching one lane at a time for the whole sampled window. A big dispatch backlog (this repo has been very active tonight) can therefore block the monitoring sweeps -- and the heartbeat, called only after both -- for many minutes per tick. Confirmed root cause for #1939: it went mergeable:CONFLICTING at some point after its 2026-09-05T12:18 stale review:changes bounce, but we:scripts/conveyor/parked-pr-conflict-watch.mjs never applied merge-status:conflicting to it -- its GH label timeline shows zero such events ever -- unlike #1932, which the SAME pass DID catch (2026-09-05T11:48), hours before the backlog built up. Separately (a distinct, non-code finding): the runner's own log file silently stopped reflecting reality at 2026-09-06T22:16 (matches its sibling branch-sync logs' identical mtime in the same directory -- almost certainly a branch-sync restart there) while the long-lived runner process kept its fd open to the old, unlinked inode (confirmed via mismatched inode numbers) -- a pure observability gap, not the process being dead (GH label activity on #1932 at 02:23-02:49 the next day proves the runner kept ticking well after the log went silent). Fix: reorder runLoop so mechanicalPasses (heartbeat threaded in, unchanged) runs BEFORE dispatchPass each tick, so the monitoring sweeps always get a turn every ~120s regardless of dispatch-backlog size -- this mirrors the #3404 precedent (verify-dispatch already got heartbeat-safe treatment; dispatch-lane's own loop in makeCliDispatchPass never did). Rule 4 of mechanical-delivery-doctrine applies -- this can be (and was) fixed directly on origin/lane/mechanical-dispatcher, no PR/review ceremony, since nothing here has graduated to main yet.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/runner.test.mjs -t xpshzms` fails against
   the pre-fix call order (dispatchPass before mechanicalPasses) and passes against the current one — verified
   live by temporarily swapping the two calls back and re-running.

## Progress

- The code fix (reorder `runLoop` so `mechanicalPasses` runs before `dispatchPass`) was already committed
  directly to `origin/lane/mechanical-dispatcher` per Rule 4 of mechanical-delivery-doctrine (commit
  `8ada649d`, before this item's own build turn started).
- This turn added the missing executable regression test pinning that call order (`we:skills-src/conveyor/__tests__/runner.test.mjs`, test
  `xpshzms (#3571)`), confirmed red against the old order and green against the current one, and closes out
  the item's remaining "Done when" gap. Committed + pushed straight to `origin/lane/mechanical-dispatcher`,
  no PR/review ceremony, same Rule 4 basis as the code fix itself.
