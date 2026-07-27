---
bornAs: xfgacpz
kind: story
size: 3
parent: "2612"
status: open
relatedReport: reports/2026-07-26-conveyor-per-item-latency.md
scope: ["we:scripts/readiness/conveyor-instrument.mjs", "we:scripts/readiness/__tests__/conveyor-instrument.test.mjs"]
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

## Round-2 review — acceptance criteria

Two corrections from the second design-jury round:

- **This instrument does NOT produce Lever D's false-green signal.** A false-green is a test-*outcome* fact
  (selected-suite green while the full suite would be red), recoverable only by a **shadow full-suite compare** —
  never from timing data. That signal is owned by #2681 (Lever D), not this timing instrument. (Earlier drafts
  wrongly sourced it here.)
- **Authoring time is not cleanly derivable from `gh` PR timestamps** — a PR is created *after* authoring, so the
  dispatch→first-CI gap also contains queueing/push/runner-startup. Isolating authoring needs a real
  **dispatch → first-commit span**; if the lane board doesn't already record that boundary, capturing it is in
  scope (a small signal, not a durable store). Without it the instrument returns the very ambiguity it exists to
  remove, so this is load-bearing, not optional.
