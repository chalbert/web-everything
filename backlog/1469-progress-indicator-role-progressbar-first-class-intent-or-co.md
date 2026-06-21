---
kind: decision
size: 2
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
preparedDate: "2026-06-21"
codifiedIn: "docs/agent/platform-decisions.md#readout-placement-by-value-type"
relatedReport: reports/2026-06-21-bounded-scalar-readout-meter.md
tags: [decision, progress, apg, gap]
---

# progress indicator (role=progressbar) — first-class intent or covered by loader?

> **RATIFIED 2026-06-21 → (b).** A determinate progress readout decoupled from a pending/blocking
> lifecycle gets its **own thin `progress` intent (+ FUI block)**, adopting `<progress>` / `role=progressbar`
> vocabulary verbatim (`value`, `max`; omit `value` → indeterminate; no `min`/zones — that's `meter`).
> `loader.progress` and `flow-progress` are **consumers** of it, not its canonical home: the determinate bar
> shown *during* a pending op is a `progress` readout under a loader strategy; `flow-progress` keeps discrete
> step-position. Completes the ARIA trio (`meter` #1468 / `progressbar` / `status-indicator`) per the
> placement rule's three-value-types logic. Branch (a) covered-by-loader rejected (mis-types a non-pending
> completion readout through ~8 irrelevant loader dimensions — the failed composability probe); branch (c)
> dissolve-into-meter rejected (APG "the meter should not be used to indicate progress" keeps the completion
> cases on `role=progressbar`). Confidence ~70%; the residual rides on **build priority**, not the home — the
> realizing build (#1488) is filed low-priority, not rushed. Codified in
> [readout-placement-by-value-type](../docs/agent/platform-decisions.md#readout-placement-by-value-type).

Sibling placement decision filed by [#1410](/backlog/1410-meter-gauge-quantitative-readout-standard-placement/) (Fork 2a), settling the meter↔progress boundary alongside it. WE owns determinate/indeterminate task progress today only as a *dimension* of `loader` ([we:src/_data/intents/loader.json](../src/_data/intents/loader.json) — `progress: determinate | indeterminate`) plus step-position in `flow-progress` ([we:src/_data/intents/flow-progress.json](../src/_data/intents/flow-progress.json) — discrete `wizard`/`board` steps). `<progress>` / `role=progressbar` is a distinct ARIA role from `meter` (may be indeterminate, drops `aria-valuenow`; no zones). The boundary rule is codified by [readout-placement-by-value-type](../docs/agent/platform-decisions.md#readout-placement-by-value-type), which already names three value-types → three homes and lists `role=progressbar` as "owned today by `loader.progress`".

## The fork — home of a determinate progress readout decoupled from a pending/blocking lifecycle

The contested case is a **standalone completion readout** — "profile 70% complete", "course 7 of 12 lessons", "goal $700 of $1,000" — a `role=progressbar` value (progress toward completion, may be indeterminate) that is **not** a pending/blocking async operation and **not** a discrete multi-step workflow. The question: does that residual get its own thin home, or is `loader.progress` canonical?

- **(a) Covered by `loader.progress`** *(filed default, ~60%)* — no new intent; `loader.progress: determinate` already models a determinate bar and the codified rule blesses it as the progressbar home. Cost: `loader` is "the protocol defining how a **pending state** affects the UI" (strategy / scope / timing / anti-flicker / escalation / stale-resolve / version-token). A standalone completion bar has **none** of that — realizing it through `loader` means instantiating ~8 irrelevant dimensions, which is the mis-framing the placement rule warns against.
- **(b) Its own thin `progress` intent (+ FUI block)** *(recommended, ~70%)* — adopts `<progress>` vocabulary verbatim (`value`, `max`; omit `value` → indeterminate; no `min`/zones, that's `meter`). `loader.progress` **composes** it (the determinate bar shown *during* a pending op is a `progress` readout under a loader strategy) and `flow-progress` is unaffected (discrete steps). Completes the ARIA trio — `meter` (#1468, just ratified) / `progressbar` / `status-indicator` — that the placement rule's own "three value-types → three homes" logic already grants progress its own slot. The composability probe **fails** to build the standalone case cleanly over `loader` (above) → the fork is real, not a support-all.
- **(c) Dissolve — it's a `meter`, or out of scope** *(the live red-team, the residual ~30%)* — if every genuine standalone case is actually a static bounded scalar (→ `meter` #1468) and every true task-over-time bar is pending (→ `loader`), there is no unowned residual and (a) holds with the surface kept minimal. Turns on whether "course 58% complete" is a *measurement* (meter) or *progress toward completion* (progressbar) — the APG line "the meter should not be used to indicate progress" pushes the completion cases to progressbar, leaving the residual real.

**Recommended:** (b), confidence ~70%. The residual is genuine and `loader` mis-frames it; the placement rule + `meter` symmetry point to a thin third home that `loader` and `flow-progress` consume. The residual uncertainty is (c): the standalone case may be rare enough, and the `<progress>` rendering shareable enough, that promoting it to a first-class *intent* is over-engineering rather than parallel-to-meter.

---

*Context.* Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)); prior-art survey at [we:reports/2026-06-21-bounded-scalar-readout-meter.md](../reports/2026-06-21-bounded-scalar-readout-meter.md) (§"Concrete recommendation on the progress sibling"). Parent epic #099. Realizing build (b): #1488 (`progress` intent + FUI block).
