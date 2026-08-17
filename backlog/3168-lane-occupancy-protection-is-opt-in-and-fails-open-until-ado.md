---
bornAs: x0jb8ew
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Lane occupancy protection is opt-in and fails open until adopted

Surfaced by the independent reviewer of #1448 while assessing whether lane-pool leasing alone is a sufficient substitute for the harness's own EnterWorktree isolation. we:scripts/guard-lane.mjs's per-lane occupancy protection only activates once a lane is explicitly adopted (`node we:scripts/lane-pool.mjs adopt`, or `acquire --adopt`) -- a freshly acquired-but-not-yet-adopted lane stays fail-open for Edit/Write from ANY session, confirmed live tonight: several `acquire` calls this session printed "occupant: NOT declared -- until then the Edit/Write guard stays fail-open for this lane." The guard also documents (per its own header) that it separates sessions but not sibling agents of one session, and fails open on any internal error. None of this is closed by #1448's EnterWorktree opt-out -- a worktree only isolates a session from its own cwd's shared checkout, it does nothing to stop a sibling agent (or an unadopted lane's fail-open window) from writing into a lane another session believes it exclusively holds. Given how much of tonight's orchestration relied on lane-pool exclusivity being real, this fail-open window and the sibling-agent gap are worth closing directly rather than assumed away: either make occupancy protection active immediately on acquire (not deferred to an explicit adopt step), or make the fail-open window's existence loud (a visible warning in the build-dispatch operation's own output, not just the acquire command's stdout) so an orchestrating session doesn't treat lane-pool exclusivity as a stronger guarantee than it currently is.

## Done when

1. **Executable** — a test asserting that a freshly-`acquire`d, not-yet-`adopt`ed lane's `isForeignOccupancy` (we:scripts/lib/lane-lease.mjs:195-199) returns `true` (foreign, i.e. protected) for a session that isn't the acquirer, instead of today's `false` (allowed) — fails today (an unadopted lease has no `workerSession`, so the check short-circuits to not-foreign), passes once occupancy is enforced immediately on acquire rather than deferred to `adopt`.
2. If immediate enforcement isn't the chosen fix, an alternative: `node we:scripts/lane-pool.mjs acquire`'s fail-open window is surfaced as a visible warning from the build-dispatch operation itself (we:scripts/operations/dispatch-lane.mjs), not only in the acquire command's own stdout — a test asserts the dispatch-lane run record or its printed output names the fail-open state when it applies.
3. we:scripts/guard-lane.mjs's `KNOWN RESIDUALS` header is updated to reflect whichever of the two is chosen, so the doc comment stops describing a gap the code no longer has (or, if left open by design, states why).
4. `npm run check:standards` and the relevant we:scripts/__tests__/guard-lane*.test.mjs / we:scripts/lib/__tests__/lane-lease*.test.mjs suites are green.
