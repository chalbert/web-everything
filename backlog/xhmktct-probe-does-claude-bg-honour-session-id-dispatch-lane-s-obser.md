---
kind: story
size: 3
parent: "3029"
status: open
scaffoldedBy: "rule3118"
dateScaffolded: "2026-08-26"
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-08-26"
relatedTo: ["3118", "3096", "3037"]
tags: [plateau-loop, delivery, operations, conveyor, dispatch, probe]
---

# PROBE: does `claude --bg` honour `--session-id`? dispatch-lane's observer may never match a live session

`we:scripts/operations/dispatch-lane-io.mjs` **mints** the session id it dispatches with, then later looks
for that same id in `claude agents --json` to decide whether the agent is still running. One manual
observation on 2026-08-25 suggested `claude --bg` **ignores** `--session-id`. If that holds, the comparison
can never match, and the conveyor cannot see its own agents.

**One manual run is not evidence.** This card's first job is a probe that settles it. Nothing here should be
fixed before the probe answers, and the probe's answer is the deliverable even if it says the assumption is
fine.

## The mechanism, line by line

All line numbers are against `main` at `3b2aeded`. Every line below was read, not recalled.

1. **The sink mints the handle.** `createDispatchSinks` does
   `const sessionId = String(mintSessionId());` — `we:scripts/operations/dispatch-lane-io.mjs:558` — and hands
   it to `buildAgentArgv` at `:559`.
2. **The argv pins it.** `buildAgentArgv` emits `'--session-id', String(sessionId)` —
   `we:scripts/operations/dispatch-lane-io.mjs:621` — immediately after `'--bg'` at `:620`.
3. **The observer matches on that minted value.** `createDispatchObservers` reads the handle back off the run
   entry — `const handle = String(ctx?.handle ?? entry?.handle ?? '');`,
   `we:scripts/operations/dispatch-lane-io.mjs:693` — and then does
   `const live = sessions.find((s) => s && String(s.sessionId) === handle);` at `:738`.
4. **The sink says the mint is load-bearing, in as many words.**
   `we:scripts/operations/dispatch-lane-io.mjs:509-514`: *"THE HANDLE IS MINTED, NOT DISCOVERED, and that is
   the load-bearing detail… `claude --session-id <uuid>` removes the race outright: the dispatcher CHOOSES
   the id, so the handle is known before the agent exists and cannot be attributed to the wrong session."*

## What breaks if the observation holds

If the real CLI discards `--session-id` on a `--bg` spawn, the session the sink started is listed under a
**different** id, so `:738` never matches. The observer then falls through:

- Not-yet-listed grace — `we:scripts/operations/dispatch-lane-io.mjs:744` — holds it as `running` for
  `LISTING_GRACE_MS` (`:67`), which derives from `DISPATCH_LISTING_GRACE_MINUTES = 2`
  (`we:scripts/operations/dispatch-lane.mjs:111`).
- After those two minutes it returns `status: 'unresolved'` with *"session … is no longer listed by
  `claude agents`"* — `we:scripts/operations/dispatch-lane-io.mjs:747-752`.

**Scope the damage honestly — the liveness axis is not the only axis.** The observer tries the **PR axis
first** (`we:scripts/operations/dispatch-lane-io.mjs:695-729`); a merged PR still returns `succeeded` at
`:716-724` regardless of the session id. So the failure is not "nothing ever resolves". It is narrower and
still serious: the liveness axis is, by its own comment at `:731-732`, *"what answers while no PR exists
yet, which is every dispatch for most of its life"*. A dispatch would read `unresolved` for its entire
pre-PR life, two minutes after it starts.

## Why one manual run does not settle it, and no existing test does either

- **No test in this repo starts a real `claude`.** The nearest,
  `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`, spawns a **fake** `claude` placed first on
  `PATH` (`withFakeClaude`, its `:31`) and asserts the argv is accepted and that the id pinned here is the id
  the fake reports back (`:68`). That proves the argv shape and the round-trip through a stand-in, not the
  real CLI's behaviour.
- **`we:scripts/operations/__tests__/dispatch-lane.test.mjs:645`** — *"pins the handle with `--session-id`
  instead of racing to discover it"* — asserts the argv and nothing about the CLI's response to it.
- **The sink already concedes this.** `we:scripts/operations/dispatch-lane-io.mjs:528-534`: *"PROVEN AGAINST
  A PROCESS, NOT AGAINST THE REAL CLI… What is still NOT proven: no dispatch has been fired end to end, and
  the REAL CLI's response to this argv remains unasserted."* It names `#xaibmeu` — which is `#3096` — as
  where a first live run happens.

## Done when

1. **The probe has run and its result is written into this card**, with the exact command, the CLI version,
   the id passed, and the id `claude agents --json` reported back. Repeated at least three times, since a
   single run is what got us here. Either answer closes the probe.
2. **If `--session-id` is honoured**: a test defends it so this cannot silently regress, and the sink's
   `:528-534` "NOT PROVEN" comment is updated to say what is now proven.
3. **If it is ignored**: the observer stops matching on a minted id — it reads the real id back from the
   listing and stores it on the run entry — and a test covers the case where the listed id differs from the
   dispatched one. The sink's `:509-514` header is corrected in the same change, because it currently states
   the discarded assumption as the design's load-bearing detail.

## Lineage

Filed 2026-08-26 as a named, non-waived cost of the `#3118` ruling
([#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)),
which routes the conveyor's dispatch through this operation and therefore inherits this assumption.
**Overlaps `#3096` deliberately, and does not duplicate it:** `#3096` owns the first end-to-end live dispatch
and what a background session's permission mode and isolation default must be. This card owns one narrower
question — whether the handle the observer compares against is the handle the CLI actually uses — which can
be answered by a bare `claude --bg` spawn with no conveyor, no lane and no brief. Run it first; it may change
what `#3096` has to build.
