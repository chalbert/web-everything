---
name: composition-dx-adoption-gap
description: Framework-parity composition DX is adoption-critical for WE; the strict per-case rubric is decision
metadata: 
  node_type: memory
  type: project
  originSessionId: 1ccceaaf-33d9-48df-88a4-c5f9066c0ff9
---

Composition **DX vs frameworks** is an adoption-critical bar for WE, not a nice-to-have: a native-first system
that can't match React/Vue/Svelte/Solid composition ergonomics never wins first-level developer adoption.

**Why (non-obvious framing):** the web platform's unit of composition is the **DOM node**, so structural
composition has an inherent node-cost that virtual-DOM libs avoid — and an added DOM level doesn't just *cost*
a node, it can **break** flex/grid layout (direct-child only), structural CSS selectors, HTML content-model
validity (table/list foster-parenting), and the AX tree. So "just nest custom elements" is not framework-parity.

**State of the work (2026-06-29):** WE already *ships the mechanisms* — block-standard.md §7 families A/B/C
(#1381/#1456/#1457), comment-based virtual elements (CustomComment #1130 → ForEach/ViewIf/ViewSwitch),
`display:contents` DI provider (#1044), JSX fragments + functional components, CustomAttribute behaviors, `is=`.
What was MISSING is the strict per-case rubric at the raised bar — now decision **#1963** (composition rubric
re-judged to framework-parity).

**The acceptance bar (#1963):** (1) ergonomics ≥ frameworks, (2) zero compromise on layout/CSS/a11y, (3) a
solution for *every* case, (4) open to net-new mechanisms (a plug, per [[95. Plug = Proposed Missing Standard]])
where nothing clears the bar, (5) authoring-surface-agnostic (HTML + JSX + others).

**Headline gap (sharpened by #1963's prep, 2026-06-29):** parity is **authoring-surface-scoped**. The host node
is the API surface (slot/shadow/AX/lifecycle keyed off it), so no standard makes a registered custom element
cost zero nodes. On **JS/JSX**, zero-node parity *is* reachable today (functional components / directives /
mixins — "budget the host node"). On the **declarative-HTML** surface, deep *structural* nesting reaches only
*cheap-node* (`display:contents` per layer, box gone but node/event/AX/content-model remain) — a **genuine open
gap**, candidate fix = generalize the transient-to-comments bridge; watch DOM Parts. Also unmet: **behaviour on a
*foreign* native element** (case 8) — `is=` dead in Safari, `ElementInternals` gives role/form not behaviour and
only for your *own* element. Behavioural composition is fully solved (mixins).

**How to apply:** treat composition-mechanism choices as gated by #1963's bar; transient self-erasure (#1962)
is case 1's facet, judged under that bar — it is NOT the platform's "compose without a node" answer (that's
mixins); transient is a 1:1 native-lowering technique. Don't settle for a compromised mechanism — flag the gap
as an invent/build item.
