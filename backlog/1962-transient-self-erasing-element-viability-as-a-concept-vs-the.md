---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
tags: [webcomponents, transient-element, block-standard, standards-position, native-semantics, decision]
---

# Transient (self-erasing) element — viability as a concept vs the standards-endorsed alternatives

The transient / A-family pattern ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts))
has an **autonomous custom element erase itself** on upgrade — it builds a native element, moves its content
onto it, then `this.replaceWith(native)` and vanishes. This card reconsiders that pattern **at the concept
level** — not "what API does it expose" (#1961) or "how do consumers wire it" (#1960), but **is a self-erasing
element the right idea at all, given what the standards bodies actually endorse?**

## Why this is on the table now

The #1961 prep survey ([report](../reports/2026-06-29-transient-element-exposed-api.md)) surfaced two
uncomfortable facts the mitigation cards route around:

1. **Nobody else self-erases at runtime.** HTML web components (Keith), Lit, Shoelace, Web Awesome all keep
   the host **persistent** as the API surface; compile-away frameworks unwrap at *build* time. The entire
   stale-ref / lost-listener / attribute-rename problem set that #1960 and #1961 exist to paper over **exists
   only because the host erases itself.**
2. **Self-replacement is not a spec-sanctioned pattern** — the HTML spec warns authors against manipulating the
   node tree inside custom-element reactions, and `connectedCallback` can fire >1× / with `isConnected===false`.
   The pattern is a tolerated workaround, not a blessed mechanism.

The transient pattern is, in effect, a **workaround for customized built-ins (`is="button"`) being
unavailable** — and that unavailability is owed to a deliberate standards position, which is the crux the user
asked to engage.

## The WebKit argument ([standards-positions #97](https://github.com/WebKit/standards-positions/issues/97))

> *Verbatim thread quoting deferred to `/prepare` — WebFetch sees only the issue metadata, not the comment
> thread; a prepare pass must fetch rniwa's full reasoning before ratification.*

What is verified from the position itself: **WebKit's position is `oppose`**, and the issue states *"WebKit
supports autonomous custom elements, but hasn't implemented this aspect of custom elements"* (customized
built-ins). The well-established rniwa/Apple reasoning behind that `oppose`:

- **Subclassing built-in elements is the wrong primitive.** Native elements carry complex, partly-hidden
  internal state and behaviour; letting author classes subclass them couples author code to that internals and
  **constrains the platform's freedom to evolve those elements**. Apple frames this as a long-term
  platform-health cost.
- **The constructive half — prefer autonomous custom elements + composition.** WebKit's endorsed direction is
  autonomous elements that obtain native-grade semantics through the platform's *newer* primitives —
  **`ElementInternals` / form-associated custom elements, ARIA/AOM reflection** — and by composing/wrapping a
  real native control, **not** by becoming one via `is=`.

**Why that bears on self-erasure, not just on `is=`:** the WE transient element is a *third* thing — neither a
customized built-in (`is=`) nor a persistent autonomous element. Its whole reason to exist is "leave a **real**
native element in the final DOM." But WebKit's constructive recommendation (a **persistent** autonomous element
that gets native semantics via `ElementInternals`/ARIA) is precisely the alternative the survey found everyone
else already uses — so #97 is not merely "why the escape hatch is dead," it is an articulated argument that the
goal self-erasure chases (real native semantics) is better reached by **keeping the element**, not deleting it.

## The genuine counter-weight (don't strawman the status quo)

Self-erasure was chosen for real reasons, and `ElementInternals` does **not** fully replace them:

- A transient element leaves a **true native element** in the DOM (a real `<button>`: native focus, activation,
  form participation, AT semantics — all *free*). An autonomous host + `ElementInternals` gets form-association
  and some ARIA, but you **re-implement** click/keyboard/focus/activation behaviour by hand.
- **Zero wrapper** — no extra node to fight in CSS/layout (the exact problem Astro is removing from
  `<astro-island>`).
- **Progressive enhancement / SSR** — the authored markup degrades to plain native HTML with no JS.

So this is a real either/or, not a slam-dunk: *true-native-element-but-self-erases* vs
*persistent-host-but-only-near-native*.

## Composition cost — a real platform weakness (worked example)

A second pro-transient argument the persistent-host case has to answer: **the web platform's unit of
composition is the DOM node**, so deep composition has an inherent node-cost that a virtual-DOM library does
not. Take the user's case — a simple light-DOM button wrapped in **10 HOC-like layers**.

**React** composes at the *component* layer; the rendered DOM stays flat — HOCs add **zero** nodes unless they
choose to:

```jsx
// 10 HOCs fold into one component; the DOM is just <button>
const Button10 = withA(withB(withC(/* …7 more… */ BaseButton)));
// <Button10/>  →  <button>Go</button>      // 10 layers, 1 node
```

