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

Checked against `main` @ bc2b51e50: not delivered. `git log --all --grep='4539\|x5awn7x'` finds only the JIT-numbering commit (610014d29). we:scripts/verify-lane.mjs:354-355 still unconditionally `emit`s `status: 'requested'` for `MODE === 'request'`, after the cache-hit block (we:scripts/verify-lane.mjs:326-341) and the START `writeMarker` (we:scripts/verify-lane.mjs:343). The only admission call (`acquireSlotBlocking`, we:scripts/verify-lane.mjs:373) is reached solely by the bare `verify`/dispatched-child path. we:scripts/conveyor/verify-dispatch.mjs:179 `laneNeedsVerifyDispatch` fires on any `running` marker whose `sha` is HEAD. we:scripts/guard-bash.mjs:524-528 whitelists `request|check|reset` as "fast, non-blocking" for dispatched agents — this constrains edge (c). Scope extended to we:scripts/conveyor/verify-dispatch.mjs, we:scripts/lib/lane-verify.mjs (`verifyStartBody` has a closed field list) and we:scripts/guard-bash.mjs.

## Design

**Inline is opt-in: `request --inline`** (edge c). Plain `request` stays fast and non-blocking, so the guard-bash sanction for dispatched agents stays true; dispatched agents never pass `--inline`. `--inline` is for interactive/operator callers, who run it in the foreground with the explicit 600000 ms Bash timeout (gate 150-350 s). we:scripts/guard-bash.mjs gets a test pinning that a dispatched agent's `request --inline` is denied while plain `request` stays allowed.

Flow for `request --inline` (in we:scripts/verify-lane.mjs, after the cache-hit block at :326-341, BEFORE the START write at :343):
1. If `isAdmissionOff` or the queue has a live older waiter (`isOldestLiveWaiter`, we:scripts/readiness/heavy-admission.mjs:853 — so inline never cuts ahead of queued work, the #3383 fairness rule) → fall back to the unchanged `requested` path.
2. Otherwise one non-blocking `tryAcquireSlot` (we:scripts/readiness/heavy-admission.mjs:568) with the same slot order and `meta {kind, acquiredAt}` the blocking path passes (export the slot-order/kind helpers it needs). Lost race (`ok:false`) → the unchanged `requested` path (edge a: `reserve` is atomic, so no double run).
3. Only on a WON slot: write the START marker ONCE, carrying optional `inline: true` and `pid` (extend `verifyStartBody`, we:scripts/lib/lane-verify.mjs:243 — optional fields on the existing `running` shape, no new status; edge b). The marker therefore never shows plain `running` between a failed/won attempt, closing the daemon race.
4. Run existing steps 3-4 (gate + finish-write, we:scripts/verify-lane.mjs:375-470) with `admission` pre-set to the won slot (`let`, branch around the `acquireSlotBlocking` call at :373) so the existing `finally` releases exactly one slot. Add SIGTERM/SIGINT release; SIGKILL is covered by dead-pid reclaim.

Edge (d): `laneNeedsVerifyDispatch` (we:scripts/conveyor/verify-dispatch.mjs:179) stays PURE: the shell passes it an injected `pidAlive(pid)` result (from `probeSlotHolderLiveness`). It returns false for a `running` marker with `inline: true` and a live pid, bounded by marker age (a live-but-ancient inline marker falls back to normal recovery); `unknown` liveness (EPERM/self) is treated as live within the age bound; a dead pid is dispatched as stranded-`running` today.

## MVP

Musts: (1) `request --inline` branch per the flow above (waiter check, won-slot-only marker, one slot, signal release); (2) optional `inline`/`pid` marker fields; (3) dispatcher skip for a live inline run with injected liveness + age bound; (4) guard-bash pin; (5) the tests below.
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
8. we:scripts/guard-bash.mjs: dispatched-agent `request --inline` denied, plain `request` allowed (RED before: both allowed).

## Proof plan

In a lane clone with a free slot, hold the inline run open with `--gate="sleep 60"` and capture: (1) the marker JSON mid-run (`running`, `inline:true`, `pid`) and the admission slot-dir listing before/during/after (0/1/0); (2) `--dry-run` on we:scripts/conveyor/verify-dispatch.mjs mid-run showing the lane is not dispatched; (3) a normal-gate `request --inline` printing `green` in one call vs the old `requested` + follow-up `check` (before/after, wall time); (4) with all slots held, `request --inline` still returns `requested`.

## Follow-ups

- Fast-lane-aware inline when heavy slots are full.
- Surface `inline` in the `queue`/`wip` reports.
- Update verify docs/skill briefs that say "request then poll" to mention `--inline` for interactive use.
- Consider making inline the default for interactive (non-dispatched) sessions once proven.

## Done when

1. **Executable** — vitest on we:scripts/operations/__tests__/verify-integration.test.mjs, we:scripts/conveyor/__tests__/verify-dispatch.test.mjs and the guard-bash test passes, including the new inline cases (the RED ones above fail on `main` today).

## Progress

Prepared: premise confirmed undelivered; adversarial review applied (inline made opt-in, marker written only on a won slot, fairness/waiter check, pure dispatcher with injected liveness, scope widened to we:scripts/lib/lane-verify.mjs and we:scripts/guard-bash.mjs).
