# Behavior blocks (stepper / deck / tabs) — we- element vs CustomAttribute behavior (prep for #1457)

**Date:** 2026-06-21 · **Decision item:** [#1457](/backlog/1457-behavior-blocks-do-stepper-deck-tabs-get-a-we-element-or-sta/)
· **Parent epic:** [#1442] (block-model conversion) · **Sibling ruling:** [#1381]
(button packaging — picked the runtime-shape mechanism) · **End-state ruling:** [#1321]
(every block becomes a custom element) · **CEM gate:** [#840]

This is a **consumer refinement** of the already-ratified, heavily-surveyed block-packaging decisions, so
it sits on already-researched ground: the packaging-mechanism families (A transient / B persistent / C
shadow) were surveyed for [#1381] (`we:reports/2026-06-21-1381-button-packaging-mechanism.md`,
`/research/button-packaging-runtime-shape/`) and the end-state ruled by [#1321]. This report adds the one
genuinely-new angle those priors did not cover: a **multi-child coordinator** block (tabs+panels, steps,
slides) whose authored form is *already* a set of native semantic children — does it get a `we-` element,
or stay a behavior over the native container?

## What ships today (concrete refs, verified 2026-06-21)

All three are **coordinator behaviors driven over a native host**, registering **no custom element**:

- `fui:blocks/stepper/StepperBehavior.ts:22` — a `class StepperBehavior` constructed over a `host:
  HTMLElement`, reading `[data-step]` / `[data-step-indicator]` light-DOM children; owns linear
  progression + `aria-current="step"` + "Step N of M". Driven directly (no element registered).
- `fui:blocks/deck/DeckBehavior.ts:25-26` — states it verbatim: *"Behavior-only (mirrors
  `fui:blocks/stepper/StepperBehavior.ts`): **no custom element is registered, the host is driven directly, so
  there is no observed-attribute surface to drift against the CEM (#840).**"* Coordinates `[data-slide]`
  children, owns live-region "Slide N of M", focus, `inert`/`hidden`/`aria-hidden`, reduced-motion gating.
- `fui:blocks/tabs/TabGroupBehavior.ts:21` — a **`CustomAttribute`** (`<div tab-group>`), discovering
  `[tab-trigger]` / `[tab-panel]` children, wiring ARIA + keyboard, delegating visibility to `ViewEngine`.

The common shape: each **enhances a native semantic container** of authored native children. The
coordination is *over* the native structure, not a replacement of it.

## Prior art — the platform enhances native containers; the wrapping element is the reflow exception

- **ARIA APG (Tabs pattern)** puts `role="tablist"` / `role="tab"` / `role="tabpanel"` **on existing native
  elements** (a `<div>` tablist, `<button>` tabs, `<section>` panels) — there is no bespoke tabs element;
  the pattern is an *enhancement of native containers*. This is exactly the `tab-group`-attribute shape.
- **Open UI** distinguishes two goals (openui issue #559): **application tabs** (switch panes — APG tabs)
  vs **panelset** (formerly "spicy sections" — the `<panelset>` wrapping element whose *raison d'être* is
  to **reflow** between tabs and a linear/accordion presentation responsively). The wrapping element exists
  for the reflow capability; a non-reflowing tab group does not need one.
- **Exclusive accordions** shipped as `<details name>` (MDN, baseline 2024) — native elements + an
  attribute, **not** a new generic custom element. The platform's native-first move for one-at-a-time
  content is "attribute on native," not "wrap in a custom tag."

So the prior art splits cleanly: **enhance-native-container** (APG tabs, `<details name>`) is the
native-first default for these coordinators; the **wrapping element** (`<panelset>`) is the *reflow*
exception, a distinct capability WE can expose per-block later if a block needs it — not a reason to wrap
all three now.

## The #1321 "every block is a custom element" tension (the red-team)

[#1321] ruled the end-state is "every block becomes a custom element," and [#1442] is "register the
remaining blocks." Read literally that mandates a `we-` element for stepper/deck/tabs too. But [#1381]
resolved the *mechanism* such that even an element-authored block (mechanism A, transient) **erases the
element**, ending as native + `CustomAttribute` behaviors — and [#1381] explicitly names "behaviors riding
native elements" as a legitimate end-state shape.

The reconciliation: #1321's "every block is a custom element" is about the **single-control authoring
affordance** — `<we-button>` is authoring sugar the mechanism then lowers. A multi-child **coordinator**
is categorically different: its children *must* be authored as native semantic elements (`<nav>`,
`<section>`, `<button>`, `[data-step]`), and the coordination is inherently an *enhancement of* that native
structure. A `<we-tabs>` wrapper would either hide those semantic children (an a11y/semantics regression)
or be a no-op wrapper around them (pointless, and it reintroduces the observed-attribute → CEM drift
surface `DeckBehavior` deliberately avoids, #840). So the coordinator case is the principled exception the
#1381 end-state already implies — not a gap in the conversion program.

## Classification (per-fork pass)

- **Which layer?** FUI **impl/packaging** call (`locus: frontierui`); the navigation/sequence *contracts*
  are WE's (stepper realizes navigation `structure: linear`; deck realizes the #1179 advanceable-sequence
  + #1180 deck-document-model), the packaging shape is FUI's (#1321).
- **Fixed mechanic or dimension?** A per-block **classification**, not a user-facing dimension — it
  decides which packaging family each coordinator lands in, the same axis #1442's guideline already
  applies block-by-block.
- **Most-permissive default?** (a) staying an attribute behavior is the *least* restrictive on the author
  (they keep authoring native semantic containers); it does not foreclose a later per-block opt-in to B
  (persistent element) if one coordinator gains a framework-property-bound consumer (#463) — exactly the
  #1381 guideline's escape hatch.

## Recommendation

**(a) Behavior blocks stay `CustomAttribute` / host-driven behaviors — no `we-` element; mark them an
explicit *coordinator* classification in #1442's guideline (already-at-end-state, not "unconverted").**
Confidence ~85%. Grounded in native-first (APG/`<details name>` enhance native containers), #1381's
endorsed "behaviors riding native elements" end-state, and #840 (no element ⇒ no CEM drift surface). The
residual ~15%: a future Open-UI-`panelset`-style **reflow** need could motivate a wrapping element for one
specific block (most likely deck/presentation) — but that is a per-block opt-in to a distinct capability,
decided then, not a blanket wrap now.

[#1442]: /backlog/1442-block-model-conversion-register-remaining-blocks-as-custom-e/
[#1381]: /backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/
[#1321]: /backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/
[#840]: /backlog/840-cem-conformance-gate-run-the-analyzer-over-fui-source-and-fa/
