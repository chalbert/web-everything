---
kind: epic
ongoing: true
parent: "2527"
status: open
dateOpened: "2026-07-22"
tags: [plateau-loop, program, delivery, drain, lane]
---

# Delivery throughput & latency program

A standing program whose north star is to **minimize queue→merged latency and maximize safe parallelism of the delivery loop, at unchanged safety**. The loop in scope: build-queue pickup → scope-disjoint dispatch into lanes → build → gate → ready-to-merge label → drain-daemon pass → merge → resolve. Every wait between those stages is this program's territory; safety invariants (the gate, review parks, the single serial writer to `main`) are the fixed constraint, never the tuning knob. Born from the 2026-07-22 conveyor-skill design session (main-session dispatcher + background delivery agents + drain-daemon landing).

## The two fronts

- **Front A — conformance (internal):** is the loop currently as fast and as parallel as its known-good targets? Metric: end-to-end cycle time (queue pickup → merged) and its per-stage breakdown, measured from the evidence base below. Green = no stage's wait has regressed past its accepted floor (e.g. the drain interval, the gate's runtime).
- **Front B — currency (external):** the delivery machinery itself keeps moving — new seams (a new dispatcher, a new daemon, a new review stage) add new latency sources, and infrastructure changes (push seams, faster gates) make old floors obsolete. Discovery method: the `/review-program` watch periodically **re-surveys EVERY latency source** — dispatch tick interval, label-pickup delay, drain pass cadence, review parks, lane idle time between merge and next dispatch, serial human waits — and files improvement items for each wait that can shrink or parallelize without touching safety.

## Evidence base — measured, not felt

Cycle times are measurable today, no new instrumentation needed to start:

- the drain daemon's history log (plateau:tools/drain-daemon/ `history.jsonl`) records every pass and landing;
- backlog `dateStarted` / `dateResolved` stamps bound each item's in-flight window.

Together they give queue→merged latency per item and per stage. Sharpening the instrumentation is itself in-scope work for the program.

## Graduation path — the program collects, the constitution receives

Ratified invariants that fall out of this program (a latency floor worth keeping, a parallelism rule, a "push is an accelerator, the interval floor stays" class of ruling) graduate to the statute layer via the normal decision→`codifiedIn` path into [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md). The program files and collects the improvement items; it never becomes the home of the rules it produces.
