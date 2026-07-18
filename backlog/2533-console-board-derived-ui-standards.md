---
kind: decision
size: 5
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
tags:
  - design-decision
  - standards
  - ui-primitives
  - plateau-console-board
  - gap-analysis
---

# Decide which console-board-derived primitives become WE standards

Building the plateau console board (#2505 lane board) surfaced a set of candidate low-level UI primitives. A red-team of the **whole** standards surface — `contracts/`, `projects/`, `researchTopics/`, `intents/`, `capability-manifest/`, and FUI `blocks/`+`graphs/` — collapsed the initial "3–4 novel protocols" down: most are already owned or are app policy. This decision ratifies, per candidate, whether to **mint** a standard, **extend** an existing one, **park** it, or **keep it app-custom**. The research is done (mock-mining + catalog challenge); this is a fast ratification, override any single fork.

The board's card cell, badge, verb, and progress bar already dogfood ratified FUI blocks (`we-section-card`/`we-badge`/`we-button`/`we-progress`); the curved dependency connectors are already the ratified **Web Graph** standard (`@webeverything/contracts/graph`, #1289/#1352 — only the DOM-anchored board overlay #1289 remains, and that is *integration*, not a new standard). So the open question is only the genuinely-uncovered residue below.

### Triage context

- **Kind**: Intent(s) and/or a small visual-encoding primitive · **Native grounding**: `<progress>`/`<meter>`, CSS Grid, SVG, `backdrop-filter`, scroll-driven-animations
- **Native-first**: ▽ mostly thin extensions of native primitives · **Gap**: ◆ small residue · **Effort**: ◆ low–medium · **Source**: board mock v68 + attention-card taxonomy

### Recommended path at a glance

Ratify the column, or override just the forks you'd change. **Confidence** shows where judgment is actually needed. "Second consumer?" flags whether a reusable-standard case exists beyond this one board (the bar for minting).

| Fork | Recommended default | Main alternative | 2nd consumer? | Confidence |
|---|---|---|---|---|
| **A · `scale-ruler`** | **mint** a tiny primitive: scalar → length/position on a shared labeled axis + aggregate readout | fold into `webcharts` · keep app-custom | yes (sized cards + progress-position + lane-ETA) | **Med-high** |
| **B · `progress` multi-track** | **extend** `progress` with an optional secondary track (plan-claimed vs proven) | new intent *(rejected — re-litigates `progress ≠ meter`)* | yes (any claim-vs-verified progress) | **High** |
| **C · semantic-zoom / LOD** | **mint** a representational-zoom intent (each level a different representation, not a scaled one) | extend `viewport-transform` · park | maybe | **Med** |
| **D · threshold-region overlay** | **mint** a small visual primitive: one datum line across columns + a "past" desaturation mask | fold into `scale-ruler` · app-custom | maybe | **Med** |
| **E · annotated visual-diff surface** | **park** as a candidate (heavier; no 2nd consumer yet) | mint now · app-custom | not yet | **Low-med** |
| **F · simulation / dry-run mode** | **park** (`experiment` is adjacent; app-flavored) | mint · app-custom | not yet | **Low** |
| **G · swimlane / span-layout** | **keep app-custom** (lanes = CSS Grid; fork/fan-in/connectors = Web Graph) | mint a swimlane intent | no | **High** |

## Fork A — `scale-ruler` (the shared quantitative axis)

The board renders two things against one time ruler (`1pt ≈ 9min ≈ 17px`): a card's **height** encodes its size, and its **horizon-crossing** encodes its proven fraction; a lane's stacked heights read as its **ETA**. "Extent/position = a scalar on a shared labeled axis, with an aggregate" is the residue once `webcharts` (#105, Vega-Lite `size` encoding) is subtracted — a tiny, generic primitive with several consumers.

- **(A — recommended) Mint `scale-ruler`** — the minimal `{ scalar, unit, pxPer, cap?, axisRef } → length|position + aggregate`. P-position (Fork on progress) and sized-cards both compose it; nothing else owns "shared labeled axis + aggregate."
- **(B) Fold into `webcharts`.** *Weaker* — webcharts is a full chart grammar; a bare board doesn't want a chart, just the axis math.
- **(C) Keep app-custom.** *Rejected if a 2nd consumer holds* — the axis is reused by ≥3 board features already; that is the reuse bar.

## Fork B — `progress` multi-track (plan-claimed vs proven)

Board cards show **two** fractions: the agent's plan claim and the spec-proven amount. Everything else in my first "progress family" sketch maps to ratified homes — bar = `progress`, gauge = `meter`, checklist ≈ `flow-progress` (which already has a `board` register), position = Fork A's ruler. Unifying bar+gauge under one "render dimension" is **illegal** — it re-opens the ratified `progress ≠ meter ≠ status` decision (`we:docs/agent/platform-decisions.md#readout-placement-by-value-type`, #1469/#1410). The only real gap is the second track.

- **(A — recommended) Extend `progress`** with an optional secondary/comparison track (claimed vs verified) — a thin dimension, native `<progress>` degrades to the primary track.
- **(B) New "progress-family" intent.** *Rejected* — re-litigates a ratified typing decision; the family already exists as separate intents.

## Fork C — semantic-zoom / level-of-detail navigation

The board's L0→L3 (constellation tiles → lane board → gate checklist → build inspector) is a zoom where **each level is a different representation**, not a scaled view. `viewport-transform` owns geometric pan/zoom; `hierarchy` owns tree traversal; neither owns representational LOD (nor the "attention never compresses away" floor).

- **(A — recommended) Mint a `semantic-zoom` / LOD intent** — a level axis where each level swaps representation, with a floor for signals that must survive every level. Reusable by any drill-down console/map/IDE.
- **(B) Extend `viewport-transform`.** *Weaker* — conflates geometric zoom with representational swap.
- **(C) Park** until a second, non-board consumer is named. *Fallback if the reuse case feels board-only.*

## Fork D — threshold-region overlay (the horizon mask)

Separate from Fork A's *position* math: the board draws **one dashed datum line across all columns** and a `backdrop-filter: grayscale` mask that renders the "past" side as history. That "split a multi-column surface at a threshold and treat one side differently" is a pure visual-encoding primitive; `meter` only owns a single scalar-bar tick.

- **(A — recommended) Mint a small `threshold-region` overlay primitive** — a datum line + region treatment across a columnar surface.
- **(B) Fold into `scale-ruler`.** *Possible* — the line sits on the ruler; but the *region masking* is a separable concern.
- **(C) App-custom.** *Fallback* — if no second consumer wants a past/future split.

## Fork E — annotated visual-diff surface

The L3 inspector's "design → built" two-pane compare with numbered, clickable, **typed** delta regions (real drift vs "expected, not reached yet"). No standard owns side-by-side visual comparison (`audit-timeline` is a text feed).

- **(A — recommended) Park** as a named candidate — heavier surface, no second consumer yet.
- **(B) Mint now.** *Premature* — shape it once a second review/diff surface needs it.

## Fork F — simulation / dry-run surface mode

A whole-surface mode that freezes live data, disables writes, and diffs on exit ("no writes" banner, inert verbs). `experiment` owns A/B; nothing owns a UI "safe preview / sandbox mode."

- **(A — recommended) Park.** App-flavored; revisit if a second surface wants a sandbox mode.
- **(B) Mint a `sandbox-mode` intent.** *Later.*

## Fork G — swimlane / span-layout

Lanes-as-columns, forkable sub-columns re-joining at a fan-in, multi-lane span docking. Subtract what exists — contiguous lanes+spans = CSS Grid `grid-column`, fork/fan-in/cross-lane wires = **Web Graph** (already standard) — and there is no generic residue with a second consumer.

- **(A — recommended) Keep app-custom** — board choreography, composed over CSS Grid + Web Graph.
- **(B) Mint a swimlane intent.** *Rejected for now* — no reuse case beyond this board; would be policy dressed as a standard.

### Out of scope — capture, don't mint (partial gaps; an adjacent standard exists)

Flagged from the mock-mining, each is a capability a nearby standard *almost* owns; note them, don't decide here: **data-liveness/freshness** indicator (beyond `reliability`/`query` stale semantics) · **receding-history / fade-scrollback** region (beyond `audit-timeline`'s flat feed) · **overflow-collapse-to-rail** (priority-plus columns → strips, beyond `sidebar`/`reel`) · **adaptive-detail-tier per item** (LOD orthogonal to status, beyond `density`+`disclosure`) · **collaborative claim / presence-lock** (beyond single-writer `mutation`) · **roving focus over a computed attention set** (beyond ARIA roving-tabindex).

## Progress

Prepared 2026-07-18 from the board build (#2505) — a mock-mining pass (board v68 + attention-card taxonomy) and a whole-catalog challenge. Awaiting ratification; override any fork.
