---
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Decouple conveyor tick cadence from gate/check duration (verify-dispatch and similar mechanical passes)

Live incident, epic #3383, 2026-09-14: we:scripts/conveyor/verify-dispatch.mjs runs one lane's gate to completion, synchronously (execFileSync), before even looking at the next lane -- "ONE REQUEST PER TICK, HANDLED TO COMPLETION BEFORE THE NEXT IS CONSIDERED" is documented as deliberate. A slow-but-healthy gate (contention, not a true hang) ran ~3x its documented 150-350s ceiling and blocked ALL dispatch for 16+ minutes with nothing to auto-recover it (watchdog healEnabled is off). A same-night interim fix (this session) added a hard wall-clock timeout to that spawn so a run can no longer block forever -- but tick cadence still depends on how long the gate takes: a slow-but-healthy run still occupies the whole tick, still delays every other lane behind it, right up to the new ceiling.

Operator-raised follow-up during that incident: the deeper fix is to decouple tick cadence from gate duration entirely. A tick should fire on its own fixed schedule regardless of whether a prior gate is still running -- a long-running verification becomes polled background state ("is this done yet?") that a LATER tick checks on, rather than something the CURRENT tick's forward progress blocks on. This is real control-flow surgery on the live dispatch pass, not a parameter tweak: it likely means moving from execFileSync's blocking spawn to a detached, non-awaited spawn plus a small persisted in-flight-dispatch record (pid, lane, startedAt) that later ticks reconcile against (finished -> reap result; still running -> leave it; exceeded ITS OWN timeout -> kill via the group-kill mechanism the interim fix already built) -- while preserving the existing singleton-runner / one-verify-per-lane invariants the current header comment documents and other code may rely on.

This was deliberately NOT attempted live during the incident: it changes core tick-loop control flow in production dispatch infrastructure that gates every PR landing in this repo, under time pressure and heavy host load, and the repo's own decision doctrine (#39, never take an unprepared decision) argues for a real /prepare pass -- naming the concrete design options, their tradeoffs on the marker/lease invariants, and a recommended default -- before building it, not a same-night snap implementation. The interim wall-clock-timeout fix (PR #2232) already ships tonight as the safety net that makes today's failure mode (unbounded block) impossible; this item is the follow-on to make tick cadence itself duration-independent.

Related but distinct from #3681 (mechanize-daemon-lifecycle): that item is about daemons running STALE code (detecting/hot-reloading when a daemon's own process predates a code change); this item is about ONE mechanical pass's per-tick control flow not being allowed to block on a slow child regardless of whether the code is fresh. Cross-reference both when preparing either.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
