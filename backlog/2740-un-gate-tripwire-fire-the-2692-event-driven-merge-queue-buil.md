---
bornAs: x955xwn
kind: story
size: 3
parent: "2612"
blockedBy: ["2680", "2704"]
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
writer, sustained over the measured window** (not a one-off spike), it **surfaces-and-routes** #2692's build
slice (#2683): it flips/surfaces the build as ready-to-build **and routes it through #2704's criticality
decision-routing**, which may require operator confirm for a safety-critical merge-queue build. It does **NOT**
silently auto-execute the build. Until it fires, the deferral is legitimate; when it fires, the un-gate becomes
**visible and correctly-routed on measured evidence** — not a judgment call someone has to remember to make, and
not an unattended autonomous build either.

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

## Un-gate action (surface-and-route — NOT silent-fire)

When the condition trips the action is **surface-and-route**, ruled by #2692's operator refinement (2026-07-27) —
it explicitly does **not** silently execute an unattended merge-queue build:

1. **Surface.** Flip / surface #2683's `buildQueued` (the deferred merge-queue build) so the build becomes
   visible as ready-to-build, with #2692's already-ruled defaults attached: **Fork 1 default (c)** speculative
   merge-commit preserving the signed SHA, and **Fork 2 default (b)** per-step CAS/idempotent guards, plus the
   batching rider (co-ships with require-up-to-date when the gate opens). No re-litigation of *those* calls — the
   hard forks are ruled in #2692.
2. **Route by criticality (#2704).** Hand the surfaced build to #2704's decision-routing
   (`we:scripts/lib/decision-routing.mjs`) so it goes through the right process for its stakes — a merge-queue
   build touches the sole-writer land tail, so it is **safety-critical** and routing **may require operator
   confirm** before the build starts. The tripwire never executes the build itself; it makes the un-gate visible
   and routes the go-decision — a human still owns the go on this high-stakes build.

## What to build

- A pure predicate `saturationTripped(instrumentReport, { minK, windowTicks|windowMinutes })` over the #2680
  report shape — no fs/clock, unit-tested with plain objects (mirrors the #2680 pure-core / IO-shell split).
- A thin shell that reads the live instrument's `--json`, evaluates the predicate over the sustained window, and
  on a trip **surfaces** #2683 (flip `buildQueued` via the normal backlog verbs — no parallel state store, per
  #2612) **and routes** it through #2704's decision-routing rather than launching the build. Surface-and-route,
  never auto-execute.
- A one-line status the conveyor tick and the future console can both read.

## Definition of done

- With #2680 data showing sustained k>1-behind-writer, the monitor deterministically **surfaces #2683 and routes
  it through #2704** (which may require operator confirm for the safety-critical build); with shallow or transient
  depth it stays quiet. The #2692 deferral now has teeth: it un-defers itself **into visibility and routing** on
  measured saturation — never into a silent autonomous build, and never into indefinite procrastination.

## Lineage

Surfaces-and-routes decision #2692's deferred build (`we:backlog/2692-*`, resolved 2026-07-27, codified
[we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only));
reads #2680 (resolved, `we:scripts/readiness/conveyor-instrument.mjs`); the build it surfaces is slice #2683;
it routes that build through #2704's criticality decision-routing (`we:scripts/lib/decision-routing.mjs`, resolved).
Epic #2612 / program #2606. Both #2680 and #2704 are resolved, so this is ready to build now that the #2692 call is
ratified.
