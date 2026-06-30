# Transient (self-erasing) element — concept-level viability vs the standards-endorsed alternatives

**Decision:** [#1962](../backlog/1962-transient-self-erasing-element-viability-as-a-concept-vs-the.md) · prep survey · 2026-06-29

This survey grounds the **concept-level** re-judgment of the transient / A-family pattern
([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)) — an
autonomous custom element that builds a native element, moves its content onto it, then `this.replaceWith(native)`
and vanishes. Unlike [#1961](../backlog/1961-transient-element-exposed-api-the-stable-read-event-surface-.md)
(*what API does it expose*) and #1960 (*how do consumers wire it*), this asks: **is a self-erasing element the
right idea at all, given what the standards bodies actually endorse?** It is **case 1's facet** of the
framework-parity umbrella [#1963](../backlog/1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md)
— the worked mechanism-choice that feeds the rubric.

The headline result: the concept-level challenge, grounded, **reaffirms the existing §7 cut** rather than
overturning it — because the WebKit position it leans on targets a *different* mechanism (`is=`), and the
"nobody self-erases" survey finding is a **robustness rider**, not a fatal objection. The one branch the survey
**refutes** is the item's own position D (scope transient by *native-semantics payoff*) — the wrong
discriminator.

## 1. The WebKit #97 argument — fetched verbatim, and what it actually condemns

WebKit's standards-position on **customized built-in elements** ([standards-positions #97](https://github.com/WebKit/standards-positions/issues/97),
state: **closed / `oppose`**; assignees `rniwa`, `annevk`) is the crux the item asked to engage. The position's
own reasoning (annevk, opening comment, 2022-11-28), verbatim points:

1. *"Thanks to form-associated custom elements, the main use case for customized built-in elements [enhancing
   form controls] has a better solution that gives developers a lot more flexibility."*
2. *"Thanks to `ElementInternals` and `ARIAMixin`, autonomous custom elements have pretty good accessibility
   support that we plan to expand even further."*
3. *"Customized built-in elements cannot have access to shadow trees … or `ElementInternals` by design, making
   them a kind of second-class custom element."*
4. *"Customized built-in elements also cannot realistically have good accessibility support built-in as they are
   logically different from the element they extend"* — so AX customization is *only* possible through the public
   ARIA API, since `ElementInternals` is unavailable.
5. *"For much the same reason we think the progressive enhancement use case falls short … Using child elements is
   the established way in HTML to provide fallback contents. E.g., this is how `canvas` and `picture` approach
   it."*
6. *"The syntax used [`is=`] prioritizes implementers over web developers which is wrong per the [Priority of
   Constituencies]."*
