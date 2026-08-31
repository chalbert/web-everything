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
3. Root-caused against the branch's own commit history (bisect or targeted diff read) whether this is a
   long-standing defect or a regression introduced by later layering (`#3105`/`#3110`) on top of whatever the
   2026-08-29 session's successful `#2936` dispatch actually ran — named explicitly in the fix's own PR
   description either way, since it changes how much of this epic's "proven" history needs re-trusting.
