---
bornAs: x955xwn
kind: story
size: 3
parent: "2612"
blockedBy: ["2680"]
status: open
dateOpened: "2026-07-27"
tags: [conveyor, delivery, drain, tripwire, undefer]
---

# Un-gate tripwire: fire the #2692 event-driven merge-queue build when Lever-0 shows sustained landing-queue saturation

A small monitor that turns decision **#2692**'s deferral from an open-ended "maybe later" into a tracked,
self-firing plan. #2692 defers the full event-driven merge-queue build (Fork 1 (c) speculative merge-commit +
Fork 2 (b) per-step CAS/idempotent guards, + the batching rider) behind a **saturation** trigger. This item is
the thing that WATCHES the trigger. It reads the Lever-0 saturation metric already produced by
`we:scripts/readiness/conveyor-instrument.mjs` (#2680, resolved) — specifically `land-serialization` wait and
`landing-queue depth behind the sole writer` — and, when **k>1 ready PRs sit queued behind the single serial
writer, sustained over the measured window** (not a one-off spike), it surfaces/queues #2692's build slice
(#2683) to the conveyor as ready-to-build. Until it fires, the deferral is legitimate; when it fires, the
un-gate is automatic, not a judgment call someone has to remember to make.

## Why (closes the deferral gap)

A validation-gate deferral (#2692 is a data-gated go/no-go, not a merit fork) is only legitimate with a
**concrete, tracked plan to undefer**. #2680 instrumented the trigger signal but nothing consumes it to fire the
build. This item is that consumer — the "plan to undefer" made real, so the deferral cannot silently become
permanent procrastination.

## Un-gate condition (measurable)

- Source: `we:scripts/readiness/conveyor-instrument.mjs` (#2680) aggregate breakdown — `land-serialization`
  phase + ready-PRs-behind-writer depth.
- Trip: **k > 1 ready PRs queued behind the sole writer, sustained across the measured window** (a configured
  minimum span / minimum number of ticks, so a transient burst does not fire it).
- No-trip: shallow depth (k ≤ 1) or a single-tick spike — the current polling drain is fine there.

## Un-gate action (what fires)

When the condition trips, surface/queue **#2683** (the deferred merge-queue build) to the conveyor with #2692's
already-ruled defaults attached: **Fork 1 default (c)** speculative merge-commit preserving the signed SHA, and
**Fork 2 default (b)** per-step CAS/idempotent guards, plus the batching rider (co-ships with require-up-to-date
when the gate opens). No re-litigation — the hard calls are ruled in #2692.

## What to build

- A pure predicate `saturationTripped(instrumentReport, { minK, windowTicks|windowMinutes })` over the #2680
  report shape — no fs/clock, unit-tested with plain objects (mirrors the #2680 pure-core / IO-shell split).
- A thin shell that reads the live instrument's `--json`, evaluates the predicate over the sustained window, and
  on a trip surfaces #2683 to the conveyor (queue/priority nudge through the normal backlog verbs — no parallel
  state store, per #2612).
- A one-line status the conveyor tick and the future console can both read.

## Definition of done

- With #2680 data showing sustained k>1-behind-writer, the monitor deterministically surfaces #2683; with
  shallow or transient depth it stays quiet. The #2692 deferral now has teeth: it un-defers itself on measured
  saturation instead of waiting on someone to notice.

## Lineage

Fires decision #2692 (`we:backlog/2692-*`); reads #2680 (resolved, `we:scripts/readiness/conveyor-instrument.mjs`);
build it fires is slice #2683. Epic #2612 / program #2606. #2680 is resolved, so this is ready to build once the
#2692 call is ratified.
