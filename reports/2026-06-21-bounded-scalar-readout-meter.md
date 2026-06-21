# Meter / gauge — bounded scalar readout placement survey

Prior-art survey grounding decision [#1410](/backlog/1410-meter-gauge-quantitative-readout-standard-placement/)
(surfaced by the ARIA-APG lens [#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

A **meter** is a static quantitative readout within a *known range* (disk usage, score, capacity, password
strength) — `role=meter` / native `<meter>` — distinct from a *progress* indicator (task completion over
time, `<progress>`) and from `status-indicator` (discrete state). WE has `status-indicator` and `loader`
but **no bounded-scalar-value readout**.

## Native grounding — `<meter>` vs `<progress>`, role=meter vs role=progressbar

[MDN `<meter>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter): "a scalar
measurement within a known range, or a fractional value." Attributes (the vocabulary to adopt verbatim):
`value`, `min` (default 0), `max` (default 1.0), `low` / `high` (sub-range bounds), `optimum` (where in the
range is preferable) — `low`/`high`/`optimum` derive **three semantic value-zones** (optimum / suboptimal /
"even less good"), exposed in CSS as `::-webkit-meter-optimum-value` etc.

[MDN `<progress>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress): `value`
+ `max` only; omitting `value` makes it **indeterminate**. No zones, no min, no optimum — "how done is this
task" has no good/bad region.

[ARIA `meter` role](https://www.w3.org/WAI/ARIA/apg/patterns/meter/): required `aria-valuenow` /
`aria-valuemin` / `aria-valuemax`; optional `aria-valuetext` (a human string — "50% (6 hours) remaining" or
non-numeric "small/medium/large"); requires a meaningful `max`. ARIA `progressbar` role: `aria-valuenow`
**omitted entirely** when indeterminate; no low/high/optimum. The load-bearing line, quoted from the APG
meter pattern: **"The meter should not be used to indicate progress … To communicate progress, use the
progressbar role instead."** ARIA defines these as two separate roles by design.

## Finding 1 (load-bearing) — meter is a bounded measurement, progress is task-over-time; both ARIA and Carbon keep them distinct

ARIA ships `meter` and `progressbar` as distinct roles with different required props (progressbar drops
`aria-valuenow` when indeterminate; meter never can be indeterminate and adds low/high/optimum). Carbon
mirrors this at the component level: [ProgressBar](https://v10.carbondesignsystem.com/components/progress-bar/usage/)
is "percent-complete status of a long-running process," while
[Meter / Gauge](https://carbondesignsystem.com/data-visualization/simple-charts/) live in Carbon's
data-visualization family — two homes, deliberately.

## Finding 2 — gauge = radial presentation of the same value/min/max contract, not a different contract

[MUI X Gauge](https://mui.com/x/react-charts/gauge/): "show a numeric value within a defined range as an arc
or meter … battery, storage, completion." It takes `value`, `valueMin`, `valueMax` — the *same*
scalar-in-a-range contract as `<meter>`, rendered as an arc. Open MUI issues for **gauge segments** (the
radial analogue of low/high zones) and a **linear gauge** confirm linear and radial are presentations of one
model. [Ant Design](https://ant.design/components/progress/) `<Progress type="dashboard">` / `type="circle"`
render gauges as a *presentation knob* (though Ant over-folds by routing measurement through "Progress").

## Finding 3 — folding meter into a progress/state component is a known defect

[Chakra](https://chakra-ui.com/docs/components/progress) has Progress but **no Meter**; its Progress applies
`role="progressbar"`. There is a standing issue ("Allow using Progress as a meter") precisely because users
want a meter but get a progressbar — the wrong ARIA role for a measurement. Concrete evidence that folding
meter into a progress/state component produces a semantic defect. Rating
([Shoelace `sl-rating`](https://shoelace.style/components/rating), "0–5 by default, change with `max`") and
password-strength meters are bounded-scalar readouts in disguise — one model, many presentations.
Material/Spectrum/Fluent ship only progress indicators and have **no meter** at all — a market gap.

## WE-tree decomposition — `status-indicator` does NOT cover a bounded scalar

- **[we:src/_data/intents/status-indicator.json](../src/_data/intents/status-indicator.json)**: dimensions
  `tone` (neutral | info | progress | positive | caution | critical), `shape` (badge | pill | dot | text),
  `affordance` (display-only | actionable). It is "the canonical display of a domain entity's *lifecycle
  state* … the visual member of the Web Lifecycle protocol." It models **discrete enumerated states**, not a
  continuous number — **no value/min/max/low/high/optimum anywhere**.
- **[we:src/_data/blocks/status-indicator.json](../src/_data/blocks/status-indicator.json)**:
  `renderStatusIndicator` projects "an entity's current lifecycle state onto a semantic status token";
  `role="status"` live region. Discrete state, no scalar.
- **[we:src/_data/intents/loader.json](../src/_data/intents/loader.json)**: owns pending-state UX; its
  `progress: determinate | indeterminate` dimension is explicitly **a progress bar reflecting transfer over
  time** ("a true progress bar reflecting transfer only … don't leave the bar stuck at 100%") — `<progress>`
  / `role=progressbar` territory, task completion not a standing measurement.
- Grep for meter/gauge/rating across intents+blocks: **zero hits** in any value/range sense.

**Explicit verification of the residual:** `status-indicator` does **not** cover a bounded scalar — it is a
discrete-state enum (badge of `tone`), with no value/min/max and no zones. A meter ("3.2 GB of 10 GB",
password strength 0–4, score 740/850) is a number positioned within a known range, with optional good/bad
zones and an `aria-valuetext`. **The unowned residual = `role=meter` / `<meter>`: a static quantitative
readout within a known range, with semantic value-zones.** Neither `loader` (task-over-time progress) nor
`status-indicator` (discrete state) types it.

## Recommended placement

- **Fork 1 — home of the bounded-scalar readout:** its **own tiny `meter` intent (+ FUI block)** (~90%),
  adopting `<meter>` / `role=meter` vocabulary verbatim (`value`, `min`, `max`, `low`, `high`, `optimum`,
  `valuetext`). Folding into `status-indicator` is the **broken** branch — that intent is a discrete-state
  enum, so carrying a continuous bounded scalar mis-types it (the exact Chakra defect). Extending `loader`
  is also excluded (loader is task-over-time; ARIA separates the roles).
- **Fork 2 — is `progress` a sibling to file now?** **File a scoped `progress` sibling decision** (~75%):
  WE already *partly* owns determinate task progress as `loader`'s `progress` dimension, so the sibling asks
  "does `<progress>` / `role=progressbar` need a first-class home or stay a `loader` dimension?" Folding
  meter + progress into one "readout" standard is the **broken** branch — ARIA defines `meter` and
  `progressbar` as distinct, incompatible roles; one combined standard would host two contradictory
  contracts.

Supported by default (not forks): **gauge = a radial *presentation* of the meter contract** (a
`presentation` dimension value, never a separate intent); intent + FUI block coexist; rating /
password-strength are specialized meter presentations (consumers, not forks).

Seams: `status-indicator` = discrete enum state vs meter = continuous bounded number; `loader` =
task-over-time completion (`role=progressbar`, may be indeterminate) vs meter = standing measurement
(`role=meter`, always determinate, has zones); a future `progress` ↔ meter boundary is exactly the ARIA
meter/progressbar split; meter is read-only display vs a range *input* (editable form control) — note to
prevent conflation.

## Concrete recommendation on the progress sibling (for Fork 2)

File a new backlog **decision** at ratify time (not during prep):

- **Title:** "Progress indicator (task-over-time, `role=progressbar`): first-class intent, or covered by
  `loader`'s `progress` dimension? — placement"
- **Framing:** WE has determinate/indeterminate task progress today only as a *dimension* of `loader` (and
  step-position in `flow-progress`). `<progress>` / `role=progressbar` is a distinct ARIA role from meter;
  decide whether a determinate progress readout *not* tied to a pending/blocking lifecycle (e.g. "uploading
  6 of 10 files" surfaced standalone) warrants its own thin intent/block, or whether `loader.progress` is
  the canonical home. Default lean: covered by `loader` (~60%) — but the question is real and belongs filed
  alongside #1410 so the meter↔progress boundary is settled together.
