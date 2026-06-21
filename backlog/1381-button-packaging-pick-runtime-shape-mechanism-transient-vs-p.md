---
kind: decision
status: resolved
blockedBy: ["1321"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
preparedDate: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-21-1381-button-packaging-mechanism.md
tags: [packaging, button, custom-elements, transient-element, native-first, frontierui]
---

# Button packaging: pick the button's runtime-shape mechanism (transient vs persistent light-DOM)

## Ruling (ratified 2026-06-21)

**Fork 1 → A — transient self-erase → native `<button>`** *(~80%)*. The button's S1 reference shape is the
`TransientElement` pattern (`fui:blocks/transient/TransientElement.ts`): `<we-button variant>` upgrades,
transfers its attributes to a real native `<button>`, and erases itself — end-state byte-identical to the
native-`<button>`+computed-class shape, with a real native control (keyboard/focus/form/SR free, never pays
`ElementInternals`), wrapper-less, S1-isolatable via #1349 L2.

*Lifecycle & events are kept, relocated to the surviving native button, not lost.* The discussion that
ratified this established the cost boundary precisely: declarative behaviors ride `CustomAttribute`s on the
native button, which carry the full lifecycle suite (observe-attribute, connect/disconnect, form
participation — `fui:plugs/webbehaviors/CustomAttribute.ts:286-363`); native events bind to the surviving
`<button>` and child listeners survive (TransientElement *moves* nodes). **Attribute-shaped reactivity is
forwarded by default** (it never lived on the `we-button` element). The *only* surface A gives up is
**imperative non-serializable property writes on a persistent element ref** — and that cannot be "forwarded"
without keeping the element alive, which *is* fork B (a forwarding wrapper is not a third option). For a
button that lost surface is near-empty (its framework inputs are primitive/attribute-shaped), which is why
confidence rose from the prepared ~75% to **~80%** at ratification.

**B (persistent light-DOM) stays explicitly allowed** for the genuine framework-property-bound consumer
(#463), and is the shape that upgrades to **C** (#1349 S2). Clean mapping: **A = native-first floor · B =
persistent middle · C = S2 opt-in.** Tag is **`we-button`** (#841); `we-button` applies to both A and B.

*Codified:* the per-block **mechanism-selection guideline** is now a statute in
`we:docs/agent/block-standard.md` (Packaging governance §7). The remaining ~68 block conversions are spun out
as separately-prioritized epic **#1442** (`blockedBy` this decision) — prioritization, not a fork
(*fork-is-not-a-prioritization-tool*).

---

**Prepared 2026-06-21 — ready to ratify.** A *consumer refinement* of three already-ratified contracts —
[#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/) (general block-packaging),
[#1349](/backlog/1349-light-dom-scoped-component-css-isolation-native-compile-prop/) (`webisolation`
S1/S2), [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention-/) (tag naming) — so
the grounding is the prior surveys ([fui-variant-surface-packaging](/research/fui-variant-surface-packaging/),
[scoped-component-css-isolation](/research/scoped-component-css-isolation/)) plus a focused new survey of the
**self-erasing transient pattern**, published as [button-packaging-runtime-shape](/research/button-packaging-runtime-shape/)
(session report `we:reports/2026-06-21-1381-button-packaging-mechanism.md`). The standing test shrinks #1321's
three deferred concerns to **one genuine fork** (the other two are settled / prioritization — see *Supported
by default* and *Context*). This is an **FUI impl call** (`locus: frontierui`): the variant *contract* is
WE's, the *packaging* is FUI's (#1321).

## Axis framing — what the real tree forces

#1321 deferred (`we:backlog/1321:55-58`) the button's concrete runtime shape among three families
(`we:backlog/1381` original digest): **(A)** `TransientElement` self-replace → native `<button>`
(wrapper-less), **(B)** persistent light-DOM custom element owning a real `<button>`, **(C)** shadow. Two of
the three axes those families span are **already decided elsewhere**, leaving one open:

- The **S1 (light DOM) vs S2 (shadow)** axis is ratified **support-both, flavor-default S1** by #1349
  (`we:backlog/1349:152-161`); #1321 confirms the button rides whichever the deployment selects
  (`we:backlog/1321:35-48`). So **(C) shadow is the #1349 S2 opt-in** (a persistent shadow host), **not a
  fresh fork**.
- The **tag value** is ratified by #841 as `<prefix>-<id>`, default `we-`
  (`we:docs/agent/platform-decisions.md#tagname-naming`) → **`we-button`** (see *Supported by default*).

What is **not** yet decided is, *within* the default S1 strategy, the button's runtime shape: **A (transient
self-erase) vs B (persistent light-DOM element)**. Grounding in the real tree:

- The transient mechanism is real and shipping: `fui:blocks/transient/TransientElement.ts:53-72` — a one-shot
  `connectedCallback` that creates the native tag, transfers attributes/children, then
  `queueMicrotask(() => this.replaceWith(el))` (guarded by `#replaced`); registered today for `auto-heading`
  via `fui:blocks/transient/registerTransient.ts:21` (`registerTransient(tag = 'we-transient-component')`).
- Today's button is **neither A nor B**: `fui:blocks/button/Button.ts:50-58,114-120` is a *factory*
  (`createButton`) that hangs `fui-button` **global classes** on a native `<button>`/`<a>` with **zero custom
  element** — the #1321-rejected no-element global-CSS shape, shipping no tag on purpose pending #841
  (`fui:blocks/button/Button.ts:12-16`).
- The button needs **no element for behavior** (`we:backlog/1321:309-373`): `variant` is CSS,
  busy/toggle/async/icon are `CustomAttribute`s on the native button, dialog/menu triggering is native
  (`command`/`commandfor`+`popovertarget`, Baseline Dec 2025).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — button S1 runtime shape | **A — transient self-erase → native `<button>`** (wrapper-less, real native button, S1-isolatable via #1349 L2) | B — persistent light-DOM custom element (better for framework-bound/reactive consumers; the shape that upgrades to C/S2) | ~75% |

## Fork 1 — the button's S1 runtime shape: transient (A) vs persistent light-DOM (B)

*Fork-existence (genuine either/or):* both branches are coherent, but they **cannot both be the single S1
reference shape** for the button — A leaves a plain native `<button>` in the final DOM, B leaves a persistent
`<we-button>` element; the FUI reference button is one or the other. This is *not* the #1349 support-both axis
(that is S1-vs-S2, settled); it is the un-decided choice *within* S1. Neither branch is broken, so the call is
which leans default — picked on merit (native-first vs reactivity), not effort.

**Crux:** does the button's primary consumer ever need the element to *persist* in JS after upgrade? Per
#1321's behavior inventory it does not for behavior; the only persistence-demanding consumer is a
**framework/property-bound** one (a React/Vue ref to `<we-button>` that sets properties post-mount — the
polyglot-adapter case, #463). Transient gives that up (after `replaceWith`, no element to observe); B keeps
it. Isolation splits the same way: A carries **S1** (the #1349 L2 transform keys a unique class on the
emitted native button) but **cannot carry S2** (no host for a shadow), so opting into S2 forces a persistent
element. Clean mapping: **A = S1/native-first floor · C = S2 opt-in · B = persistent-light middle.**

- **A — Transient self-erase → native `<button>` (recommended).** `<we-button variant>` upgrades, transfers
  its attributes to a real native `<button>`, and erases itself (the `TransientElement` pattern already in
  the tree). End-state is byte-identical to shadcn's native-`<button>`+computed-class shape. Wins: a real
  native button (keyboard/focus/form/SR free, **never** pays `ElementInternals`), wrapper-less and DOM-clean,
  S1-isolatable via #1349 L2, and zero behavior need lost (behaviors ride `CustomAttribute`s on the surviving
  button; CSS variant-reactivity works over the surviving `[variant]`). External consensus backs it for a
  behavior-free control: *"web components are not recommended for small UI like buttons — that's design-system
  CSS; WC's strength is sharing behavior"* (survey). **Cost (merit, not effort):** loses **post-render JS
  reactivity on the element** (framework property-binding) and shows `<button>` not `<we-button>` in devtools
  (a minor block-explorer/dogfood-marker loss).
- **B — Persistent light-DOM custom element owning a real `<button>`.** *Allowed, not the floor.* `<we-button>`
  persists and owns a child native `<button>`. Wins: full element reactivity (observed attributes, property
  binding) — the right shape for a **framework-bound** consumer — and it is the element a deployment upgrades
  to C/S2 (shadow) when it opts into enforced isolation. The light-DOM-only WC movement validates it as a
  mainstream end-state. **Cost (merit):** adds a wrapper node the behavior-free button doesn't otherwise need
  (the native control is now nested, not the element itself), against the wrapper-less/native-first bias.
- **C — Shadow.** *Not this fork* — it is the #1349 S2 opt-in (a persistent shadow host), already
  support-both; cite #1349 rather than re-deciding.

**Recommended default: A (transient), ~75%.** *Red-team / residual ~25%:* the attack is "the polyglot/
framework-binding consumer is the *primary* button consumer, not an edge case" — if the decider accepts that,
transient's reactivity loss is a floor-level cost and **B** becomes the better default. Defense: #1321's
behavior inventory + the external "don't WC a button" consensus put the behavior-free, native-DOM consumer
first; frameworks consume the native button (or its CEM types, #822) fine, and the reactive case is exactly
what **B** stays *allowed* for. Flag this fork for the deciding agent's skeptic sub-pass (high leverage — it
sets the reference shape the whole conversion program below inherits).

## Supported by default (not decisions)

- **`we-button` is the tag (confirmation, not a fork).** #841's ratified derivation `<prefix>-<id>` (default
  `we-`) yields `we-button`; FUI conforms via a parameterized `registerButton(tag = 'we-button')` (the #463
  standard→impl direction, the shape `registerTransient(tag = …)` already uses). No prettier semantic
  alternative exists (unlike `pagination → page-nav`), so no override is motivated; `fui-` is **excluded**
  (#841 — branding the WE contract with the impl name inverts the constellation). The tag applies to **both**
  A and B (transient registers a global tag to upgrade-then-erase). #1321's loose `<fui-button>` usages are
  corrected to `we-button` here. *No naming sub-fork* — #1318 settled the `variant` attribute is bare.
- **S1 vs S2 isolation is #1349's support-both (default S1).** The button rides the deployment's #1349
  strategy; A realizes S1, C realizes S2. No `ElementInternals` under S1 (light DOM); `ElementInternals` is a
  shadow-only (S2) cost. Cite #1349; nothing to re-decide.

---

## Context

### Block-model conversion program — a ratification-time spin-out, not a fork

#1321 noted only 5–7 of 75 blocks register as custom elements today (`we:backlog/1321:120-124`; #841 counts
7) and that converting the rest is **"sizable, separately prioritized; not a reason to reject the ruling
(fork-is-not-a-prioritization-tool)."** The end-state is already ruled (every block becomes a custom element,
mechanism chosen per use case), so this is **prioritization, not a design fork**. At ratification, spin out a
**separately-prioritized conversion epic** (`blockedBy` this decision), carrying the per-block
**mechanism-selection guideline** this fork establishes:

- default to **S1 / native-first** (#1349 default);
- a **behavior-free presentational control** (button, badge, …) → **transient (A)** — the shape Fork 1 picks;
- a **framework-bound / reactive** block → **persistent light-DOM (B)**;
- a block facing **hostile/unknown host CSS** that opts into #1349 **S2** → **shadow (C)**.

This guideline *is* the reusable rule the decision codifies (statute home:
`we:docs/agent/block-standard.md`, alongside `#packaging-governance-1321`). The conversion epic is build
work, sequenced by normal burndown ordering — not authored here.

### Relationships

- **#1321** — the general block-packaging ruling this refines (blockedBy; resolved 2026-06-21).
- **#1349** — `webisolation` S1/S2 support-both; A=S1, C=S2 (resolved 2026-06-21).
- **#841** — the tag-naming derivation that yields `we-button` (resolved 2026-06-17).
- **#1318** — the ratified bare `variant` attribute the button consumes.
- **#822** — the CEM/types surface that gives `we-button` autocomplete/typing, independent of A/B.
