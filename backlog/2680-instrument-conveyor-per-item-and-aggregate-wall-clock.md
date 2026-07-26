---
bornAs: xfgacpz
kind: story
size: 3
parent: "2612"
status: open
relatedReport: reports/2026-07-26-conveyor-per-item-latency.md
scope: ["we:scripts/readiness/", "we:scripts/conveyor/"]
dateOpened: "2026-07-26"
tags: []
---

# Instrument conveyor per-item and aggregate wall-clock

Measure where conveyor wall-clock actually goes before spending latency levers on it. A pure
`we:scripts/readiness/conveyor-instrument.mjs` parses existing lane-board + `gh` PR timestamps into a per-item
**and** aggregate breakdown — authoring time, first-CI duration, poll-gap, **land-serialization wait**, and
lane-pool saturation — so we know which term binds (per-item latency vs the single serial daemon land-rate vs
agent authoring vs pool width). This is the prerequisite the design jury demanded: the parent goal is delivery
**throughput** (#2606), and cutting per-item CI latency that already runs in parallel across lanes may not move
throughput at all if land-serialization or authoring is the real constraint.

## Why (jury root-cause finding)

The v2 latency design record (`we:reports/2026-07-26-conveyor-per-item-latency.md`) counts only PR *transport*
(hop + CI + poll). A high-care design jury flagged that it omits **agent authoring time** (likely the dominant
term) and never establishes that per-item latency — rather than the serial sole-writer daemon land-rate or the
fixed lane-pool width — is the binding constraint on #2606 throughput. Levers A and C stand on their own (they
remove transport and shorten the serial land path); B / E / D must be **re-justified against what this instrument
measures**.

## What to build

- A pure core (no fs/git/clock — timestamps injected) that, given a set of item/PR/lane records, returns the
  per-phase durations + the aggregate breakdown; unit-tested with plain objects.
- An IO shell that gathers the records from the lane board (`plateau:src/backlog-view/lane-board-data.ts` reads
  the same verbs) and `gh` PR timestamps — **no parallel state store** (the standard-verbs-only rule, #2612).
- A `--json` view the conveyor skill and the future console can both read (one implementation, two shells).

## Definition of done

- The report distinguishes **latency-bound**, **land-serialization-bound**, **authoring-bound**, and
  **pool-saturation-bound** regimes from real data, so the B/E/D go/no-go is measured, not asserted.
- Also emits the **false-green signal** Lever D (#2681) needs: how often a scope-shrunk CI would have passed
  while the full suite failed (measurable once D pilots).
