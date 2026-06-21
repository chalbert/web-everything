# Button packaging — picking the concrete runtime-shape mechanism (prep for #1381)

**Date:** 2026-06-21 · **Decision item:** [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/)
· **Parent ruling:** [#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/)
(general block-packaging) · **Isolation contract:** [#1349](/backlog/1349-light-dom-scoped-component-css-isolation-native-compile-prop/)
· **Tag-naming contract:** [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention-/)

This is a **consumer refinement** of two already-ratified, heavily-surveyed decisions, so it sits on
already-researched ground: the benchmark button-packaging survey lives in
`we:reports/2026-06-20-1321-fui-variant-surface-packaging.md` (+ `/research/fui-variant-surface-packaging/`)
and the CSS-isolation survey in `we:reports/2026-06-20-scoped-component-css-isolation.md`
(+ `/research/scoped-component-css-isolation/`). This report adds only the **one genuinely-new angle** #1381
introduces and that the priors did not survey in depth: the **self-erasing / transient custom element**
pattern and its tradeoffs against a **persistent** custom element for a native control.

## What #1321 deferred to #1381 (verbatim scope)

> the button's concrete **mechanism pick** (which of the three runtime-shape families A/B/C), the
> **`we-button` default-tag** confirmation, and the **block-model conversion program** (5/75 blocks are
> elements today, #841) are deferred to #1381.

The three families (`we:backlog/1381:9-11`):

- **(A) `TransientElement` self-replace → native `<button>`** — wrapper-less; "leads, but weigh post-render
  reactivity / DOM-inspection limits."
- **(B) persistent light-DOM custom element owning a real `<button>`.**
- **(C) shadow.**

## Standing test — how many of the three concerns are actually forks?

**Concern 2 (`we-button` tag) is settled, not a fork.** #841 ratified the WE-contract tag value as the
derivation `<prefix>-<id>` with platform-default prefix `we-`
(`we:docs/agent/platform-decisions.md#tagname-naming`; codified). Applied to the button: `button` →
**`we-button`** (the hyphen also satisfies #1120's `CustomAttributeRegistry`-grade rationale, though that
rule governs *registered behaviors*, not a CSS/element tag). There is no prettier semantic alternative the
way `pagination → page-nav` had one, so no override is motivated. FUI conforms via a parameterized
`registerButton(tag = 'we-button')` (the #463 standard→impl direction; the exact shape
`fui:blocks/transient/registerTransient.ts:21` already uses, `registerTransient(tag = 'we-transient-component')`).
**Confirmation, not a pick.** Note #1321's body uses `<fui-button>` loosely in places — the contract value
is `we-button`; `fui-` is excluded (#841: branding the WE-owned contract with the impl name inverts the
constellation).

**Concern 3 (block-model conversion program) is prioritization, not a fork.** #1321 already labelled it
"Sizable, separately prioritized; not a reason to reject the ruling (fork-is-not-a-prioritization-tool)"
(`we:backlog/1321:120-124`). Per the *fork-is-not-a-prioritization-tool* statute, the end-state is already
ruled (every block becomes a custom element, mechanism per use case); *when* to convert 70 factory blocks is
backlog ordering. → **carve a separately-prioritized epic**, do not "decide" it here. The one thing #1381
*can* add is the **per-block mechanism-selection guideline** (a rule derivable from #1321 + #1349, not a
fork): default S1/native-first; reach for S2/shadow only for the hostile-CSS case; reach for a persistent
element only when behavior/reactivity earns it.

**Concern 1 (mechanism A/B/C) collapses to ONE genuine fork.** The S1-vs-S2 axis (light DOM vs shadow) is
**already ratified support-both by #1349, flavor-default S1** — #1321 confirms the button rides whichever
strategy the deployment selects (`we:backlog/1321:24-29`). So **C (shadow) is not a fresh #1381 fork** — it
is the #1349 S2 opt-in, realized as a persistent shadow host. What #1349 did **not** decide is, *within* the
default S1 (light-DOM) strategy, the button's runtime shape: **A (transient self-erase → native button)** vs
**B (persistent light-DOM custom element)**. That A-vs-B-within-S1 choice is #1381's real residual.

| #1321 family | #1349 strategy it realizes | Decided where? |
|---|---|---|
| A — transient → native `<button>` | S1 (light-DOM, unique-class) | **open — #1381 Fork 1** |
| B — persistent light-DOM element | S1 (light-DOM, unique-class) | **open — #1381 Fork 1** |
| C — shadow host | S2 (shadow) | settled by #1349 (support-both, opt-in) |

## The new angle — transient (self-erasing) vs persistent, grounded in code + web survey

**The transient mechanism, as it actually exists** (`fui:blocks/transient/TransientElement.ts`): an abstract
`HTMLElement` whose `connectedCallback` creates the native replacement tag, transfers attributes (minus
`is`/`data-transient-*`/exclusions), moves children, then `queueMicrotask(() => this.replaceWith(el))` — a
one-shot guarded by `#replaced`. After that microtask **the custom element is gone**; the DOM holds a plain
native element. Already shipping for `auto-heading` (`registerTransient`). It registers a global tag to
upgrade-then-erase, so `we-button` applies to A as much as to B.

**What the button specifically needs** (from #1321's behavior inventory, `we:backlog/1321:309-373`): nothing
that requires a persistent element. `variant` is a CSS-consumed attribute; busy/toggle/async/icon are all
`CustomAttribute`s attachable to the native button; `command`/`commandfor` + `popovertarget` made
dialog/menu/popover triggering native (Dec 2025 Baseline). The composite cases (split/menu/group) are
*separate blocks*, not the button.

**Implication for the transient limits #1321 flagged:**

- *Post-render reactivity* — after self-erase there is no element to observe attribute changes in JS. But
  `variant` reactivity is **CSS over the surviving native button's `[variant]` attribute** (works fine), and
  behaviors are `CustomAttribute`s on that native button (persist fine). The reactivity loss only bites a
  *framework-bound / property-set-on-the-element* consumer (a React/Vue ref to `<we-button>` that sets props
  post-mount) — exactly the polyglot-adapter case (#463). That is the legitimate home of **B**.
- *DOM-inspection* — devtools shows `<button class="we-button …">` not `<we-button>`. Arguably cleaner;
  a minor loss for a block-explorer / dogfood-proof "this is a WE block" marker.
- *Isolation* — A can carry **S1** (the #1349 L2 build-transform keys CSS to a unique class on the emitted
  native button) but **cannot carry S2** (no persistent host to attach a shadow). Selecting #1349 S2 for the
  button therefore *forces* a persistent element (C). This is the clean mapping: **A = the S1/native-first
  floor; C = the S2 opt-in; B = the persistent-but-light middle for reactive consumers.**

**External consensus (web survey, June 2026):**

- **"Web Components are not recommended for small UI elements like buttons — that's better suited for a
  design system's CSS. The true strength of Web Components lies in sharing behavior."**
  ([Medium / Ottaviani](https://eduardo-ottaviani.medium.com/web-components-a-practical-perspective-using-custom-elements-7523a6462387)).
  A button has no behavior need (per #1321) → this is a direct vote for the **native-button-with-CSS** shape,
  i.e. transient (A).
- **The native `<button>` is the clear winner for an interactive control** — keyboard/focus/SR/form for free,
  less maintenance ([web.dev — building a button](https://web.dev/articles/building/a-button-component)).
  A (real native button in the final DOM) maximizes this; a wrapper (B) keeps a native button inside but
  adds a node.
- **shadcn** ships the most native-first benchmark shape: a real `<button>` with a computed `variant` class
  (cited in #1321's survey) — the transient end-state is byte-identical to it in the final DOM.
- **Light-DOM-only web components are a real, growing movement** for app/site components and native-wrappers
  ([Frontend Masters](https://frontendmasters.com/blog/light-dom-only/),
  [Chromamine](https://chromamine.com/2024/10/you-can-use-web-components-without-the-shadow-dom/),
  [Cloud Four](https://cloudfour.com/thinks/testing-html-light-dom-web-components-easier-than-expected/)) —
  this validates **B** as a coherent end-state (persistent light-DOM element) for consumers who want the
  element to live (reactivity, SSR-fallback authoring, queryability).
- **Light-to-Shadow swapping** (light DOM as the fallback, enhanced to shadow once JS runs —
  [Scott Jehl](https://scottjehl.com/posts/html-web-components-shadow-dom/)) mirrors the
  A-floor / C-opt-in layering: ship the native floor, enhance when a stronger boundary is wanted.

**Today's button is neither A nor B** — `fui:blocks/button/Button.ts` is a *factory* (`createButton`) that
hangs `fui-button` **global classes** on a native `<button>`/`<a>` with **zero custom element** (the file
header says it ships no tag on purpose, pending #841). That is #1321's rejected/cooperative "no-element
global CSS" shape. So #1381 isn't choosing among existing impls — it's setting the target the conversion
re-grounds the button onto.

## Recommendation (to ratify in #1381)

1. **Fork 1 → A (transient self-erase → native `<button>`), ~75%.** It is the S1/native-first floor:
   wrapper-less, a real native button (a11y/forms free, never pays `ElementInternals`), DOM-clean,
   byte-equal to shadcn, S1-isolatable via #1349 L2 — and the button has no behavior/reactivity need that a
   persistent element would serve (#1321 inventory + external "don't WC a button" consensus). **B stays
   allowed-not-floor** for framework-reactive / property-bound consumption (and is the shape that upgrades to
   C/S2 when a deployment opts into shadow isolation). C is the #1349 S2 opt-in, not this fork.
   - *Residual ~25%:* if the polyglot-adapter / framework-binding consumer is judged the *primary* button
     consumer, the persistent element (B) becomes the better default — transient's reactivity loss is then a
     floor-level cost, not an edge case. Flag for the decider's skeptic pass.
2. **`we-button` confirmed** (derive-from-#841; FUI conforms via `registerButton(tag = 'we-button')`).
3. **Block-model conversion → carve a separately-prioritized epic**, carrying the per-block
   mechanism-selection guideline (default S1; transient for behavior-free controls, persistent for reactive,
   shadow for hostile-CSS). Not decided here.

## Classification (per-fork pass)

- **Layer:** impl/packaging — `locus: frontierui` (the *variant contract* is WE's, the *packaging* is FUI's,
  per #1321). #1381 is an FUI impl call that the WE side only constrains via the #1321/#1349/#841 contracts.
- **Protocol or intent dimension?** Neither — no new contract is minted; A/B/C are impl realizations behind
  the existing uniform `we-button[variant]` usage surface.
- **Fixed mechanic or dimension?** A-vs-B is a *pick-one default* for the reference button (both coherent,
  can't both be the single S1 default) — a genuine either/or, not a support-both (the support-both axis, S1
  vs S2, is already #1349's). The per-block guideline *is* a dimension (each block picks by use case).
- **Most-permissive default:** A keeps the most behavior native and the DOM most standard; the restriction
  (persisting an element / shadow) is the consumer's opt-in.

## Sources

- [Web Components — A Practical Perspective (Ottaviani)](https://eduardo-ottaviani.medium.com/web-components-a-practical-perspective-using-custom-elements-7523a6462387)
- [Building a button component — web.dev](https://web.dev/articles/building/a-button-component)
- [Light-DOM-Only Web Components are Sweet — Frontend Masters](https://frontendmasters.com/blog/light-dom-only/)
- [You can use Web Components without the shadow DOM — Chromamine](https://chromamine.com/2024/10/you-can-use-web-components-without-the-shadow-dom/)
- [Testing HTML Light DOM Web Components — Cloud Four](https://cloudfour.com/thinks/testing-html-light-dom-web-components-easier-than-expected/)
- [HTML Web Components Can Have a Little Shadow DOM — Scott Jehl](https://scottjehl.com/posts/html-web-components-shadow-dom/)
- [MDN — Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
