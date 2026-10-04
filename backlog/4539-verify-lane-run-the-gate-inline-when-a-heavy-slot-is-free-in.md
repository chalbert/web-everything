---
bornAs: x5awn7x
kind: story
size: 3
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/verify-lane.test.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/__tests__/lane-verify.test.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "bc2b51e50a781b4ab6e1840d64121052aedc6b19"
tags: []
---

# verify-lane: run the gate inline when a heavy slot is free, instead of queue-and-poll

Split from #4473 MVP item (2). we:scripts/verify-lane.mjs request currently always defers to we:scripts/conveyor/verify-dispatch.mjs's next tick even when acquireSlotBlocking (we:scripts/readiness/heavy-admission.mjs) could grant a slot immediately, forcing an unconditional round-trip (request, then poll check) for every verify, even when there is zero queue contention. When a slot is free at request time, run the gate inline (synchronously, in the requesting process) instead of stamping running and waiting for the daemon's next tick; when no slot is free, keep the existing queue-and-poll path unchanged. Edge cases to name explicitly in the build: (a) a slot that frees between the admission check and the inline run starting (no double-run/double-slot-consumption), (b) the inline path must still write the SAME running/green/red marker lifecycle request already contracts (no new marker vocabulary), (c) an inline run that itself takes the full 150-350s must not block past this tool's foreground window when called from an interactive agent session (we:scripts/guard-bash.mjs's allow-list implications), (d) we:scripts/conveyor/verify-dispatch.mjs's own dispatch of a lane already inline-completed must not double-dispatch it. Needs a real-git integration/wiring test proving the inline path actually executes end to end (not just a unit test of the admission check), plus a wiring test that we:scripts/conveyor/verify-dispatch.mjs correctly skips a lane already inline-verified.

## Premise check

Checked against `main` @ bc2b51e50: not delivered. `git log --all --grep='4539\|4539'` finds only the JIT-numbering commit (610014d29). we:scripts/verify-lane.mjs:354-355 still unconditionally `emit`s `status: 'requested'` for `MODE === 'request'`, after the cache-hit block (we:scripts/verify-lane.mjs:326-341) and the START `writeMarker` (we:scripts/verify-lane.mjs:343). The only admission call (`acquireSlotBlocking`, we:scripts/verify-lane.mjs:373) is reached solely by the bare `verify`/dispatched-child path. we:scripts/conveyor/verify-dispatch.mjs:179 `laneNeedsVerifyDispatch` fires on any `running` marker whose `sha` is HEAD. we:scripts/guard-bash.mjs:524-528 whitelists `request|check|reset` as "fast, non-blocking" for dispatched agents — this constrains edge (c). Scope extended to we:scripts/conveyor/verify-dispatch.mjs, we:scripts/lib/lane-verify.mjs (`verifyStartBody` has a closed field list) and we:scripts/guard-bash.mjs.

## Design

**Inline is opt-in: `request --inline`** (edge c). Plain `request` stays fast and non-blocking, so the guard-bash sanction for dispatched agents stays true; dispatched agents never pass `--inline`. `--inline` is for interactive/operator callers, who run it in the foreground with the explicit 600000 ms Bash timeout (gate 150-350 s). we:scripts/guard-bash.mjs gets a deny that keys on the `--inline` token ANYWHERE in the verify-lane segment (not on adjacency to `request`, because `SANCTIONED_VERIFY_LANE_QUERY` at :524-528 accepts `request` followed by anything): `request --inline`, `request --inline=true`, `request --gate="…" --inline` and `request --inline --gate="…"` are all denied for a dispatched agent, while plain `request` stays allowed.

