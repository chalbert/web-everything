---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#readout-placement-by-value-type"
tags: [decision, book-candidate, meter, gauge, apg, gap]
relatedReport: reports/2026-06-21-bounded-scalar-readout-meter.md
preparedDate: "2026-06-21"
---

# Meter / gauge — quantitative readout standard: placement

> **RATIFIED 2026-06-21.** Both rows ratified as recommended.
> - **Fork 1 → 1(a):** the bounded-scalar readout is its **own tiny `meter` intent (+ FUI block)**, adopting
>   `<meter>` / `role=meter` vocabulary verbatim (`value`/`min`/`max`/`low`/`high`/`optimum`/`valuetext`).
>   Gauge = a radial `presentation` value, not a separate intent. Branches (b) `status-indicator` dimension
>   and (c) extend `loader` rejected (mis-type a continuous scalar / task-over-time). Realizing build → #1468.
> - **Fork 2 → 2(a):** **file the scoped `progress` sibling placement decision now** → #1469 (default lean:
>   covered by `loader.progress` + `flow-progress`, ~60%).

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **meter** is a static quantitative readout within a known range (disk usage, score, capacity, password
strength) — `role=meter` / native `<meter>` — distinct from a *progress* indicator (task completion over
time) and from `status-indicator` (discrete state)
([prior-art survey](/research/bounded-scalar-readout-meter/)). WE has `status-indicator` and `loader` but
**no bounded-scalar-value readout**.