7. The one *"compelling use case"* they retain is the **HTML parser** case (`<td is>`, `<template is>`), to be
   solved differently ([whatwg/html#8114](https://github.com/whatwg/html/issues/8114)).

The community counter-thread (WebReflection, the polyfill author) argues `is=` gives the **best a11y for free**,
no-FOUC single-stylesheet styling, works without JS, and is the de-facto graceful-enhancement primitive;
romainmenke counters that with async/deferred JS the elements *"will always exist partly as un-upgraded
elements … behave as native elements before being customized,"* which *"will lead to unexpected document
states."* steveblue notes the **fragmentation tax**: Chrome/FF/Edge ship it, so WebKit's refusal forces a
polyfill.

**The load-bearing observation for #1962:** every WebKit objection is about *customizing an existing native
element **in place*** via subclassing (`<input is=my-input>`). The transient element is a **third thing** — it
neither subclasses a native element nor persists as an autonomous host; it **emits** a real native element and
deletes itself. So:

- WebKit's *constructive* recommendation — a **persistent** autonomous element granted near-native semantics via
  `ElementInternals` / `ARIAMixin` — is an argument for the **persistent-B** family, and it addresses the case
  where you need *owned, author-defined* semantics on an element you *keep*. It does **not** deliver a *true
  native element* (a real `<button>` with free focus/activation/form/AT), which is the only thing transient
  exists to produce.
- Therefore #97 is **consistent with the existing §7 cut**, not a refutation of it: it recommends persistent-host
  exactly where §7 already routes to family B (reactive / owned-semantics), and is silent on emit-a-true-native
  (the family-A case it never contemplated).
- The objection that *does* reach transient is romainmenke's **un-upgraded-first / unsanctioned-timing** concern
  — which is a robustness property, not a reason to abandon the pattern (§4).

## 2. ElementInternals coverage vs the native-semantics gap (local grounding)

`ElementInternals` is the platform primitive WebKit offers in place of `is=`. Surveying the FUI tree, it is used
in exactly **two** places, and what it grants is narrow:

- [fui:blocks/droplist/AutoComplete.ts:52](../../frontierui/blocks/droplist/AutoComplete.ts#L52)
  (`static formAssociated = true`), `:92-98` (`attachInternals()`), `:386,400` (`setFormValue`) — **form
  participation** only.
- [fui:blocks/renderers/component/declarativeComponent.ts:191-233](../../frontierui/blocks/renderers/component/declarativeComponent.ts#L191-L233)
  — the generator emits `formAssociated`, `attachInternals()`, `internals.role`, `internals.aria*`,
  `internals.states.add(...)` — i.e. **form participation + default-ARIA + custom CSS states**.

What `ElementInternals` grants: **form association** (`setFormValue`, validation), a **default ARIA role**, and
**custom states** (`:state()`). What it does **not** grant — and what a real native element gives for free:
**focus ring / focusability, keyboard activation (Enter/Space), implicit form submit, label click-through,
native click semantics.** On a persistent autonomous host those are **hand-wired** (the
[fui:renderers/component/declarativeComponent.ts](../../frontierui/blocks/renderers/component/declarativeComponent.ts)
generator and per-block behaviors carry that wiring). And `ElementInternals` applies **only to your own
autonomous element** — never to a foreign native element you don't own.

**Conclusion:** WebKit's "persistent + `ElementInternals`" gets you *near-native* (role/form/state) but not
*native behaviour*; the transient element gets you the **whole** native element (behaviour included) for free, at
the cost of a microtask-lived node and an unsanctioned deletion. This is the genuine either/or the item names —
and it is real, not a strawman.

## 3. Composition cost — behaviour composes flat without transient (the 10-deep test, grounded)

The pro-transient "the web charges per node for deep composition" argument splits cleanly once grounded in the
FUI tree:

- **Behavioural layers compose to zero nodes via `CustomAttribute`.** FUI has **35+** behaviors
  ([fui:plugs/webbehaviors/CustomAttribute.ts:65-410](../../frontierui/plugs/webbehaviors/CustomAttribute.ts#L65-L410))
  — `TabGroupBehavior`, `TypeAheadBehavior`, the droplist `Filter`/`Selection`/`FocusDelegation`/`Windowed`/
  `Clearable` chain, `Highlight`/`Sortable`, the temporal `Clock`/`CalendarGrid`/`RangeCoordination` traits —
  each attaches **out-of-band via a WeakMap** ([:18](../../frontierui/plugs/webbehaviors/CustomAttribute.ts#L18),
  `:375-383`) and **adds no DOM node**. A 10-deep *behavioural* stack folds onto one element with zero wrappers.
  So transient buys **nothing** for behavioural depth — the platform already answers it.
- **Structural layers** (an independently-slotted/styled shell, a provider boundary) genuinely need a node; here
  the platform charges per layer, `display:contents` removes the box but not the node, and there is no zero-DOM
  context-provider equivalent. This is the real weakness — but it is **#1963 Fork 2's** turf (deep structural
  composition), not transient's.

**Transient is a 1:1 node-*elimination*** (author `<we-button>` → emit one native `<button>`), **not** a stacking
mechanism — you cannot compose 10 transient layers onto one node. So the honest justification for transient
narrows to exactly one property: **a real native element in the final DOM, authored declaratively, with zero
wrapper** (native semantics + SSR-degradability). The composition argument is *mis-attributed* to transient and
belongs to mixins (behavioural) and #1963 Fork 2 (structural).

## 4. Self-replacement in the wild + the robustness rider

The #1961 survey already established that **no mainstream library self-erases at runtime** — HTML web components
(Keith), Lit, Shoelace, Web Awesome all keep the host **persistent**; compile-away frameworks (Enhance, WebC,
Astro islands) unwrap at *build* time; htmx delegates on a stable ancestor. And self-replacement is **not
spec-sanctioned**: HTML warns against tree manipulation in custom-element reactions, and `connectedCallback` can
fire `>1×` and with `isConnected === false`
([WHATWG HTML §custom-elements](https://html.spec.whatwg.org/multipage/custom-elements.html)).

This is the legitimate concept-level residue — and it is a **robustness contract**, not an abandonment trigger:

- Self-replacement must be **idempotent** (guard re-entry), **`isConnected`-guarded**, and
  **microtask-deferred** (so the unwrap doesn't run inside the reaction). `TransientElement` satisfies **two of
  the three legs today**: idempotent via the `#replaced` guard
  ([fui:blocks/transient/TransientElement.ts:54-55](../../frontierui/blocks/transient/TransientElement.ts#L54-L55))
  and deferred via `queueMicrotask(() => this.replaceWith(el))`
  ([:75](../../frontierui/blocks/transient/TransientElement.ts#L75)) — **but it never checks `this.isConnected`**
  before replacing, so the `isConnected` leg is a **real (one-line) new requirement**, not a no-op.
- The "un-upgraded-first" FOUC concern (romainmenke) is mitigated for transient by the fact that the authored
  markup degrades to *the native element itself* under no-JS (the badge is a `<span>`, the button is a
  `<button>`), so there is no broken intermediate state — the upgrade only *removes a wrapper*, it doesn't change
  the element's nature.

So the standards-position challenge yields a **mandatory robustness rider**, satisfied today, rather than a
verdict against the pattern.

## 5. Refuting position D's discriminator (the survey's reshaping result)

The item's position **D** proposes scoping transient by **native-semantics payoff**: keep transient where a true
native element pays off (form controls, buttons); use **persistent** hosts for purely-presentational blocks
(badge/tag/card) that have *no* native-semantics payoff. **Grounding refutes this cut:**

- Badge/tag/card are the **cleanest** transient cases, not the ones to move off it: they hold **no state**, no
  consumer holds a ref, no listeners are bound, and #1961 found **no rename problem** there
  ([fui:blocks/badge/BadgeElement.ts](../../frontierui/blocks/badge/BadgeElement.ts),
  [fui:blocks/tag/TagElement.ts](../../frontierui/blocks/tag/TagElement.ts),
  [fui:blocks/card/CardElement.ts](../../frontierui/blocks/card/CardElement.ts)). Transient's *whole cost* (stale
  ref / lost listener / detached-node misuse) is **~zero** for them.
- Moving badge/tag/card to **persistent** *adds* a wrapper node (`<we-badge>` that stays), paying the full
  layout / content-model / AX / selector / tree-walk cost the item itself enumerates — to avoid a fragility cost
  that is already ~0. That is strictly worse.
- The **correct discriminator is "does a consumer need a persistent live ref / composite live-binding surface"**,
  not "is there a native-semantics payoff." This is precisely §7's existing cut
  ([we:block-standard.md → Packaging governance, item 7, #1381](../docs/agent/block-standard.md)): behaviour-free presentational + single
  native form controls → **transient (A)**; reactive / grouped / ref-bound → **persistent (B)**.

The FUI tree corroborates the §7 cut: **13 transient (A) blocks** (badge, tag, card, button, filter-chip,
progress, meter, number-input, text-field, temporal pickers — all behaviour-free leaves or single native
controls; stateful ones like button/filter-chip keep their toggle on a `CustomAttribute` on the **surviving
native** element) vs **26 persistent (B) blocks** (tabs, stepper, checkbox-group, AutoComplete, data-grid,
app-shell — all reactive / grouped / ref-bound).

## 6. Implications for the decision

- **`is=` (position C) is dead and statute-barred.** Safari's permanent `oppose` (#97) **plus** the native-first
  **single-substrate floor** ([we:platform-decisions.md#native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline))
  — a spec never carries a dual native-vs-shimmed contract — forbid `is=`-load-bearing. Recorded as rejected by
  precedent (consistent with #1963's same ruling), usable only as opt-in progressive enhancement.
- **The genuine call is the *scoping discriminator*** — reaffirm §7's persistent-ref cut (A), narrow to D's
  native-payoff cut (B), or abandon transient wholesale for persistent (C). The grounded recommendation is
  **reaffirm §7's cut**: #97 doesn't bite emit-a-true-native; transient strictly dominates persistent for
  ref-free leaves (free native behaviour + zero wrapper); D's cut is the wrong discriminator; abandonment
  reimplements native behaviour by hand and adds a node.
- **A mandatory robustness rider** (idempotent + `isConnected`-guarded + microtask-deferred self-replacement) is
  the concept-level challenge's legitimate residue. Two legs ship today (`#replaced` + `queueMicrotask`); the
  `isConnected` guard is a real one-line gap. Codify all three as a family-A conformance requirement and file the
  guard as a separately-prioritized build.
- **A non-binding watch:** if a *sanctioned* declarative "render-as-native" primitive ever ships (DOM Parts, a
  revived parser-level mechanism per whatwg/html#8114), revisit — but that is a future contingency, not a present
  fork.

The decision item rewrites A/B/C/D into **one genuine Fork (the discriminator)** + **two forced invariants**
(C-dead; robustness rider), per the prepared-fork shape.
