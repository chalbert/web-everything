---
bornAs: xmjcqwz
kind: story
size: 5
parent: "3383"
status: open
dateOpened: "2026-08-30"
tags: []
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

## Fix landed on `origin/lane/mechanical-dispatcher` (2026-08-31, commit `78234c18`) — still open, one gap remains

**`we:skills-src/conveyor/runner.mjs` gained `bookkeepingForDispatch(nextState, item)`**, an exported, pure
function called immediately before each item's own `dispatch-lane` call inside `makeCliDispatchPass`: it
strips ONLY that item's own guard entries (by num) from `buildGuards`/`prepareGuards`/`fixGuards`/
`ciHealGuards`, leaving every other item's guard — genuinely in flight, from a real prior dispatch or an
earlier iteration of the same loop — untouched. Restores the pre-dispatch view for the one item actually
being dispatched, without weakening the guard for anything else.

1. **Done.** `we:skills-src/conveyor/__tests__/runner.test.mjs` gained 5 tests for `bookkeepingForDispatch`
   directly (not a full CLI-shim stand-in — the function was factored out to be independently pure-testable,
   matching this file's own documented pure-core/IO-shell split, which is at least as strong a proof for this
   specific claim). Confirmed reddening pre-fix by hand: swapping the function for the old passthrough
   behavior fails 3 of the 5 new tests. 31/31 green post-fix; the full `skills-src/conveyor`, `scripts/conveyor`,
   `scripts/operations` suites (52 files / 1769 tests) green; `check:standards` 0 errors.
2. **Partially done — the spawn half is proven live; the lane-lease half was not observed.** Re-queued `#3412`
   (scope added by hand for the test, matching its own card text, not committed), fired
   `WE_DISPATCH_AGENT_ARGS='["--permission-mode","acceptEdits"]' node
   we:skills-src/conveyor/runner.mjs --once --json` for real from a scratch clone of the fixed branch.
   `dispatch.builds: [{"num":"3412","lane":4}]`, and — for the first time all session, across every attempt —
   `claude agents --json` showed a REAL new session: `conveyor-3412`, pid 76466, session
   `9bca2076-e799-40d6-8f83-e15ce2b037ec`, `claude` 2.1.251. The suppression is gone. What did NOT happen: the
   agent read its own starting cwd (the scratch clone, which had this very fix's own uncommitted work sitting
   in it — a testing artifact, not the target lane), correctly judged that wasn't a clean checkout to build in,
   and paused to ask rather than run `lane-pool acquire` over it — so lane-4 never actually went leased. Closed
   out cleanly per `#3353`'s protocol: `we:scripts/operations/wake.mjs --resolve` refused first (proof the
   handle read live), then `--force` closed it; the process was killed after. A cleaner re-run (a genuinely
   fresh scratch clone, no in-progress work sitting in it) would be needed to observe the lane-acquire half of
   this criterion directly — the spawn half, which is what this bug actually blocked, is now proven.
3. **Still open, not settled by this fix.** How the 2026-08-29 session's `#2936` dispatch succeeded through
   this same call path, despite the suppression being unconditional and present since `#2702`'s original
   tick-core, remains unreconciled. The fix removes the bug going forward; it does not explain why it was ever
   survivable. Left for whoever next has reason to care — not blocking, since the current behavior is now
   independently verified correct.
