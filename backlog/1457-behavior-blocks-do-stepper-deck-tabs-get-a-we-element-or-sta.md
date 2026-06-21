---
kind: decision
parent: "1442"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
preparedDate: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-21-behavior-block-element-vs-attribute.md
tags: [packaging, custom-elements, block-model, conversion, behaviors, decision, frontierui]
---

# Behavior blocks: do stepper/deck/tabs get a we- element, or stay CustomAttribute behaviors?

**Ruling (ratified 2026-06-21): support-both — the styled `we-` element/block IS the component (is-a),
the `CustomAttribute` behavior is the retained headless capability (can-do).** Codified in
`we:docs/agent/block-standard.md` Packaging governance §7 (element-over-behavior, coordinator blocks). A
**consumer refinement** of the ratified block-packaging decisions ([#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/)
end-state · [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/)
mechanism families), grounded in the prior packaging surveys + the multi-child-coordinator survey
[behavior-block-element-vs-attribute](/research/behavior-block-element-vs-attribute/) (`we:reports/2026-06-21-behavior-block-element-vs-attribute.md`).
**The prep's original `(a)` default — "no `we-` element, stay coordinator behavior" — is overturned in
discussion** (see *Why the prep's fork was wrong*). **FUI impl call** (`locus: frontierui`): the
navigation/sequence *contracts* are WE's, the *packaging* is FUI's (#1321). De-buried from #1442's body.

## The fork dissolves — this is support-both, not either/or

stepper/deck/tabs coordinate a set of authored native semantic children and today register **no custom
element** (verified 2026-06-21): `fui:blocks/stepper/StepperBehavior.ts:22` (class over a `host`, reads
`[data-step]`), `fui:blocks/deck/DeckBehavior.ts:25-26` (*"Behavior-only … no custom element … no
observed-attribute surface to drift against the CEM (#840)"*), `fui:blocks/tabs/TabGroupBehavior.ts:21`
(a `CustomAttribute` on `<div tab-group>`). The prep framed this as "element **xor** behavior." It isn't —
the two **compose** (the composability probe: a `we-` element can *host the same coordination kernel* a
behavior runs). So both ship, with a clean division of roles set by the **"can do" vs "is a"** test:

- **The element/block IS the styled FUI component (`is-a`, primary).** `<we-stepper>` / `<we-deck>` /
  `<we-tabs>` — a **persistent light-DOM element** (B-family, like `fui:blocks/wizard/WizardElement.ts:25`;
  consistent with the #1456 grouped-control ruling) that hosts the coordination kernel, carries FUI's
  styling/theming, and exposes a **CEM** surface. The CEM is the generation target the polyglot
  framework-flavor generator (#463/#855) reads — **no element ⇒ no CEM ⇒ no Angular/React/Vue flavor and no
  turnkey *styled* component.** This is what FUI actually ships as a design-system product. Children stay
  light-DOM (NOT shadowed), so the native semantic markup is preserved, not hidden; in-leak isolation via
  the #1349 `webisolation` contract, optional shadow (C) only where a block opts into S2 hostile-CSS.
- **The behavior IS the headless "can behave as" capability (`can-do`, the floor).** The existing
  `CustomAttribute` / host-driven behavior stays — attach the coordination to your own native markup,
  author owns the DOM and styling. This is the #1381 "behaviors riding native elements" end-state, kept as
  the capability beneath the element, not the product itself.

One kernel, two facades. Per-block build sequencing (which element ships first) is **prioritization**
(#1442 burndown), never a branch.

## Why the prep's fork was wrong (the three failures, for the record)

1. **Category error (the deciding one).** A behavior is a *"can do that"*; an element/block is an *"is a."*
   The prep classified stepper/deck/tabs as *coordinators* (a can-do framing) and stopped there — but a
   styled, packaged, framework-flavorable FUI stepper **is a thing**, which is an element. "A behavior can
   technically apply style classes" is true and irrelevant: doing so conflates the two categories.
2. **Composability not tested.** "The two packaging shapes cannot both be its end-state" was *asserted*; it
   fails the probe — the element hosts the behavior kernel, so they coexist (support-both).
3. **Effort-as-merit + a false "no consumer."** `(b)`'s rejection rested on "reintroduces the CEM-drift
   surface `(a)` avoids" (a **maintenance cost**, not a merit downside — strip it) and "no consumer need"
   (false: the #463/#855 generator *and* FUI's own styled-component product are the consumers). The
   "hides/no-ops the children" claim attacked **shadow (C)**, not the light-DOM **(B)** actually proposed.

On ratify: stepper/deck/tabs each gain a persistent light-DOM `we-` element/block (the styled component +
CEM surface) over the retained coordination behavior; record this **element-over-behavior** packaging in
the #1442 mechanism guideline (`we:docs/agent/block-standard.md` Packaging governance §7); file the
per-block element builds as separately-prioritized #1442 slices. Confidence **~90%**.

---

## Context

- Sibling decisions under #1442: [#1456](/backlog/1456-grouped-form-control-packaging-mechanism-transient-a-vs-pers/)
  (grouped form-control A-vs-B) is the *single-control-group* counterpart; this item is the
  *coordinator-over-children* counterpart. The single-control conversions (#1453 button, #1454 badge,
  #1455 card) are straight transient/A applications and are not forks.
- Reference patterns in the FUI tree: A `fui:blocks/transient/TransientElement.ts:28`,
  B `fui:blocks/wizard/WizardElement.ts:25`, C `fui:blocks/story-canvas/StoryCanvasElement.ts:49` — the
  styled `we-` element facade uses the **B** (persistent light-DOM) pattern.
- The prior-art survey (`relatedReport`) recommended `(a)`; its facts stand but its recommendation is
  **superseded** by this ruling (the can-do/is-a category error it missed).