The axis the prep pins to the real tree: native `<meter>` is a sharp, authoritative contract — `value`,
`min`, `max`, `low`, `high`, `optimum` (deriving three semantic value-zones) — and ARIA defines `meter` and
`progressbar` as **two separate roles by design** ("The meter should not be used to indicate progress … use
the progressbar role instead"). `status-indicator`
([we:src/_data/intents/status-indicator.json](../src/_data/intents/status-indicator.json)) is a
**discrete-state enum** (`tone` / `shape` / `affordance`, "the canonical display of a domain entity's
lifecycle state") with no value/min/max anywhere; `loader`
([we:src/_data/intents/loader.json](../src/_data/intents/loader.json)) owns `progress: determinate |
indeterminate` as **a progress bar reflecting transfer over time**. Grep for meter/gauge/rating across
intents + blocks returns zero value/range hits — the bounded-scalar readout is genuinely unowned. Forcing a
continuous bounded scalar through `status-indicator` is the exact defect Chakra documents (a meter that
renders as `role="progressbar"`).

### Triage context

- **Kind**: Intent (+ FUI block) · **Native grounding**: `<meter>` / `role=meter` (`value`/`min`/`max`/`low`/`high`/`optimum`/`aria-valuetext`); vs `<progress>` / `role=progressbar`
- **Native-first**: ▽ low (adopt `<meter>` verbatim) · **Gap**: ◆ medium (no readout exists) · **Effort**: ▽ low (tiny intent) · **Surfaced by**: #1400 (ARIA-APG lens)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home of the readout** | its **own tiny `meter` intent (+ FUI block)** | a `status-indicator` dimension *(rejected — mis-types a continuous scalar)* · extend `loader` *(rejected — task-over-time)* | **~90%** — `<meter>` ≠ `<progress>` ≠ status enum |
| **2 · the `progress` sibling** | **file a scoped `progress` placement decision** alongside it | do nothing *(rejected — leaves the meter↔progress boundary unsettled)* | **~75%** — `progressbar` is a distinct ARIA role |

## Fork 1 — where does the bounded-scalar readout live?

*Fork-existence:* the excluded branch is **"a `status-indicator` dimension,"** and it is **broken** —
`status-indicator` is a discrete-state enum (`tone` badge), with no value/min/max and no low/high/optimum;
carrying a continuous bounded scalar there mis-types it (the documented Chakra defect: a measurement forced
through a progress/state role). Extending `loader` is excluded too — loader is task-over-time, and ARIA
itself separates `meter` from `progressbar`. A home that has to mis-type the value is the genuine either/or.

**Fork 1 (a) — its own tiny `meter` intent (+ FUI block) (recommended, ~90%).** Adopt `<meter>` /
`role=meter` vocabulary verbatim: `value`, `min`, `max`, `low`, `high`, `optimum`, plus `valuetext`.
Dimensions draft: `presentation` (bar | radial-gauge), `zones` (none | low-high-optimum), a label/valuetext
convention. Native-first; the contract is small and sharp.

**Fork 1 (b) — a new dimension of `status-indicator` (rejected).** Mis-types a continuous scalar — the
broken branch above.

**Fork 1 (c) — extend `loader` (rejected).** Loader is task-over-time (`progressbar`); ARIA separates the
roles.

*The residual (~10%):* the intent is small; if WE later wants a single "range readout" umbrella it could
absorb rating — but native keeps `<meter>` standalone, so standalone is the native-first call. Naming: avoid
"gauge" as the intent id (gauge is a presentation), and avoid collision with the slider/range *input* (meter
is read-only display).

## Fork 2 — is `progress` (task-over-time) a sibling to file now?

*Fork-existence:* the excluded branch is **"fold meter + progress into one readout standard,"** and it is
**broken** — ARIA defines `meter` and `progressbar` as distinct roles with incompatible semantics (progress
can be indeterminate and drops `aria-valuenow`; meter cannot and adds zones), so one combined standard would
host two contradictory contracts. The coherent options diverge on *whether* to file the sibling now.

**Fork 2 (a) — file a scoped `progress` sibling decision now (recommended, ~75%).** WE already *partly* owns
determinate task progress as `loader.progress`, so the sibling is narrow: does `<progress>` /
`role=progressbar` warrant a first-class home, or stay a `loader` dimension? Filing it alongside #1410
settles the meter↔progress boundary together. (Title/framing below.)

**Fork 2 (b) — fold meter + progress into one standard (rejected).** The broken branch above.

**Fork 2 (c) — do nothing on progress (rejected).** Leaves the boundary unsettled and risks a later
mis-typing.

*The residual (~25%):* progress may already be adequately covered by `loader.progress` + `flow-progress`, so
the sibling could resolve quickly to "covered, no new standard." It is still worth *filing* (the question is
genuinely open and distinct from meter) but is lower-stakes than meter itself.

**Sibling to file (at ratify time, not during prep):**
> **Progress indicator (task-over-time, `role=progressbar`): first-class intent, or covered by `loader`'s
> `progress` dimension? — placement.** WE has determinate/indeterminate task progress today only as a
> *dimension* of `loader` (and step-position in `flow-progress`). `<progress>` / `role=progressbar` is a
> distinct ARIA role from meter; decide whether a determinate progress readout *not* tied to a
> pending/blocking lifecycle warrants its own thin intent/block, or whether `loader.progress` is the
> canonical home. Default lean: covered by `loader` (~60%).

---

### Supported by default (not forks)

- **Gauge = radial presentation of the meter contract.** Same `value`/`min`/`max`/`low`/`high`/`optimum`;
  arc vs bar is rendering — expose as a `presentation` dimension value (`radial` / `gauge`), never a
  separate intent (MUI/Ant precedent; MUI's linear-gauge + segments issues confirm one model, many
  presentations).
- **Intent + FUI block coexist** at different layers — WE owns the `meter` intent (contract + native
  vocabulary + conformance), FUI owns the rendered block.
- **Rating / password-strength** are specialized meter presentations — consumers, not separate standards.

### Seams

- **vs `status-indicator`:** discrete enumerated lifecycle state ↔ continuous bounded number. Cut at "is the
  value an enum or a position in [min,max]?"
- **vs `loader`:** task-over-time completion (`role=progressbar`, may be indeterminate) ↔ a standing
  measurement (`role=meter`, always determinate, has zones).
- **vs a future `progress`:** the meter↔progress boundary is exactly the ARIA meter/progressbar split — keep
  them two intents citing each other's "use the other role when…" guidance.
- **vs slider/range input:** meter is read-only display; a range *input* is an editable form control.

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: author the `meter` intent JSON (`value`/`min`/`max`/`low`/`high`/`optimum`,
`presentation`, `zones`, `valuetext`) + the FUI block + a demo (disk usage / password strength / radial
gauge). If Fork 2 (a) ratifies: file the `progress` sibling decision. File via `/new-standard`. Not part of
this placement call.
