---
bornAs: xb2tbv5
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

## Fresh evidence, 2026-08-14 (later the same day) — independent reviewers hit this too

The original ten occurrences were all delivery agents (build + `pr-land`). Tonight the same mechanism hit
**independent review processes** — headless `claude -p` reviewers spawned to gate PRs, not just the agents
building them. This widens the blast radius: the stall is not specific to a delivery arc's own shape, it is
generic to any agent-driven process whose gate step exceeds the ~120s foreground window.

- **#1255's review** stalled mid-gate; finished by hand (same recovery pattern as a stalled build — verify
  the substantive work on disk, run the remaining gate personally, record the verdict).
- **#1258, #1259, #1260, #1261's reviews** all appeared stalled at once (no output beyond the harmless
  "workspace has not been trusted" startup message), attributed at the time to a spike in concurrent lane
  load. Four fresh retries were launched. On checking each original before trusting the retries:
  **#1259 and #1260 had actually completed on their own** (`review:accepted`, with real mutation-verification
  evidence in the verdict) — just very slowly under heavy concurrent system load, not stalled at all. Their
  retries were redundant and had to be killed to avoid wasted work and a possible conflicting verdict.
  **#1258 and #1261 were genuinely stalled** and needed the same manual-finish recovery as every prior
  occurrence.

**New finding worth naming on its own:** the *"Ignoring N permissions.allow entries ... this workspace has
not been trusted"* message that every fresh lane prints on a headless `claude -p` launch is a **red herring**
for diagnosing this stall — `claude --help` confirms the trust dialog is skipped entirely in non-interactive
(`-p`) mode, so that message never blocks anything. It was being read as a symptom of "stuck," which is what
produced the two redundant retries above. The real diagnostic is silence in the output file past the point
where a gate run should have printed a result, correlated with the shard timing in `## The mechanism` above
— not the startup banner.

This does not change the fork in `## Approaches` — it is the same root cause, now confirmed to hit a second
class of agent-driven process. It does add a fourth observed shape to `## The mechanism`'s list: **review
gate run backgrounded → reviewer stops → verdict never recorded**, sometimes recoverable by just waiting
longer (as #1259/#1260 showed) rather than assuming stalled and relaunching — a live process and a genuinely
stalled one are not distinguishable from output alone under heavy load, which is itself worth weighing in
whichever `## Approaches` fork gets ruled.
