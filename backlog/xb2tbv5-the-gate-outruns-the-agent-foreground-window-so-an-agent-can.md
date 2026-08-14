---
kind: story
size: 5
parent: "2753"
status: open
dateOpened: "2026-08-14"
tags: [conveyor, session-free, delivery, agent, gate, footgun]
scope:
  - we:skills-src/conveyor/delivery-agent-brief.md
  - we:package.json
  - we:vitest.config.ts
---

# The gate outruns the agent foreground window, so an agent cannot finish a delivery arc

**A delivery agent structurally cannot complete its own arc today, and the failure is silent.** Measured
across ten occurrences on 2026-08-14 (see the three shapes below — they are mutually exclusive outcomes and
sum to the total), every one recovered by hand.

## The mechanism

A full `npm run test:unit -- --shard=N/2` takes roughly **150–350 seconds** per shard on this repo. The
agent tool's foreground command window is **120 seconds**. So the gate run is auto-backgrounded, the agent
stops at end-of-turn waiting for a completion it will not be woken for, and its work sits **committed to
nothing** in its lane.

It does not present as an error. The lane looks idle, the PR never opens, and nothing anywhere reports a
failure — the same shape as the wedged-`claude` hang in [#3097]: not a red, just silence.

## Why the obvious fix does not work

Every brief in this session carried an explicit instruction — *"run `pr-land` in the FOREGROUND and WAIT
for it"* — and it made no difference, because **the agents did**. The harness backgrounded the call anyway.
Later briefs added *"poll its output file rather than stopping"*; one agent then looped — background, stop,
be told it stopped, wait again — three times in a row. Wording has not fixed it, across every phrasing
tried this session.

Observed shapes, all the same cause:
- gate run backgrounded → agent stops → work uncommitted (4 of the 5 builds this session);
- `pr-land` backgrounded → agent stops → branch pushed, **PR never opened** (2 occurrences);
- `pr-land` backgrounded → agent stops → PR opened, **never labelled**, so the drain never sees it (4).

## Why it matters beyond the annoyance

This is a **phase-B blocker** for [#3102]. "Queue and supervise engine failures" assumes the engine can
finish one unit of work unattended. Right now an agent-driven build reliably stops just short of landing,
and because it surfaces as silence rather than as a failure, supervision has nothing to act on. Every one
of the ten was found by a human checking, never by a signal.

## Approaches, and the fork is real

Not decided here — it needs a ruling, and the options differ in what they cost:

- **Make the gate fit the window.** A per-shard run under ~110s. `test-selection` machinery already exists;
  a scoped gate for an agent's own diff would fit, at the cost of a narrower guarantee than the full suite.
- **Give the agent a wait primitive that survives end-of-turn.** The most direct fix and the least in our
  control — it is a harness capability, not a repo one.
- **Take the gate out of the agent's arc.** The agent commits and pushes; CI is the gate and the drain
  already waits on it. Cheapest by far, and it changes what "the agent verified it" means — today the brief
  requires a local green before the PR opens.

The third is the one worth arguing about: CI already runs the same suite on every PR, so the local run may
be duplicating a check that a machine with no timeout already performs.

## Done when

- [ ] A delivery agent completes acquire → build → gate → commit → PR → label without a human finishing it,
      demonstrated on one real item end to end.
- [ ] When it cannot, it fails LOUDLY — the lane, the PR, or the runner reports it, rather than going quiet.
- [ ] The approach fork above is ruled and the reasoning recorded.

## Watch for

- **Do not fix this by weakening the gate silently.** If the agent's local run becomes narrower than the
  full suite, say so in the brief, so nobody reads "gate green" as more than it is.
- The 120s figure is the observed tool window, not a documented constant — confirm it before building
  against it.