**Web components, composed structurally (nesting)** — the naive translation makes every layer a real node:

```html
<!-- DOM-layer composition: every wrapper IS a node -->
<with-a><with-b><with-c><!-- …7 more… --><we-button>Go</we-button></with-c></with-b></with-a>
<!-- → 10 wrapper elements per button in the DOM + AX tree; CSS/layout/slotting all cross all 10,
     each shadow boundary nests slots (slot-in-slot) and breaks ::part chains. This is the "heavy". -->
```

**The honest rebuttal: most of that 10-deep composition is *behavioural*, and behaviour composes flat without
transient.** The web-native analog of an HOC is a **functional class mixin** — N behaviours fold into **one**
element class, leaving **one** DOM node:

```ts
// Behaviour-layer composition: 10 mixins → ONE element class → ONE node (the established pattern —
// Fagnani "Real Mixins with JS Classes" / lit dedupeMixin; FUI's attribute-driven cousin is the
// `*Behavior` concept, e.g. fui:blocks/stepper/StepperBehavior.ts)
const Button = WithA(WithB(WithC(/* …7 more… */ HTMLElement)));
customElements.define('we-button', class extends Button {});
// <we-button>Go</we-button>   // 10 behaviours, 1 light-DOM node, zero wrappers, no transient needed
```

So the cost is **not** uniform across the 10 layers — it splits:

- **Behavioural layers** (state, events, a11y wiring, validation, toggling): compose into one class via
  mixins/decorators/attribute-behaviours → **flat DOM, good ergonomics, no transient, no persistent-host
  penalty.** This is the bulk of real "HOC" composition and the platform answers it fine.
- **Structural layers** (a layout wrapper, a provider boundary, an independently-slotted/styled shell): each
  genuinely *needs* its own node → here the platform charges per layer. `display: contents` is the only relief
  (drops the wrapper's *box* but keeps the node in the DOM/AX tree, with lingering a11y caveats), and there is
  **no** platform equivalent to React's zero-DOM context-provider / render-prop. **This is the real weakness.**

**Why this bears on the decision:** transient self-erasure is partly a *workaround for the structural-layer
node-cost* — it lets you author wrapper/structured markup that **collapses to flat native DOM**. That refines
the positions:

- It **does not** rescue self-erasure for *behavioural* depth — mixins already give flat DOM there (weakens A
  as a general justification).
- It **does** strengthen the case where authored *structure* must collapse to a true native element — and it
  is a real cost on **position B**: a persistent host under deep *structural* composition reintroduces exactly
  the wrapper-node bloat above (unless every consumer reaches for `display:contents`).
- It sharpens **position D**: keep transient where *structure must flatten onto a native element*; use
  persistent hosts + mixins where the composition is *behavioural* (flat already).

`/prepare` should ground this: survey the mixin/decorator/behaviour ergonomics actually in the FUI tree, and
test the 10-deep case under each of A/B/D to see where node-count and slotting actually bite.

## Candidate positions (un-prepared — `/prepare` to shape defaults + skeptic)

- **A — keep transient self-erasure (status quo).** Accept the #1960/#1961 mitigations as the cost of a real
  native element in the DOM.
- **B — persistent autonomous host (dominant prior art + WebKit's constructive rec).** Element stays as the
  stable read/event/listener surface; native semantics via `ElementInternals`/ARIA + an internal native
  control. Dissolves the stale-ref/rename problem set; costs a wrapper node and hand-wired native behaviour.
- **C — customized built-in `is="button"`.** The standards mechanism for the exact goal — **foreclosed by
  Safari** (#97 `oppose`); would need a polyfill. Recorded as dead, not viable.
- **D — scope by need (hybrid).** Keep transient self-erasure only where a *true* native element pays off
  (form controls, buttons), and use persistent hosts for purely-presentational blocks (badge/tag/card) that
  have **no** native-semantics payoff — which is exactly where #1961's grounding found *no* rename problem.
  This narrows self-erasure to the cases that justify its cost.

## Relationships

- **Reconsiders** the ratified transient pattern, [we:block-standard.md:243](../docs/agent/block-standard.md#L243)
  — a Tier-0 statute; a ruling here amends or reaffirms it.
- **Higher-altitude than #1960 / #1961**, which *mitigate* the current pattern. **No `blockedBy` edge** — those
  mitigations stand and ship regardless (the skeptic on #1961 validated keeping them unblocked). But if this
  card rules **B** (abandon self-erasure), it **supersedes** #1960/#1961; if **A** or **D-keep**, they remain
  the live contract.
- Not yet prepared: needs a `/prepare` pass to fetch the verbatim #97 reasoning, survey `ElementInternals`
  coverage vs the native-semantics gap, classify A–D into forks with bold defaults, and run the skeptic.
