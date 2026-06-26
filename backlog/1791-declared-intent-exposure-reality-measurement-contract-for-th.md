---
kind: decision
parent: "1522"
status: open
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
locus: plateau-app
tags: [explorer, intent-conformance, declared-intent, dev-browser]
relatedReport: reports/2026-06-26-runtime-intent-conformance-measurement.md
preparedDate: "2026-06-26"
---

# Declared-intent exposure + reality-measurement contract for the explorer intent-conformance oracle

Gates #1698 (the explorer's intent-conformance oracle), which flags where a running page's render diverges from its declared density/motion/a11y-level. #1698's pre-flight found #1689 shipped a *DeclaredRule* registry (rule→vector linkage), not an intent exposure — so the exposure + reality-measurement contract was undecided. The prep survey ([Runtime intent-conformance measurement](/research/runtime-intent-conformance-measurement/) · [we:reports/2026-06-26-runtime-intent-conformance-measurement.md](../reports/2026-06-26-runtime-intent-conformance-measurement.md)) dissolved the exposure fork — a page **already** declares its profile via root `data-intent-*` attributes — and the skeptic pass flipped the density metric and reframed a11y-level. Two genuine forks remain; the rest is settled below.

## Axis framing

The decision splits along the page→oracle data-flow. **Exposure** (how a page declares its intents) is **not** a fork: the live contract already exists — `INTENT_PROFILE_ATTRS = { density: 'data-intent-density', mode: 'data-intent-mode', motion: 'data-intent-motion' }` ([plateau:src/dev-browser/intent-inspector/inspect.ts:11-24](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L11)), read by `readIntentProfile()` ([plateau:src/dev-browser/intent-inspector/inspect.ts:26-33](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L26)), emitted by the FUI workbench from `preset.intentDefaults` ([fui:workbench/mount.ts:330-333](../../frontierui/workbench/mount.ts#L330)). The vocabulary is owned by WE intents: [we:src/_data/intents/density.json:1-17](../src/_data/intents/density.json#L1) (comfortable 44px+ / compact 32px / wafer 24px) and [we:src/_data/intents/motion.json:1-17](../src/_data/intents/motion.json#L1) (natural / immediate / reduced). The item's three exposure candidates collapse: the #1689 `DeclaredRule` is the wrong layer (it links declared *rules* to test *vectors*, [plateau:src/dev-browser/declared-rules/types.ts:35-56](../../plateau-app/src/dev-browser/declared-rules/types.ts#L35) — it carries no density/motion profile), and a per-page manifest is a redundant parallel path. **Reality measurement** rides the existing oracle pipeline — `Oracle.check(obs: Observation): Finding[]` ([plateau:tools/explorer/oracles/observation.ts:88-92](../../plateau-app/tools/explorer/oracles/observation.ts#L88)) over an `Observation` ([plateau:tools/explorer/oracles/observation.ts:29-75](../../plateau-app/tools/explorer/oracles/observation.ts#L29)) populated by a single `PlaywrightObservationCollector` — and is where the two live forks sit: the a11y-level axis and the density metric. Constellation placement (the conformance verifier-vs-subject split, #1467): WE owns the vocabulary/bands contract; the plateau explorer owns the measurer — no new WE↔FUI edge.

### Recommended path at a glance

Ratify both rows, or override the one you'd change. The **confidence** column says where judgment is actually needed.

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **1 · a11y-level axis** | **delegate a11y to the absolute axe lane; a11y-level is NOT a net-new declared-divergence axis** (no consumer declares a level today) | additive `declared-a11y-overclaim` check over a minted `data-intent-a11y-level` | **Med** — honest-scope vs. keeping the 3rd axis real |
| **2 · density reality metric** | **spacing/whitespace ratio bucketed into the bands** (prerequisite: quantified spacing bands in `we:density.json`) | touch-target hit-size floor *(refuted — one-sided floor re-badges WCAG, misses the common divergence)* | **Med** — metric clear; the prerequisite is the live cost |

### Supported by default (settled — not forks)

- **Exposure = the existing `data-intent-*` root attributes.** Density/motion are already declared and read ([plateau:src/dev-browser/intent-inspector/inspect.ts:11-33](../../plateau-app/src/dev-browser/intent-inspector/inspect.ts#L11)). Reusing the live contract is forced — minting a parallel manifest has no second consumer, and `DeclaredRule` is the wrong layer. *Fork-existence: no correct alternative; both candidates are wrong-layer/redundant.*
- **Reality fields live on the existing `Observation`.** The declared profile + measured-reality fields are added as narrow optional fields on `Observation`, populated by the existing collector — the same pattern as its existing oracle-specific optionals (`clippedResidue?`, `scrollJump?`, `dragDragsPage?`, [plateau:tools/explorer/oracles/observation.ts:64-75](../../plateau-app/tools/explorer/oracles/observation.ts#L64)). A separate `IntentObservation` structure is excluded: #1698 explicitly rides the existing single collector + judge + finding pipeline, and field-count is not schema-coupling (#1662).
- **Motion reality = a second observe-time media-emulated render.** Measuring the declared-`reduced` claim requires re-rendering the state under `page.emulateMedia({ reducedMotion: 'reduce' })` and flagging still-active non-semantic animation (`Element.getAnimations()`). This is a **named first-class cost**: the collector cannot replay a settled state (#1525), so motion-reality is a distinct emulated observe at observe-time, not a post-hoc re-read. The only method (native View Transitions don't auto-respect reduced-motion — [we:conformance-vectors/slide-transition-reduced-motion.vectors.ts](../conformance-vectors/slide-transition-reduced-motion.vectors.ts)), so no fork.
- **a11y reality = the existing absolute axe lane.** `Observation.a11yViolations` (WCAG 2.0/2.1 A/AA) is already collected ([plateau:tools/explorer/oracles/observation.ts:39-46](../../plateau-app/tools/explorer/oracles/observation.ts#L39)); axe measures absolute conformance. (Whether a *declared* a11y level adds an axis is Fork 1.)

## Fork 1 — the a11y-level axis: absolute-delegate vs additive overclaim

*Fork-existence: genuinely cannot coexist as the contract — a11y is measured either as an **absolute** floor (axe fires identical findings regardless of any declaration) or as a **declared-relative** axis (a page declares a target tier and the oracle measures divergence from it). One contract; pick one stance.*

The trap the skeptic exposed: pure "delegate a11y to axe" makes the a11y *third* of an "intent-conformance" oracle a no-op rename — `a11yViolations` is already collected and already checked, contributing zero net-new findings. So the honest choice is binary: either **own that a11y is not a declared-divergence axis here** (scope it as the existing absolute lane), or **make it additive** (read a declared tier, flag *over-claims* — never suppress).

- **(a) Absolute-delegate — DEFAULT.** a11y reality = the existing absolute axe lane; the contract declares no `data-intent-a11y-level` and the oracle adds no a11y-specific finding beyond what axe already emits. The "a11y-level" axis is honestly scoped *out* of the net-new delta (density + motion are the two real divergence axes). Grounded: **no page declares an a11y target tier today** — minting `data-intent-a11y-level` speculatively violates verify-the-mechanism-has-a-consumer (grep consumers first; #1592); the absolute lane already catches every real defect; #1698's own body says the generic-a11y portion is delegated, "do not rebuild."
- **(b) Additive `declared-a11y-overclaim` check.** Mint a minimal `data-intent-a11y-level="AA"` declaration (a tier string mapping to axe WCAG tags, extending `INTENT_PROFILE_ATTRS`) and emit a `declared-a11y-overclaim` finding when axe reports a violation at-or-below the declared tier — i.e. the page *over-claims* its own conformance. Monotonic (only adds findings), charter-safe (never suppresses axe). Excluded as default only because nothing declares a level yet; **becomes the right move the moment a consumer declares an a11y target tier** — file as the follow-up then.

**Why not suppression.** The branch where a declared level *suppresses* sub-tier axe findings is rejected outright (not even an option): any app could silence the oracle by declaring `level: A`, inverting the explorer's "find ALL issues" charter. WCAG findings are real DOM defects; a page does not get to lower the floor by fiat — a11y is genuinely absolute where density/motion are genuinely declared-relative.

**Skeptic:** SURVIVES-WITH-REFRAME — the attack ("pure delegate = a no-op axis") is what *created* this fork: it forces the honest pick (scope a11y out as absolute, or make it additive-overclaim), and kills the suppression branch. Default (a) holds on no-consumer + unblock-now; (b) is the named trigger-gated follow-up.

## Fork 2 — density reality metric: spacing/whitespace ratio vs touch-target floor

*Fork-existence: a compact page can have large buttons but tight gaps (or the reverse), so touch-target size and spacing density **disagree** on the divergence verdict — the oracle must pick ONE authoritative signal; they cannot both be "the" metric without conflicting findings.*

- **(a) Spacing/whitespace ratio — DEFAULT (skeptic-flipped).** Measure a spacing signal — median inter-element gap / content-to-whitespace ratio of a representative container — bucket it into the three declared bands, and flag divergence from the declared band. This is the dimension the bands' prose actually distinguishes on (comfortable "whitespace for grouping" vs compact "border-based grouping / high information density", [we:src/_data/intents/density.json:13](../src/_data/intents/density.json#L13)) and the one a human reads as "density."
- **(b) Touch-target hit-size floor — REFUTED.** Measure interactive-element `getBoundingClientRect` against the declared floor (compact ⇒ ≥32px). Rejected: the floor is **one-sided** (bigger-than-floor always passes, so a comfortable page passes a `compact` floor), so the only thing it can catch is a control *below* floor — which is just a WCAG 2.5.8 target-size violation re-badged, double-counting the axe lane Fork 1 routes a11y to. It also misses the common real divergence (declared `compact`, comfortable whitespace) and leaves the "interactive element" population undefined.

**Prerequisite (the live cost of the default).** [we:src/_data/intents/density.json:1-17](../src/_data/intents/density.json#L1) ships *quantified* bands only for touch targets (44/32/24px); spacing/info-density are **prose**, with no measurable gap ranges. So the spacing-ratio metric cannot divergence-check until `we:density.json` gains quantified spacing bands per level. The ruling must either (i) extend `we:density.json` with quantified spacing bands first (file as a blocking child of #1698), or (ii) ship density-reality after that vocabulary lands — motion-reality (settled above) can ship now regardless. Target-size is kept only as a **secondary** WCAG signal routed to the axe lane, never the density-divergence verdict.

**Skeptic:** REFUTED the original touch-target default and surfaced the spacing-band prerequisite. Default flipped to the spacing/whitespace ratio; the `we:density.json` quantified-spacing-bands gap is now named as a prerequisite, not discovered mid-build.

## Residual (not a fork)

The standard [we:src/_data/intents/motion.json:1-17](../src/_data/intents/motion.json#L1) vocabulary is `natural | immediate | reduced`; the runtime [plateau:src/design-system-creator/manifest.ts:27-31](../../plateau-app/src/design-system-creator/manifest.ts#L27) / `IntentProfile` examples use `full | reduced | none`. Both share `reduced`, so the motion-reality oracle is unblocked, but the divergence is real — flag for a separate vocabulary-reconciliation cleanup, out of scope for this contract.