Flow for `request --inline` (in we:scripts/verify-lane.mjs, after the cache-hit block at :326-341, BEFORE the START write at :343):
1. If `isAdmissionOff` or the queue has a live older waiter (`isOldestLiveWaiter`, we:scripts/readiness/heavy-admission.mjs:853 — so inline never cuts ahead of queued work, the #3383 fairness rule) → fall back to the unchanged `requested` path.
2. Otherwise one non-blocking `tryAcquireSlot` (we:scripts/readiness/heavy-admission.mjs:568) with the same slot order and `meta {kind, acquiredAt}` the blocking path passes (export the slot-order/kind helpers it needs). Lost race (`ok:false`) → the unchanged `requested` path (edge a: `reserve` is atomic, so no double run).
3. Only on a WON slot: write the START marker ONCE, carrying optional `inline: true` and `pid` (extend `verifyStartBody`, we:scripts/lib/lane-verify.mjs:243 — optional fields on the existing `running` shape, no new status; edge b). Both fields are OMITTED (not `undefined`) on a plain marker, and `pid` is enforced as `Number.isInteger(pid) && pid > 0` both when written and when the marker is read: pid `0`, a negative pid or a non-integer would make a signal-0 probe hit a process group / every process and report "alive", so a malformed `pid` is treated as no live inline run (the lane is dispatched normally). The marker therefore never shows plain `running` between a failed/won attempt, closing the daemon race.
4. Run existing steps 3-4 (gate + finish-write, we:scripts/verify-lane.mjs:375-470) with `admission` pre-set to the won slot (`let`, branch around the `acquireSlotBlocking` call at :373) so the existing `finally` releases exactly one slot. Add SIGTERM/SIGINT handling that FIRST kills the gate child's process group (the gate is spawned `shell: true`, so a signal to verify-lane alone leaves the gate running; spawn it detached/in its own group so the whole tree can be signalled), waits for it to exit, and only THEN releases the slot — releasing while the gate lives would let a second heavy run onto the same capacity. The handler also settles the marker as non-green (so it is not left `running` with a dead pid). SIGKILL cannot be handled; it is covered by dead-pid slot reclaim, and the stranded `running` marker is recovered by the dispatcher (dead pid → dispatched).

Edge (d): `laneNeedsVerifyDispatch` (we:scripts/conveyor/verify-dispatch.mjs:179) stays PURE: the shell passes it an injected `pidAlive(pid)` result (from `probeSlotHolderLiveness`). It returns false for a `running` marker with `inline: true` and a live pid, bounded by marker age (a live-but-ancient inline marker falls back to normal recovery). The bound is a named constant, `INLINE_MARKER_MAX_AGE_MS`, derived as `VERIFY_DISPATCH_TIMEOUT_MS` (30 min, we:scripts/conveyor/verify-dispatch.mjs:133) + `QUEUE_PHASE_BUFFER_MS` (5 min, :160) = 35 min — computed from those constants so it can never sit below the gate's dispatch ceiling and re-dispatch a live inline run. `unknown` liveness (EPERM/self) is treated as live within the age bound; a dead pid is dispatched as stranded-`running` today.

## MVP

Musts: (1) `request --inline` branch per the flow above (waiter check, won-slot-only marker, one slot, signal handling that kills the gate's process group before releasing the slot); (2) optional `inline`/`pid` marker fields, `pid` validated as a positive integer; (3) dispatcher skip for a live inline run with injected liveness + the named `INLINE_MARKER_MAX_AGE_MS` bound; (4) guard-bash deny keyed on the `--inline` token anywhere in the segment; (5) the tests below — every MUST above has a named assertion in the Test plan.
Out of scope: making inline the default; a fast-lane slot when heavy slots are full; progress-streaming differences; changing the 600 s tool-window policy.

## Test plan

Real-git integration style (we:scripts/operations/__tests__/verify-integration.test.mjs), temp repo and temp admission root:
1. `request --inline --gate="node -e 0" --json`, free slot → exit 0, `status:'green'`, terminal green marker for HEAD. RED before: flag ignored, returns `requested` with a `running` marker.
2. During the run (gate script reads the marker and slot dir) the marker is `running` with `inline:true`+`pid`, exactly one slot held; after: green and zero slots held. RED before: no `inline` field, no slot.
3. All slots held by a live foreign owner → `requested`, marker has NO `inline`, gate not run (passes today; guards the fork).
4. Lost race (seam: slot taken between waiter check and try) → `requested`, no double run, no marker `inline`. RED before only via the missing seam; new coverage for edge (a).
5. A live older waiter queued → `requested` (no cutting ahead). RED vs a naive tryAcquire.
6. Plain `request` (no flag) with a free slot → `requested` as today; cache-hit and `--run-id` dispatched-child paths unchanged; `isAdmissionOff` → `requested`.
7. Wiring (we:scripts/conveyor/__tests__/verify-dispatch.test.mjs): marker `running`+`inline`+injected live pid → `runVerifyDispatch` spawns nothing (RED before: dispatches); same with dead pid → dispatches (passes today, regression guard); live pid past the age bound → dispatches.
8. we:scripts/guard-bash.mjs (we:scripts/__tests__/guard-bash.test.mjs), table-driven over flag position and form for a dispatched agent: `request --inline`, `request --inline=true`, `request --gate="…" --inline`, `request --inline --gate="…"` all denied; plain `request`, `request --gate="…"`, `check`, `reset` allowed; the same `--inline` forms allowed for a non-dispatched (operator) session (RED before: every row allowed).
9. Signal handling (we:scripts/__tests__/verify-lane.test.mjs or we:scripts/operations/__tests__/verify-integration.test.mjs): start `request --inline --gate="<long sleep that records its own pid>"`, send SIGTERM (and a second case SIGINT) to the verify-lane process mid-gate → the gate child (and its process group) is gone, zero slots held, marker no longer `running`. RED before: no handler, slot/gate leak.
10. Pure unit cases for we:scripts/lib/lane-verify.mjs (we:scripts/__tests__/lane-verify.test.mjs): `verifyStartBody` WITHOUT inline/pid has no `inline`/`pid` keys at all (not `undefined`); with them, the fields appear; `pid` of `0`, `-1`, `1.5`, `"12"`, `NaN` is rejected/omitted.
11. Pure truth table for `laneNeedsVerifyDispatch` (we:scripts/conveyor/__tests__/verify-dispatch.test.mjs): `inline` marker × liveness `alive` / `dead` / `unknown` × age (inside / beyond `INLINE_MARKER_MAX_AGE_MS`) — only alive-or-unknown inside the bound returns false; plus a case pinning `INLINE_MARKER_MAX_AGE_MS >= VERIFY_DISPATCH_TIMEOUT_MS`.
12. Wiring, named: `runVerifyDispatch skips an unexpired inline marker with unknown liveness` (spawn-count 0), alongside the live/dead/beyond-age spawn-count cases in 7.
13. Malformed pid (`inline:true` with `pid:0`, `-1`, `1.5`) in a marker → `runVerifyDispatch` dispatches (not skipped as "alive"), spawn-count 1.
14. we:scripts/readiness/__tests__/heavy-admission.test.mjs: the newly exported slot-order/kind helper(s) used by the inline path return the same order/meta the blocking path passes (RED before: not exported).

## Proof plan

In a lane clone with a free slot, hold the inline run open with `--gate="sleep 60"` and capture: (1) the marker JSON mid-run (`running`, `inline:true`, `pid`) and the admission slot-dir listing before/during/after (0/1/0); (2) `--dry-run` on we:scripts/conveyor/verify-dispatch.mjs mid-run showing the lane is not dispatched; (3) a normal-gate `request --inline` printing `green` in one call vs the old `requested` + follow-up `check` (before/after, wall time); (4) with all slots held, `request --inline` still returns `requested`.

## Follow-ups

- Fast-lane-aware inline when heavy slots are full.
- Surface `inline` in the `queue`/`wip` reports.
- Update verify docs/skill briefs that say "request then poll" to mention `--inline` for interactive use.
- Consider making inline the default for interactive (non-dispatched) sessions once proven.

## Done when

1. **Executable** — vitest on we:scripts/operations/__tests__/verify-integration.test.mjs, we:scripts/conveyor/__tests__/verify-dispatch.test.mjs and the guard-bash, verify-lane, lane-verify and heavy-admission tests pass, including the new inline cases (the RED ones above fail on `main` today).

## Progress

Prepared: premise confirmed undelivered; adversarial review applied (inline made opt-in, marker written only on a won slot, fairness/waiter check, pure dispatcher with injected liveness, scope widened to we:scripts/lib/lane-verify.mjs and we:scripts/guard-bash.mjs).
