---
kind: decision
parent: "1442"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
preparedDate: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-21-behavior-block-element-vs-attribute.md
tags: [packaging, custom-elements, block-model, conversion, behaviors, decision, frontierui]
---

# Behavior blocks: do stepper/deck/tabs get a we- element, or stay CustomAttribute behaviors?

**Prepared 2026-06-21 — ready to ratify.** A **consumer refinement** of the ratified block-packaging
decisions ([#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/)
end-state · [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/)
mechanism families), so the grounding is the prior packaging surveys plus a focused new survey of the
**multi-child-coordinator** angle, published as
[behavior-block-element-vs-attribute](/research/behavior-block-element-vs-attribute/) (session report
`we:reports/2026-06-21-behavior-block-element-vs-attribute.md`). The one open fork carries a **bold**
recommended default. **FUI impl call** (`locus: frontierui`): the navigation/sequence *contracts* are
WE's, the *packaging* is FUI's (#1321). De-buried from #1442's body.

## The axis — a single-control authoring sugar vs a coordinator over native semantic children

stepper/deck/tabs are not single controls — each **coordinates a set of authored native semantic
children** and today registers **no custom element** (verified 2026-06-21):
`fui:blocks/stepper/StepperBehavior.ts:22` (a class over a `host`, reads `[data-step]`),
`fui:blocks/deck/DeckBehavior.ts:25-26` (states verbatim *"Behavior-only … no custom element is
registered … no observed-attribute surface to drift against the CEM (#840)"*),
`fui:blocks/tabs/TabGroupBehavior.ts:21` (a `CustomAttribute` on `<div tab-group>` discovering
`[tab-trigger]`/`[tab-panel]`). The conversion question turns on one axis: is a `we-` element the
native-first authoring form for these, or is the **attribute-on-native** shape they already have the
native-first form? Prior art answers it — ARIA APG Tabs puts `role=tablist` **on existing native
elements**, exclusive accordions shipped as `<details name>` (native + attribute, no new tag), and Open
UI's only *wrapping* element (`<panelset>`) exists specifically for **responsive reflow** (openui #559),
not for plain coordination.

**Classification (per-fork pass).** Layer → FUI **impl/packaging** (the sequence/navigation contracts are
WE's). Fixed mechanic or dimension → a per-block **classification** (which packaging family), not a
user-facing dimension. Most-permissive default → (a) attribute-behavior keeps the author writing native
semantic containers and does **not** foreclose a later per-block opt-in to **B** (persistent element) for
a framework-property-bound consumer (#463) — the #1381 guideline's existing escape hatch.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — packaging of the coordinator behavior blocks | **(a) Stay `CustomAttribute` / host-driven — no `we-` element; mark an explicit "coordinator" classification in #1442's guideline (already-at-end-state)** | (b) Give each a persistent light-DOM `we-` element (B-family) wrapping the native children | Med-high (~85%) |

## Fork 1 — coordinator blocks stay attribute behaviors (a) vs gain a we- element (b)

*Fork-existence (genuine either/or):* a block is **either** a registered `we-` custom element **or** a
pure attribute/host-driven behavior — the two packaging shapes cannot both be its end-state. Both branches
are coherent (a `<we-tabs>` persistent element is buildable, like `fui:blocks/wizard/WizardElement.ts:25`),
so this is a merit call decided on native-first, not a forced invariant.

**Crux:** is a `we-` element the native-first authoring form for a multi-child coordinator, or is it a
wrapper that hides / no-ops the native semantic children the coordinator must enhance? Per the survey it is
the latter; per #1381 the "behaviors riding native elements" shape is already a ratified end-state.

- **(a) Stay `CustomAttribute` / host-driven behaviors — no `we-` element.** Mark stepper/deck/tabs an
  explicit **coordinator** classification under #1442's mechanism guideline: *already at end-state*, not
  "unconverted." Authors keep writing native semantic containers (`<nav tab-list>`, `<section data-slide>`,
  `[data-step]`); no element ⇒ no observed-attribute → CEM-drift surface (#840, the property `DeckBehavior`
  deliberately preserves). *Tradeoff:* the #1442 catalog is no longer "100% custom elements" — these three
  are recorded as the principled coordinator exception (see red-team).
- **(b) Give each a persistent light-DOM `we-` element (B-family).** A `<we-tabs>` / `<we-deck>` /
  `<we-stepper>` owning the coordination, mirroring `fui:blocks/wizard/WizardElement.ts:25`. *Tradeoff:* the
  wrapper either hides the authored native semantic children (an a11y/semantics regression) or is a no-op
  around them (no benefit), and it reintroduces the CEM-drift surface (a) avoids. *Rejected as default* —
  it inverts native-first for these blocks with no consumer need that (a)+the #463 opt-in does not already
  cover.

**Recommended default: (a)** — med-high confidence (~85%). *Red-team:* the attack is "#1321 mandates every
block become a custom element — (a) leaves three unconverted." The rebuttal: #1321's mandate is the
**single-control authoring affordance** (`<we-button>` is sugar the mechanism lowers — and mechanism A
*erases* even that element, ending native+attribute); a multi-child coordinator's children **must** be
authored as native semantic elements, so the attribute-on-native shape **is** these blocks' native-first
authoring form, and #1381 already names "behaviors riding native elements" a legitimate end-state. (a) is
therefore *converged*, not unconverted — the conversion guideline should record a fourth, coordinator
classification rather than force a wrapper. The residual ~15%: a future Open-UI-`panelset`-style **reflow**
need could motivate a wrapping element for one specific block (most likely deck/presentation) — a per-block
opt-in to a distinct capability, decided then, not a blanket wrap now.

On ratify: record the **coordinator** classification in the #1442 mechanism guideline
(`we:docs/agent/block-standard.md` Packaging governance §7) covering stepper/deck/tabs; settles their
#1442 disposition with no element-conversion work.

---

## Context

- Sibling decisions under #1442: [#1456](/backlog/1456-grouped-form-control-packaging-mechanism-transient-a-vs-pers/)
  (grouped form-control A-vs-B) is the *single-control-group* counterpart; this item is the
  *coordinator-over-children* counterpart. The single-control conversions (#1453 button, #1454 badge,
  #1455 card) are straight transient/A applications and are not forks.
- Reference patterns in the FUI tree: A `fui:blocks/transient/TransientElement.ts:28`,
  B `fui:blocks/wizard/WizardElement.ts:25`, C `fui:blocks/story-canvas/StoryCanvasElement.ts:49` — (b)
  would use the B pattern.
