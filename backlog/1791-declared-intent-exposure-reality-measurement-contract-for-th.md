---
kind: decision
parent: "1522"
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
codifiedIn: one-off
locus: plateau-app
tags: [explorer, intent-conformance, declared-intent, dev-browser]
relatedReport: reports/2026-06-26-runtime-intent-conformance-measurement.md
preparedDate: "2026-06-26"
---

# Declared-intent exposure + reality-measurement contract for the explorer intent-conformance oracle

Gates #1698 (the explorer's intent-conformance oracle). Ruled 2026-06-26 by a **layer split**: (1) **exposure already exists** — a page declares its UX profile via root `data-intent-*` attributes, dissolving that fork; (2) **a11y-level is not an intent** — by the ratified intents-are-UX-only principle a WCAG conformance tier is a technical platform-config value, emitted on the #1689 conformance channel and measured absolutely by axe, **not** an axis of this oracle. So this is a **UX-intent-conformance** oracle over **density + motion**; the one fork (density metric) ruled to a spacing/whitespace ratio. See **## Ruling**.

## Axis framing

The decision splits by **layer**, and the layer split is the whole reframe. **Intents are UX-only** (ratified principle — the intent layer expresses *what the user wants*, never how it's computed, and carries no technical references). Density and motion qualify: density is a UX choice over whitespace/touch-targets ([we:src/_data/intents/density.json:1-17](../src/_data/intents/density.json#L1) — comfortable / compact / wafer), motion is a UX choice over animation physics ([we:src/_data/intents/motion.json:1-17](../src/_data/intents/motion.json#L1) — natural / immediate / reduced). Both are **already exposed** via root `data-intent-*` attributes — `INTENT_PROFILE_ATTRS = { density, mode, motion }` ([plateau:src/dev-browser/intent-inspector/inspect.ts:11-24](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L11)), read by `readIntentProfile()` ([plateau:src/dev-browser/intent-inspector/inspect.ts:26-33](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L26)), emitted by the FUI workbench from `preset.intentDefaults` ([fui:workbench/mount.ts:330-333](../../frontierui/workbench/mount.ts#L330)). So **exposure is not a fork** — reuse the live contract (the #1689 `DeclaredRule` is the wrong layer for a *profile*, [plateau:src/dev-browser/declared-rules/types.ts:35-56](../../plateau-app/src/dev-browser/declared-rules/types.ts#L35); a per-page manifest is redundant).

**a11y-level is a different layer.** A WCAG conformance tier (A / AA / AAA) is not a UX preference a designer picks for feel — it is a technical **conformance target**, which by the platform-config three-layer carve (#1780/#1702) is a product-set **value** over a WE-owned schema. Its natural runtime channel is the conformance layer #1689 already models — `DeclaredRule { kind: 'conformance', tier }` ([plateau:src/dev-browser/declared-rules/types.ts:46-49](../../plateau-app/src/dev-browser/declared-rules/types.ts#L46)) — not `data-intent-*`. And it is measured **absolutely**: axe already collects WCAG 2.0/2.1 A/AA violations into `Observation.a11yViolations` ([plateau:tools/explorer/oracles/observation.ts:39-46](../../plateau-app/tools/explorer/oracles/observation.ts#L39)) regardless of any declaration. So a11y is **not an axis of this oracle** (see settled call below). That leaves one real divergence fork — the density metric — riding the existing oracle pipeline (`Oracle.check(obs: Observation): Finding[]`, [plateau:tools/explorer/oracles/observation.ts:88-92](../../plateau-app/tools/explorer/oracles/observation.ts#L88)). Constellation (the verifier-vs-subject split, #1467): WE owns the intent vocabulary/bands; the plateau explorer owns the measurer.

### The calls — for your review

| # | Call | Status | Position |
|---|---|---|---|
| **1** | **a11y-level: an axis of this oracle?** | **Settled (by principle)** | a11y conformance is technical, not a UX intent → **not this oracle's axis.** Absolute axe stays; a *declared-relative* overclaim (vs an emitted #1689 conformance tier) is a separate **conformance-lane** follow-up, filed on ratify, triggered when an app emits a tier. |
| **2** | **density reality metric** | **Fork (one default)** | **spacing/whitespace ratio bucketed into the bands** — *not* touch-target hit-size (skeptic-refuted: a one-sided floor re-badges WCAG and double-counts axe). Prerequisite: `we:density.json` must gain quantified spacing bands. |

### Settled by default (confirm or override)

- **Exposure splits by layer — two channels.** Density + motion (UX intents) → the existing `data-intent-*` root attributes ([plateau:src/dev-browser/intent-inspector/inspect.ts:11-33](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L11)). a11y-level (platform conformance-config) → the #1689 conformance-tier channel, *not* `data-intent-*`. Reusing both live layers is forced; minting a parallel intent attribute for a11y is the category error this reframe corrects.
- **a11y is not an axis of this oracle.** This is a **UX-intent-conformance** oracle (density + motion). a11y conformance is a sibling technical concern: the **absolute** axe lane already in `Observation` now; a **declared-relative overclaim** (read an emitted #1689 conformance tier, flag findings at/below it — never suppress) later, homed in the conformance lane, not here. Grounded in the ratified intents-are-UX-only principle + the three-layer config carve (#1780/#1702). *The earlier "mint `data-intent-a11y-level`" option is withdrawn — it put a technical conformance property in the UX-intent vocabulary.*
- **Reality fields live on the existing `Observation`.** Declared profile + measured-reality fields as narrow optionals on `Observation`, populated by the existing collector — same pattern as its existing oracle-specific optionals (`clippedResidue?`, `scrollJump?`, `dragDragsPage?`, [plateau:tools/explorer/oracles/observation.ts:64-75](../../plateau-app/tools/explorer/oracles/observation.ts#L64)). A separate `IntentObservation` is excluded: #1698 rides the existing single collector + judge + finding pipeline, and field-count is not schema-coupling (#1662).
- **Motion reality = a second observe-time media-emulated render.** Re-render the state under `page.emulateMedia({ reducedMotion: 'reduce' })` and flag still-active non-semantic animation (`Element.getAnimations()`). A **named first-class cost**: the collector cannot replay a settled state (#1525), so this is a distinct emulated observe at observe-time, not a post-hoc re-read. Only one method (native View Transitions don't auto-respect reduced-motion — [we:conformance-vectors/slide-transition-reduced-motion.vectors.ts](../conformance-vectors/slide-transition-reduced-motion.vectors.ts)), so no fork.

## Fork 1 — density reality metric: spacing/whitespace ratio vs touch-target floor

*Fork-existence: a compact page can have large buttons but tight gaps (or the reverse), so touch-target size and spacing density **disagree** on the divergence verdict — the oracle must pick ONE authoritative signal; they cannot both be "the" metric without conflicting findings.*

- **(a) Spacing/whitespace ratio — DEFAULT.** Measure a spacing signal — median inter-element gap / content-to-whitespace ratio of a representative container — bucket it into the three declared bands, flag divergence from the declared band. This is the dimension the bands' prose actually distinguishes on (comfortable "whitespace for grouping" vs compact "border-based grouping / high information density", [we:src/_data/intents/density.json:13](../src/_data/intents/density.json#L13)) and the one a human reads as "density" — the **UX-fidelity** question this oracle exists to answer.
- **(b) Touch-target hit-size floor — REFUTED.** Measure interactive-element `getBoundingClientRect` against the declared floor (compact ⇒ ≥32px). Rejected: the floor is **one-sided** (bigger-than-floor always passes, so a comfortable page passes a `compact` floor), so the only thing it catches is a control *below* floor — a WCAG 2.5.8 target-size violation re-badged, double-counting the absolute axe lane. It is also the **a11y framing leaking into a UX measurement** — exactly the layer-confusion this re-prep corrects: target-size conformance is axe's absolute job, not the density-intent fidelity check.

**Prerequisite (the live cost of the default).** [we:src/_data/intents/density.json:1-17](../src/_data/intents/density.json#L1) ships *quantified* bands only for touch targets (44/32/24px); spacing/info-density are **prose**, with no measurable gap ranges. So the spacing-ratio metric cannot divergence-check until `we:density.json` gains quantified spacing bands per level — file as a blocking child of #1698. Motion-reality (settled above) ships now regardless.

**Skeptic:** REFUTED the original touch-target default and surfaced the spacing-band prerequisite; the decision discussion then reinforced the flip via the intents-are-UX-only principle (touch-target = a11y layer, spacing = UX layer). Default = spacing/whitespace ratio.

## Ruling (ratified 2026-06-26)

The contract for #1698, settled by the layer split:

1. **This is a UX-intent-conformance oracle over density + motion.** Intents are UX-only; a11y conformance is technical and out of this oracle's scope.
2. **Exposure** reuses the existing root `data-intent-*` attributes ([plateau:src/dev-browser/intent-inspector/inspect.ts:11-33](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L11)) — no new mechanism, no `data-intent-a11y-level`.
3. **Reality fields live on the existing `Observation`**, populated by the existing collector.
4. **Motion reality** = a second observe-time `emulateMedia({ reducedMotion: 'reduce' })` render flagging still-active non-semantic animation (a named cost — the collector can't replay, #1525). Buildable now.
5. **Density reality (Fork 1)** = a **spacing/whitespace ratio** bucketed into the declared bands — not the touch-target floor (refuted: re-badges WCAG/axe, and is the a11y layer leaking into a UX measurement). Gated on quantified spacing bands in `we:density.json` → **#1804**.
6. **a11y-level is not an axis here** — a WCAG conformance tier is a platform-config value emitted on the #1689 conformance channel, measured absolutely by axe; the declared-relative overclaim is the conformance-lane follow-up **#1805** (maturityGated until a consumer emits a tier).

**Successors:** #1698 re-pointed `blockedBy: ["1791"]→["1804"]` (motion-reality pullable now via a split). Follow-ups filed: **#1804** (density spacing bands, blocks the density slice), **#1805** (a11y-overclaim, maturityGated), **#1806** (motion vocab reconciliation, priority:low).

## Follow-ups (filed)

- **a11y-overclaim check (conformance lane, not this oracle).** When an app emits a #1689 conformance tier, add a `declared-a11y-overclaim` finding — compare absolute axe results against the declared tier, flag over-claims, never suppress. Trigger: first consumer emitting a tier. Charter note: a suppression-capable a11y level is rejected outright (it would let any app silence the explorer by declaring `level: A`).
- **density.json quantified spacing bands.** Extend [we:src/_data/intents/density.json](../src/_data/intents/density.json) with measurable gap ranges per level — blocks the density-reality slice of #1698.
- **motion vocabulary reconciliation.** Standard [we:src/_data/intents/motion.json:1-17](../src/_data/intents/motion.json#L1) is `natural | immediate | reduced`; runtime [plateau:src/design-system-creator/manifest.ts:27-31](../../plateau-app/src/design-system-creator/manifest.ts#L27) / `IntentProfile` use `full | reduced | none`. Both share `reduced`, so motion-reality is unblocked, but reconcile the vocab.
