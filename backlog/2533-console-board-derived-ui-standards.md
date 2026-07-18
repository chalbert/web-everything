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

Building the plateau console board (#2505 lane board) surfaced seven candidate low-level UI primitives. This decision ratifies, per candidate, whether to **mint** a standard, **extend** an existing one, **park** it, or **keep it app-custom**. The forks are grounded in a prior-art survey published as [/research/console-board-derived-ui-primitives/](/research/console-board-derived-ui-primitives/) (d3-scale, Vega-Lite encodings, native `<progress>`/`<meter>`, Pad++/DeepZoom, Gantt/burndown datum lines) and each carries a recommended default in **bold**. A prep skeptic pass attacked every default and a fresh-context two-confusion screen re-checked every framing; the net is recorded in the `Skeptic:`/`Screen:` line under each fork.

**Grounding digest.** The board's card cell, badge, verb, and progress bar already dogfood ratified FUI blocks (`we-section-card`/`we-badge`/`we-button`/`we-progress`); the curved dependency connectors are already the ratified **Web Graph** standard (`@webeverything/contracts/graph` = `we:contracts/graph.ts`, #1289/#1352 — only the DOM-anchored board overlay #1289 remains, and that is *integration*, not a new standard). Each fork below is measured against the **exact** existing standard that already owns its turf, cited as a `we:` locus ref. The through-line the survey + skeptic produced: **mint nothing on one board's evidence.** WE's bar for minting is a *second consumer beyond this board* (memory: WE holds zero impl; a standard exists to be reused across independent parties), and every candidate here either composes an existing standard or is app architecture. Three residues are named as graduation candidates for when a genuine second consumer appears.

### Triage context

- **Kind**: Intent(s) and/or a small visual-encoding primitive · **Native grounding**: `<progress>`/`<meter>`, CSS Grid, SVG, `backdrop-filter`, scroll-driven-animations
- **Native-first**: ▽ mostly thin extensions of native primitives · **Gap**: ◇ collapsed to ~zero on re-attack · **Effort**: ◆ low–medium · **Source**: board mock v68 + attention-card taxonomy

### Axis-framing — each fork's standard-of-record

Each candidate is classified against the one existing standard that already owns its turf, pinned to a `we:` locus ref (verified to exist):

- **Fork 1 · scale-ruler** — measured against `we:src/_data/projects/webcharts.json` (Web Charts, #105 — Vega-Lite L1 `size`/positional encodings) and native `<progress>`/`aspect-ratio`.
- **Fork 2 · progress multi-track** — measured against `we:src/_data/intents/progress.json` (thin, #1469; names `loader.progress`/`flow-progress` as *consumers that compose it*), `we:src/_data/intents/flow-progress.json` (already has a `board` register value), `we:src/_data/intents/meter.json`, and `we:docs/agent/platform-decisions.md#readout-placement-by-value-type` (presentation is a dimension, not a home; re-typing forbidden).
- **Fork 3 · semantic-zoom / LOD** — measured against `we:src/_data/intents/viewport-transform.json` (geometric pan/zoom, disclaims representation), `we:src/_data/intents/hierarchy.json` (tree traversal), and `we:src/_data/intents/density.json`.
- **Fork 4 · threshold-region overlay** — measured against Fork 1's axis and `we:src/_data/intents/meter.json` (a single scalar-bar tick).
- **Fork 5 · annotated visual-diff surface** — measured against `we:src/_data/intents/audit-timeline.json` (a text/event feed).
- **Fork 6 · simulation / dry-run mode** — measured against `we:src/_data/intents/experiment.json` (declarative variant *assignment*, not write-suppression).
- **Fork 7 · swimlane / span-layout** — measured against `we:contracts/graph.ts` (Web Graph) + CSS Grid.

### Recommended path at a glance

Ratify the column, or override just the forks you'd change. **Confidence** shows where judgment is actually needed. "Second consumer?" flags whether a reusable-standard case exists **beyond this one board** (the bar for minting) — and the honest answer is *no* for all seven, which is what collapsed the mint/extend defaults.

| Fork | Recommended default | Main alternative (override) | 2nd consumer beyond the board? | Confidence |
|---|---|---|---|---|
| **Fork 1 · scale-ruler** | **keep app-custom now** — compose Web Charts' scale; the axis-without-marks residue graduates to a Web Charts extension when a 2nd consumer appears | mint a standalone primitive now | no (three features of *one* board) | **Med-high** |
| **Fork 2 · progress multi-track** | **compose two `progress` readouts** + FUI overlay presentation; don't extend the intent | extend `progress` with a generic secondary-track presentation dimension | no | **Med** |
| **Fork 3 · semantic-zoom / LOD** | **keep app-custom** — compose navigation + `hierarchy` + `density`; no intent | mint a representational-zoom intent | no | **Med** *(genuine taxonomy question)* |
| **Fork 4 · threshold-region overlay** | **keep app-custom** — datum line is a tick on Fork 1's axis; the desaturation mask is FUI CSS | mint a standalone overlay primitive | no | **Med** |
| **Fork 5 · annotated visual-diff surface** | **keep app-custom now** — the contract is unshaped; graduation trigger = a 2nd diff surface that names the delta-type taxonomy | mint an intent now · a not-yet validation-gate | not yet | **Low-med** |
| **Fork 6 · simulation / dry-run mode** | **keep app-custom** — a no-writes preview *mode* is runtime behavior (impl-not-a-standard); the only WE-shaped residue is a provisional-state data-semantic | mint a `sandbox-mode` intent | no | **Med-high** |
| **Fork 7 · swimlane / span-layout** | **keep app-custom** — lanes = CSS Grid, fork/fan-in/connectors = Web Graph; name the lane-docking residue as a future Web Graph extension | mint a swimlane intent | no | **High** |

## Fork 1 — scale-ruler (the shared quantitative axis)

**Fork-existence:** genuine either/or — *mint a WE primitive* and *keep it app-custom* cannot coexist (you either add the contract to WE or you don't); the excluded branch is "mint now," flawed because there is no second consumer to warrant a standard.

The board renders two things against one time ruler (`1pt ≈ 9min ≈ 17px`): a card's **height** encodes its size, and its **horizon-crossing** encodes its proven fraction; a lane's stacked heights read as its **ETA**. "Extent/position = a scalar on a shared labeled axis, with an aggregate" is the residue once Web Charts (`we:src/_data/projects/webcharts.json`, #105, Vega-Lite `size` encoding) is subtracted.

- **(a — recommended) Keep app-custom now; the axis-without-marks residue is a Web Charts extension.** The board composes an existing scale (Web Charts' Vega-Lite scale / d3-scale's `scaleLinear`); the "bare labeled axis + aggregate" is Vega-Lite's encoding *minus the marks*, so its home — if it ever needs one — is a Web Charts extension, not a fresh primitive. Graduation trigger: a genuine off-board second consumer.
- **(b) Mint a standalone `scale-ruler` primitive now** — `{ scalar, unit, pxPer, cap?, axisRef } → length|position + aggregate`. *Rejected as the default* — the three claimed consumers (sized cards, progress-position, lane-ETA) are all features of the *same* board; that is one consumer wearing three hats, not the second, independent consumer the mint bar requires. Overridable if the decider reads the three reuses as sufficient.

**Classification (per-fork pass):** Q1 layer = would be an Intent/encoding dimension, but Q2/reuse = it is *residue of an existing standard* (Web Charts owns the encoding grammar). Q6 most-permissive default = compose the existing scale. No protocol (no swappable-vendor story).
**Skeptic:** REFUTED → flipped mint→app-custom. Three board features are not a second consumer, and "a bare labeled axis + aggregate" is exactly Web Charts' `size`/positional encoding minus the marks — residue of an existing standard, not a new primitive.
**Screen:** clear — the merit the mint-case saw is preserved (named as a Web Charts extension residue + a concrete graduation trigger), so nothing is discarded; the ruling is on merit (it's Web Charts' turf), timing is a trigger.

## Fork 2 — progress multi-track (plan-claimed vs proven)

**Fork-existence:** genuine either/or — *extend the `progress` contract* vs *don't* cannot coexist; the excluded branch is "extend progress (or mint a new intent)," flawed because it re-types provenance as completion and bakes presentation into a deliberately-thin contract.

Board cards show **two** fractions: the agent's plan claim and the spec-proven amount. Everything else in the first "progress family" sketch maps to ratified homes — bar = `we:src/_data/intents/progress.json`, gauge = `we:src/_data/intents/meter.json`, checklist ≈ `we:src/_data/intents/flow-progress.json` (which already has a `board` register — a config dimension, "never a fork"), position = Fork 1's ruler. Unifying bar+gauge under one "render dimension" is **illegal** — it re-opens the ratified `progress ≠ meter ≠ status` decision (`we:docs/agent/platform-decisions.md#readout-placement-by-value-type`, #1469/#1410).

- **(a — recommended) Compose two `progress` readouts; don't extend the intent.** `progress` is thin by ratification (#1469) and names its consumers as things that *compose* it, so two completion magnitudes are two composed readouts, and rendering them as one overlaid track (the buffered-vs-played pattern) is a *presentation* concern FUI owns (presentation is a dimension, not a home). The board's specific "claimed vs verified" is a **data-provenance / trust** distinction — if it needs a standard home that home is provenance/audit, never a second track on `progress`.
- **(b) Extend `progress` with a generic secondary-track presentation dimension.** *Main alternative (overridable)* — defensible because intents own their presentation dimensions; but it re-adds to a deliberately-thin contract what a composing consumer + FUI presentation already cover, and it risks smuggling the provenance semantic onto a completion intent.
- **(c) Mint a new "progress-family" intent.** *Rejected* — re-litigates a ratified typing decision; the family already exists as separate intents.

**Classification (per-fork pass):** Q1 = Intent dimension; Q2 no protocol; Q3/Q4 the "second track" is a *presentation* value, and presentation is already a dimension the intent owns (readout-placement) → not a new contract. Provenance is a *seam to another concern* (Q7), not a progress dimension.
**Skeptic:** REFUTED → flipped extend→compose. Progress names consumers that compose it; "claimed vs verified" is provenance, not a completion magnitude, so extending the base intent mis-types it and bakes presentation into the contract.
**Screen:** clear — keep the two-track notion generic (claimed-vs-proven is the app's binding, not a backlog-domain term baked into WE); the surviving judgment (compose vs extend) is preserved as the override in (b).

## Fork 3 — semantic-zoom / level-of-detail navigation

**Fork-existence:** genuine either/or — *mint a representational-zoom intent* vs *keep app-custom* cannot coexist; the excluded branch is "mint," flawed because drill-down navigation already composes from existing standards and no second consumer warrants a new one.

The board's L0→L3 (constellation tiles → lane board → gate checklist → build inspector) is a zoom where **each level is a different representation**, not a scaled view. `we:src/_data/intents/viewport-transform.json` owns geometric pan/zoom (and explicitly disclaims representation); `we:src/_data/intents/hierarchy.json` owns tree traversal; `we:src/_data/intents/density.json` owns detail-tier.

- **(a — recommended) Keep app-custom — compose navigation + `hierarchy` + `density`.** "Each level is a different view" is drill-down routing + density/responsive rendering the platform already provides; the only non-trivial residue is a "floor of signals that must survive every level," and one board wanting it is not a second consumer.
- **(b) Mint a `semantic-zoom` / LOD intent.** *Main alternative (overridable)* — representational LOD is genuinely distinct from geometric zoom, so *naming* it is a real taxonomy call (the screen kept this open); but the mint bar needs a second, non-board consumer first.
- **(c) Extend `viewport-transform`.** *Rejected* — conflates geometric zoom with representational swap.

**Classification (per-fork pass):** Q1 = candidate Intent, but Q2/reuse fails (no protocol, no 2nd consumer); Q4 the level axis could be a dimension, but its owner is navigation/`density` composed, not a new home. Genuine taxonomy question → Confidence Med.
**Skeptic:** REFUTED → flipped mint→app-custom. "Each level a different page" is routing + density rendering (navigation already exists); the absence of an owner doesn't mint an intent when app navigation policy is the un-beaten null hypothesis and there's no off-board consumer.
**Screen:** clear — representational LOD *is* genuinely distinct from geometric zoom (kept as the (b) override with Confidence Med, the one fork where skeptic and screen legitimately diverge); the mint is held only by the second-consumer bar, not by a framing flaw.

## Fork 4 — threshold-region overlay (the horizon mask)

**Fork-existence:** genuine either/or — *mint a standalone overlay* vs *keep app-custom* cannot coexist; the excluded branch is "mint standalone," flawed because it is not separable from Fork 1's axis and its visual half is FUI CSS.

The board draws **one dashed datum line across all columns** and a `backdrop-filter: grayscale` mask that renders the "past" side as history. `we:src/_data/intents/meter.json` only owns a single scalar-bar tick.

- **(a — recommended) Keep app-custom.** The datum line **is a tick on Fork 1's axis** (a reference value on the shared scale), so it is not a separable primitive; the "past" desaturation mask is region **styling** FUI owns (`backdrop-filter`), not a WE contract. The only conceivably-WE-shaped part is the *semantic* "mark this region as past/crossed-threshold," and that rides the axis rather than standing alone.
- **(b) Mint a standalone `threshold-region` primitive.** *Rejected as the default* — bundles an axis tick (Fork 1's turf) with a CSS treatment (FUI's turf); nothing separable remains, and no second consumer wants a past/future split.

**Classification (per-fork pass):** Q1 = the datum is encoding (Fork 1), the mask is presentation (FUI). Not a distinct layer of its own. Q7 seam: the "past/crossed" semantic sits on the axis, gated to a threshold value.
**Skeptic:** REFUTED → flipped mint→app-custom. The datum line is a tick on the axis Fork 1 defines and the grayscale-past is pure CSS; there is no standard here distinct from the axis, and no second consumer.
**Screen:** flagged(impl) → fixed. The desaturation *mask* was an impl (visual-treatment) leak onto the WE side — ceded to FUI; only the semantic "past/crossed-threshold" marking is WE-shaped, and it rides the axis rather than minting a primitive.

## Fork 5 — annotated visual-diff surface

**Fork-existence:** genuine either/or — *mint a diff-surface intent* vs *keep app-custom* cannot coexist; the excluded branch is "mint now," flawed because the contract is unshaped (no delta-type taxonomy or anchor payload defined).

The L3 inspector's "design → built" two-pane compare with numbered, clickable, **typed** delta regions (real drift vs "expected, not reached yet"). No standard owns side-by-side visual comparison (`we:src/_data/intents/audit-timeline.json` is a text feed).

- **(a — recommended) Keep app-custom now; the contract is unshaped.** An annotated-diff-surface intent is a *plausible* candidate on merit, but its contract (the delta-type taxonomy, the anchor payload, the accept/typed-region model) is not yet shaped, so there is nothing to ratify. Graduation trigger: a **second** review/diff surface that names the delta-type taxonomy — at which point mint (or a not-yet validation-gate) becomes the call.
- **(b) Mint an intent now** *(or file a not-yet validation-gate)*. *Rejected as the default* — premature: shape the contract once a second diff surface exists; a validation-gate beats a park-for-cost if a placeholder is wanted.

**Classification (per-fork pass):** Q1 = candidate Intent, but the contract is under-specified (which-layer test can't run cleanly over an unshaped contract — Contract-first: don't narrow it to force a verdict). No protocol.
**Skeptic:** REFUTED → flipped park→app-custom. "Park (heavier; no second consumer yet)" cited cost and demand — both forbidden fork reasons; stripped of them, the merit-honest verdict is that the contract is simply unshaped, so app-custom now with a concrete trigger.
**Screen:** flagged(prio) → fixed. "No second consumer yet" was prioritization wearing a fork's clothes; re-ruled on merit (the contract is unshaped) and the demand signal demoted to a concrete graduation trigger, not the verdict.

## Fork 6 — simulation / dry-run surface mode

**Fork-existence:** genuine either/or — *mint a `sandbox-mode` intent* vs *keep app-custom* cannot coexist; the excluded branch is "mint," flawed because a whole-surface no-writes *mode* is runtime behavior (impl), not a definitions-layer contract.

A whole-surface mode that freezes live data, disables writes, and diffs on exit ("no writes" banner, inert verbs). `we:src/_data/intents/experiment.json` owns declarative variant *assignment* (who sees what) — a different thing from write-suppression.

- **(a — recommended) Keep app-custom (impl-not-a-standard).** A "safe preview / no-writes" *mode* is runtime behavior that lives in FUI/app; WE holds zero impl, so there is no definitions-layer contract to hold. The only conceivably-WE-shaped residue is a **provisional / uncommitted state** *data-semantic* (a value's "not yet committed" flag), not a mode — and that has no second consumer yet.
- **(b) Mint a `sandbox-mode` intent.** *Rejected* — mis-frames an impl behavior as a standard-in-waiting; a mode is not a declarative UX contract.

**Classification (per-fork pass):** Q1 = neither Block/Intent/Protocol/Capability on the WE side — it is impl (a runtime mode). The `experiment` seam is adjacent but distinct (assignment ≠ write-suppression).
**Skeptic:** REFUTED → flipped park→keep-app-custom. A whole-surface freeze-writes mode is a running behavior = impl-not-a-standard; "park" implied it might later mint, mis-labeling impl as a standard-in-waiting.
**Screen:** flagged(impl) → fixed. The dry-run *mode* is a runtime behavior (impl/FUI); the verdict was re-cast from "park" to keep-app-custom, and the only WE-worthy residue named as a provisional-state data-semantic, not a mode.

## Fork 7 — swimlane / span-layout

**Fork-existence:** genuine either/or — *mint a swimlane intent* vs *keep app-custom* cannot coexist; the excluded branch is "mint," flawed because lanes + fork/fan-in decompose cleanly into existing standards (CSS Grid + Web Graph), leaving no generic residue with a second consumer.

Lanes-as-columns, forkable sub-columns re-joining at a fan-in, multi-lane span docking. Subtract what exists — contiguous lanes+spans = CSS Grid `grid-column`, fork/fan-in/cross-lane wires = **Web Graph** (`we:contracts/graph.ts`, already standard) — and there is no generic residue with a second consumer.

- **(a — recommended) Keep app-custom** — board choreography, composed over CSS Grid + Web Graph. The one thing neither owns is the **lane-assignment / docking semantics** (which track a node belongs to, how it docks); name that as a candidate **Web Graph extension** (a `lane`/`track` layout constraint) so a genuine second consumer later extends the existing graph standard rather than re-deriving it.
- **(b) Mint a swimlane intent.** *Rejected* — no reuse case beyond this board; would be policy dressed as a standard.

**Classification (per-fork pass):** Q1 = decomposes into CSS Grid (layout) + Web Graph (`we:contracts/graph.ts`, nodes/edges). The lane-docking residue is a *layout constraint* on the existing graph standard, not a new intent (separate-and-decouple: extend the owner, don't spawn a sibling).
**Skeptic:** SURVIVES-WITH-AMENDMENT → app-custom holds; the lane-assignment/docking residue (which Web Graph's nodes/edges don't yet express) is named as a future Web Graph extension so a second consumer extends the existing standard.
**Screen:** clear — a genuine composability "no" (swimlane decomposes into existing standards), not a timing call; revisit only if a swimlane use appears that Grid + Web Graph provably cannot compose.

## Context

### Out of scope — capture, don't mint (partial gaps; an adjacent standard exists)

Flagged from the mock-mining, each is a capability a nearby standard *almost* owns; note them, don't decide here: **data-liveness/freshness** indicator (beyond `reliability`/`query` stale semantics) · **receding-history / fade-scrollback** region (beyond `audit-timeline`'s flat feed) · **overflow-collapse-to-rail** (priority-plus columns → strips, beyond `sidebar`/`reel`) · **adaptive-detail-tier per item** (LOD orthogonal to status, beyond `density`+`disclosure`) · **collaborative claim / presence-lock** (beyond single-writer `mutation`) · **roving focus over a computed attention set** (beyond ARIA roving-tabindex).

### Named graduation residues (mint when a 2nd consumer appears)

The three things worth *not* losing, each parked against its owning standard with a concrete trigger: (1) a **Web Charts axis extension** (the bare labeled-axis-without-marks, Fork 1); (2) a **Web Graph lane/track layout constraint** (lane-assignment/docking, Fork 7); (3) a **provenance / uncommitted-state data-semantic** (claimed-vs-verified, Fork 2; provisional-state, Fork 6). None mints now; each graduates to an extension of its *existing* owner on a genuine second, off-board consumer.

## Progress

Prepared 2026-07-18 from the board build (#2505). This pass: a prior-art survey published as [/research/console-board-derived-ui-primitives/](/research/console-board-derived-ui-primitives/), a per-fork classification pass grounded on `we:` locus refs, a skeptic sub-agent that **flipped six of seven defaults** (mint/extend → app-custom/compose) on the second-consumer bar + impl-not-a-standard, and a fresh-context two-confusion screen that fixed the Fork 4 impl leak (desaturation → FUI) and the Fork 5/6 prioritization framings. Fork 7 survived with an amendment. Awaiting ratification; override any fork.
