---
kind: story
size: 3
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/delivery-agent-brief-v2.md"]
dateOpened: "2026-09-28"
tags: []
---

# Delivery agents wait for the verify result instead of polling it every few seconds

Today's we:skills-src/conveyor/delivery-agent-brief.md has agents loop node we:scripts/verify-lane.mjs check --json every few seconds across turns for 10-45 minutes waiting on a request-then-poll gate (#2833/#3105), burning tokens and process churn on a result that only changes once. Give we:scripts/verify-lane.mjs a blocking wait mode (poll internally, return only on a settled green/red), or have the brief itself sleep on the .lane-verify marker file with a bounded wait, and update we:skills-src/conveyor/delivery-agent-brief.md's request-then-poll steps to use it instead of the per-turn poll loop.

## Scope

- **we:scripts/verify-lane.mjs** — add the new wait/coarser-poll mode; reuse the existing `check`/`request`
  machinery rather than a parallel marker vocabulary.
- **we:scripts/lib/lane-verify.mjs** — the shared marker reader + `verifyGateDecision` core both `verify-lane`
  and `pr-land` already call; the new mode is built on this, not a re-derivation of marker-reading logic.
- **we:skills-src/conveyor/delivery-agent-brief.md** — the request-then-poll steps at the mid-work gate AND the
  final-HEAD verify step (currently: "poll again next turn" with no stated interval, `check --json` on a loop).
- **we:skills-src/conveyor/delivery-agent-brief-v2.md** — its own copy of the same request-then-poll shape.

## Risks

- **A literal in-process blocking wait hits the exact ceiling #2833/#3105 exists to avoid.** That prior work's
  whole point was "the agent cannot run the gate itself" because a single foreground tool call cannot block for
  the gate's full 150–350s (let alone the 10–45 minutes this card's evidence shows), so a naive `--wait` that
  sleeps inside ONE Bash call past the tool's own safe window just reintroduces the same failure differently.
  This card's fix must be one of: (a) a wait call that blocks up to a bounded, tool-safe ceiling and returns a
  "still pending" status if the gate hasn't settled by then (so the agent's own turn loop — not a single Bash
  call — does the multi-minute waiting, at a much coarser interval than every few seconds), or (b) some other
  mechanism that measurably cuts the number of separate tool invocations without ever blocking one call past a
  safe ceiling. **This is a real design call the implementing session must settle and record in this item**
  before writing code — Tasks item 1, below — not something to assume away.
- **CLAUDE.md's own pinned rule governs this exact shape**: never end a turn assuming a backgrounded call will
  wake the agent up; a fix here must keep the agent actively polling to completion in the foreground, just far
  less often — the fix is the INTERVAL, not the existence of the loop.
- **`we:scripts/verify-lane.mjs check` has other callers** expecting today's fast, non-blocking marker read
  (humans, other scripts); the new mode should be a distinct flag/mode, not a change to `check`'s default
  return behavior, so those callers are unaffected.

## Test plan (each fails before the fix)

1. `we:scripts/verify-lane.mjs` unit test: given a marker that settles to green after N simulated poll
   intervals (fake clock, fake marker reads), the new mode returns as soon as it settles rather than waiting a
   fixed sleep, and returns a bounded "still pending" result if the marker has not settled by the mode's own
   ceiling.
2. `grep -n` over `we:skills-src/conveyor/delivery-agent-brief.md` and `we:skills-src/conveyor/delivery-agent-brief-v2.md`:
   the request-then-poll sections reference the new coarser-interval wait shape (a named interval/ceiling), not
   the old bare "poll again next turn" loop with no stated cadence.
3. **Live proof** — count the real `we:scripts/verify-lane.mjs check --json` invocations a delivery session
   makes across one full gate wait, before vs after this change, on a comparable gate duration.

## Tasks

1. Settle the exact mechanism (see Risks: bounded-wait-with-pending-status vs. a coarser fixed poll interval)
   and record the decision in this item before implementing.
2. Add the settled mode to `we:scripts/verify-lane.mjs`, built on `we:scripts/lib/lane-verify.mjs`'s existing
   marker read + `verifyGateDecision` — no new marker vocabulary.
3. Update both `we:skills-src/conveyor/delivery-agent-brief.md` and `we:skills-src/conveyor/delivery-agent-brief-v2.md`'s
   request-then-poll sections (mid-work gate and final-HEAD verify) to the new shape.
4. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** a real delivery session's transcript shows N separate `we:scripts/verify-lane.mjs check --json`
  calls across turns for one gate wait — record the real count and the real elapsed time.
- **After:** the same real wait, on a gate of comparable duration, shows materially fewer invocations (or one
  bounded wait call plus a small number of coarse re-polls) — record the real count for comparison.
