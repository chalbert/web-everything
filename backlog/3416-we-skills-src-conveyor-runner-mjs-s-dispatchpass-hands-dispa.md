---
bornAs: xmjcqwz
kind: story
size: 5
parent: "3383"
status: resolved
dateOpened: "2026-08-30"
dateResolved: "2026-09-02"
tags: []
scope:
  - we:skills-src/conveyor/
---

# we:skills-src/conveyor/runner.mjs's dispatchPass hands dispatch-lane a bookkeeping snapshot that already contains the guard it just planned, suppressing the very spawn it exists to record

Reproduced live tonight (2026-08-30/31), twice, on origin/lane/mechanical-dispatcher: one real we:skills-src/conveyor/runner.mjs --once --json tick against a queued item (#3412, first with no scope so it routed to spawnPrepareScope, then with scope added so it routed to spawnBuilds) never actually spawns an agent -- dispatch-lane's own run record reports dispatching:false, holdReason 'suppressed by the in-flight build guard (an agent is already in flight for this item)' (or the prepare-scope equivalent), even though claude agents --json and the shared lane pool both confirm nothing was ever spawned (lane-1 stayed clean/unleased). Root cause traced in we:skills-src/conveyor/runner.mjs's makeCliDispatchPass: the runner's OWN tick-core call computes both the dispatch decision (dispatch.builds/prepareScope) AND the updated guard bookkeeping (nextState.buildGuards/prepareGuards) in one pass -- the new guard entry for the item about to be dispatched is already present in nextState BEFORE dispatch-lane is ever called. That nextState is then written verbatim to the bookkeeping file and handed to dispatch-lane --num=<n> --bookkeepingFile=<file>, whose own internal tick-core re-plan (we:scripts/conveyor/tick-core.mjs's planPrepareSpawns/build-guard equivalent) reads that bookkeeping as the CURRENT guard state, sees the item's guard already live, and suppresses it as an already-in-flight duplicate -- correctly, by its own logic, but the guard it is honoring was written by planning, not by a real spawn. This appears to be a genuine, reproducible, likely SEVERE bug in the exact runner-to-dispatch-lane call path (we:skills-src/conveyor/runner.mjs's dispatchPass/makeCliDispatchPass) that #3383's own Done-when #1 (a full fix->review->land cycle with zero interactive-session turns) depends on -- it may explain why no live dispatch through THIS exact pipeline has ever been observed succeeding, as distinct from the 2026-08-29 session's success, which by the epic's own history dispatched #2936 directly through an earlier state of this machinery (predating #3105/#3110's later layering) rather than through this exact bookkeeping-forwarding shape. Not bisected to the exact introducing commit -- left for whoever picks this up. Full evidence (two tick JSON outputs, both .operations/runs/dispatch-lane-*.json records under we:.operations/runs/, the exact holdReason strings) is transcribed into #3383's own session-update section.

**Update (2026-08-31): the mechanism is unconditional, not a #3105/#3110 regression — narrows, but does not
close, the open question.** `git diff` between the "recovered" runner-wiring commit (`e20a5984`, the FIRST
commit to wire `dispatchPass` to real `dispatch-lane` calls) and the `#3105` commit that lands next on this
branch (`e0550673`) shows `we:scripts/conveyor/tick-core.mjs` UNCHANGED — `#3105`/`#3110` touch only
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-lane-io.mjs`, never the
guard-planning logic. Reading `we:scripts/conveyor/tick-core.mjs`'s `planTick` directly: `filterLaunches`
(around line 264) decides what to spawn, and the very next lines unconditionally build `newBuildGuards` from
that same spawn list and fold it into the `nextState` returned alongside the decision — for every tick, every
item, no conditional path around it. This is unconditional, deterministic behavior of `planTick` itself,
present since `#2702`'s original tick-core, not something `#3105`/`#3110` introduced or could have introduced.
That means, as currently understood, this suppression should fire 100% of the time for ANY fresh item
dispatched through `we:skills-src/conveyor/runner.mjs`'s tick-loop `dispatchPass` — which makes the
2026-08-29 session's own account of successfully dispatching `#2936` through this exact wiring
(`origin/lane/mechanical-dispatcher-recovered`, the same `we:skills-src/conveyor/runner.mjs --once` call
shape) genuinely hard to reconcile with this reading. Two honest possibilities, neither confirmed: (a) the
"recovered from session transcripts" reconstruction of `we:skills-src/conveyor/runner.mjs` subtly altered
this wiring relative to what actually ran and worked that day — the epic's own recovery write-up already
flags "10 of 12 cross-checked files matched the backup exactly," implying 2 did not, and this file could be
one; or (b) some condition specific to that session (not visible from a static read) let the dispatch through
despite this logic. Not resolved — the exact commit that ran on 2026-08-29 was not preserved as a literal,
diffable point in this branch's reconstructed history, so a real bisect against it is not possible with what
is on disk.

## Landed

**`we:skills-src/conveyor/runner.mjs`** gained `bookkeepingForDispatch()`, called right before each item's
own `dispatch-lane` call. Root cause: the runner's tick-core read computes both the dispatch decision and
the updated guard bookkeeping in one pass, so the new guard entry for the item about to be dispatched was
already present in `nextState` before `dispatch-lane` was ever invoked — `dispatch-lane`'s own independent
tick-core re-plan then read that bookkeeping, saw the item's guard already "live," and suppressed the very
spawn it was about to make as an already-in-flight duplicate. `bookkeepingForDispatch(nextState, item)`
strips ONLY the target item's own guard entries (build/prepare) from the snapshot handed to that item's
`dispatch-lane` call — every other item's guards stay intact.

1. **Done — docblock explicitly tagged `#3416`** at the file header, `bookkeepingForDispatch` itself, and
   its call site.
2. `we:skills-src/conveyor/__tests__/runner.test.mjs` has a dedicated `describe('bookkeepingForDispatch
   (#3416) — strips ONLY the target item\'s own guard, nothing else', ...)` block.
3. Live-verified (see `#3383`'s own session history): a real tick against `#3412` with the fix in place
   produced an actual `claude --bg` spawn (`conveyor-3412`) instead of `holdReason: "suppressed by the
   in-flight build guard"`.

## Done when

1. **Executable — a mutation test on `we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass`** reproducing
   this exact shape: a tick-core read that surfaces one new build (or prepare-scope) candidate with no prior
   guard, fed through `dispatchPass` end to end (a fake `dispatch-lane` CLI stand-in, mirroring the existing
   `-live` test pattern), asserts the stand-in actually receives a bookkeeping snapshot in which the candidate's
   OWN guard is NOT yet present — i.e. `dispatch-lane` gets a chance to decide before the guard that would
   suppress it exists. Must fail before this item's fix lands (bookkeeping already contains the new guard) and
   pass after.
2. A real live tick against a queued, unblocked item with no prior in-flight guard (mirroring tonight's #3412
   reproduction) results in `dispatching: true` and an actual `claude --bg` spawn — verified via `claude agents
   --json` showing a new session and the target lane going leased — not `holdReason: "suppressed by the
   in-flight build guard"` against a guard the SAME tick just planned.
3. ~~Root-caused against the branch's own commit history...~~ **Partially done — see the 2026-08-31 update
   above.** Confirmed NOT a `#3105`/`#3110` regression (`we:scripts/conveyor/tick-core.mjs`'s guard-planning
   logic is byte-identical across both commits, and unconditional since `#2702`). What remains open, and
   should still be named explicitly in the fix's own PR description: reconcile this unconditional-suppression
   reading against the 2026-08-29 session's own account of a successful `#2936` dispatch through the same
   `we:skills-src/conveyor/runner.mjs --once` wiring — either the "recovered from transcripts" reconstruction
   subtly altered this file relative to what actually ran that day, or something session-specific let it
   through. Neither is confirmed; the fix should settle it, not just patch around it.
