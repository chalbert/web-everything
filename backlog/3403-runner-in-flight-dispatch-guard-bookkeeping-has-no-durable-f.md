---
bornAs: xuvgq4a
kind: story
size: 3
parent: "3383"
status: resolved
dateOpened: "2026-08-30"
dateResolved: "2026-09-02"
tags: []
scope:
  - we:skills-src/conveyor/
  - we:scripts/conveyor/
---

# Runner in-flight dispatch-guard bookkeeping has no durable floor, so a crash-restart reopens the double-dispatch race #3177 already reproduced live

we:skills-src/conveyor/runner.mjs carries the tick core in-flight/prepare/fix guard bookkeeping (the num+lane spawned-but-not-yet-claimed entries, keyed off nextState) purely in the process closure of runLoop -- nothing writes it to disk. we:scripts/conveyor/tick-core.mjs own header confirms this is deliberate ("no parallel on-disk state store is ever created") for the SKILL-driven caller, but we:skills-src/conveyor/supervisor.mjs (built this epic) now restarts a crashed runner as its ONLY recovery path, and the fresh process starts with EMPTY bookkeeping. Unlike the fix/ci-heal retry-cap counters, which we:scripts/conveyor/__tests__/tick-core.test.mjs explicitly proves bind from a DURABLE floor when "a restart wiped the in-session tally" (#2643/#2666), the build in-flight guard has no such durable floor -- only an in-memory 3-tick TTL meant to catch an agent that died after spawn but before claiming. A crash-restart in that same window reopens exactly the live-reproduced double-dispatch #3177 already tracks (two agents on #3151/#3150/#3154/#2972), but via the NEW automatic supervisor-restart path rather than the scope of #3177 itself (a manual redispatch of we:scripts/operations/dispatch-lane.mjs after an operator kills a pid). Checked against #3177 (open, scoped to the write/redispatch side, not runner-internal restart bookkeeping) and #2702 (its Done-when line 19 claims "durable guard state surviving a runner restart -- delivered in #2699", which is stale relative to the shipped we:skills-src/conveyor/runner.mjs: #2699 only made tick-core PURE/stateless, it never added persistence, and no caller built since has added it either).

## Landed

**`we:scripts/conveyor/tick-core.mjs`** gained `durableBuildNums()` — the restart-surviving ground-truth
floor for the build in-flight guard. Given the live `claude agents --json` session listing (or plain name
strings), it extracts every num with a live `conveyor-<num>` BUILD session. `planTick` folds these in as
synthetic `lane: null` guard entries alongside the in-memory `build.live` guards before filtering launches
— so a supervisor crash-restart that wipes the in-session bookkeeping can no longer re-launch a build whose
OS session is still actually alive.

1. **Done — mirrors the `#2643`/`#2666` retry-cap durable-floor precedent**, reading a ground-truth fact
   each tick (a live session listing) instead of trusting only the in-process TTL.
   `we:scripts/conveyor/__tests__/tick-core.test.mjs` has a dedicated `describe('durableBuildNums — #3403
   the restart-surviving build-guard floor', ...)` block covering num normalization (padded/suffixed),
   non-build session kinds being excluded, and `undefined`/`null`/malformed input.
2. Disjoint from `#3177` (the manual redispatch write path) — this closes the automatic supervisor-restart
   path instead.

## Done when

1. **Executable** — a test on `we:skills-src/conveyor/__tests__/runner.test.mjs` (or `we:scripts/conveyor/__tests__/tick-core.test.mjs`) reproduces the race: a build guard entry is live (spawned, not yet claimed), the runner's bookkeeping is reset to `{}` (simulating a supervisor crash-restart), and the very next tick is asserted to NOT re-launch the same num/lane — fails today (no durable floor exists to block it), passes once one of the fixes below lands.
2. A design is recorded and built for what "durable floor" means for the build in-flight guard specifically — mirroring the `#2643`/`#2666` retry-cap precedent (read a fact from the ground truth each tick — e.g. whether the OS process/session the dispatch spawned is still alive, or a persisted marker under `we:.operations/` — rather than trusting only the in-process TTL countdown).
3. Cites and stays disjoint from `#3177` (the manual dispatch-lane-redispatch write path) and corrects `#2702`'s stale "delivered in #2699" claim (either by fixing the claim there or noting it resolves the gap #2702 asserted was already closed).
