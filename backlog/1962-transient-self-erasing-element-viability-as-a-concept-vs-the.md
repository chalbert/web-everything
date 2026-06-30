---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-29-transient-self-erasure-concept-viability.md
tags: [webcomponents, transient-element, block-standard, standards-position, native-semantics, decision]
---

# Transient (self-erasing) element — viability as a concept vs the standards-endorsed alternatives

**Prepared.** This re-judges the **already-ratified** transient / A-family pattern
([we:block-standard.md → Packaging governance, item 7](../docs/agent/block-standard.md), #1381) **at the concept
level** — is self-erasure the right idea, given what the standards bodies endorse? Grounded in a prior-art survey
([/research/transient-self-erasure-concept-viability](/research/transient-self-erasure-concept-viability/);
report linked below) that fetched the **WebKit #97** reasoning verbatim and re-grounded the FUI tree. The
*scoping* call is **already settled statute** (§7 / #1381 / #1456), so this card is **a concept-level
confirmation + two codifications**: the **#97 reconciliation on record** (the `oppose` does *not* condemn family
A) and a **self-replacement robustness rider**, while **refuting position D**. The ratifiable posture is in
**bold** under Fork 1. **Case 1's facet** of
[#1963](1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md) — resolve under its framework-parity bar.

> **Seed for review (2026-06-29) — the biggy: a hard, clear rule for WHEN transient vs wrapper/persistent element.**
> Start from the **"is-a" test**: *is-a* a single native element (`<we-button>` **is a** button, `<we-date-picker>`
> **is a** input) → **transient (A)**; a **composite / container** with no single native essence (`<we-card>` *has a*
> header + body; a group *has* children) → **wrapper / persistent (B)**. This sharpens §7's existing rules (the
> #1381 family pick; the #1457 *is-a vs can-do* element-vs-behaviour test) into a crisp transient-vs-wrapper call.
> **Refine with #1963's transient audit** (the [framework-parity report](../reports/2026-06-29-composition-framework-parity.md)):
> the is-a set splits into **irreplaceable-native** (text-field, number-input, date/time/datetime pickers — native
> chrome/IME/validation can't be reproduced → transient is load-bearing, ~permanent) vs **replicable** (button, chip
> — a persistent CE + `ElementInternals` could approximate → transient is the default but configurable). The 7
> **soft-transient** presentational blocks (badge, tag, section-card, auto-heading, meter, progress, card) are
> cleanliness-only → light-DOM is an equally valid opt-in (the configurable-variant rule; **#1974** carries the
> per-block default re-eval, blocked on this). Watch `ElementInternals.type` ([whatwg/html#11061](https://github.com/whatwg/html/issues/11061))
> — if it ships, a persistent CE could inherit native behaviour and transient could deprecate even for the hard set.

## The crux, in one paragraph

The transient element ([fui:blocks/transient/TransientElement.ts:53-76](../../frontierui/blocks/transient/TransientElement.ts#L53-L76))
builds a native element, moves attributes + children onto it, then `queueMicrotask(() => this.replaceWith(native))`
and vanishes — **zero wrapper**. The concept-level challenge has three real strands, each pinned to the tree:
**(1)** the **WebKit #97** `oppose` on customized built-ins argues real native semantics are better reached by
**keeping** a persistent host + `ElementInternals`, not deleting the element; **(2)** self-replacement is **not
spec-sanctioned** (`connectedCallback` fires `>1×` / with `isConnected===false`) and **nobody self-erases at
runtime** (#1961 survey); **(3)** a composition-cost argument that the platform charges per node. Grounding each
strand against the real tree (`ElementInternals` used in only **2** places —
[fui:blocks/droplist/AutoComplete.ts:52](../../frontierui/blocks/droplist/AutoComplete.ts#L52),
[fui:blocks/renderers/component/declarativeComponent.ts:191-233](../../frontierui/blocks/renderers/component/declarativeComponent.ts#L191-L233);
behaviour composes node-free via **35+** `CustomAttribute`s,
[fui:plugs/webbehaviors/CustomAttribute.ts:65-410](../../frontierui/plugs/webbehaviors/CustomAttribute.ts#L65-L410);
the §7 family cut already in [we:block-standard.md → Packaging governance, item 7](../docs/agent/block-standard.md),
#1381) collapses the four candidate positions onto **one axis** — *which discriminator scopes self-erasure* —
leaving everything else forced or already-settled.

## Recommended path at a glance

| # | Element | Recommended | Main alternative (excluded) | Confidence |
|---|---|---|---|---|
| **Fork 1** | Scoping discriminator for self-erasure | **(a) Reaffirm §7's persistent-ref cut** — transient for behaviour-free leaves + single native form controls; persistent for reactive/grouped/ref-bound | (b) D's native-payoff cut · (c) abandon for persistent everywhere | **High — reaffirms settled §7/#1456 statute; low divergence** |
| Forced | `is=` (customized built-in, position C) | **Dead + statute-barred** — PE-only, never load-bearing | (rely on `is=` cross-browser) — Safari will never ship it | High (ratify) |
| Forced | Self-replacement robustness rider | **Mandatory: idempotent + `isConnected`-guarded + microtask-deferred** (idempotent + defer present; the `isConnected` leg is a real new requirement) | (unguarded self-replacement) — broken under `>1×` / `isConnected===false` reaction | High (ratify) |

## Supported by default (forced — not forks)

- **`is=` / customized built-ins (position C) are dead and statute-barred — recorded, not re-litigated.**
  Safari's permanent `oppose` ([WebKit #97](https://github.com/WebKit/standards-positions/issues/97)) **plus**
  the native-first **single-substrate floor**
  ([we:platform-decisions.md#native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline)
  — a spec never carries a dual native-vs-shimmed contract) forbid making `is=` load-bearing. This is **demote,
  not forbid** (§7's *compliance-is-a-spectrum*, #1321): `is=` may *enhance* a native element where present,
  degrading to the plain native element in Safari. Identical to #1963's same ruling — cited, not re-decided.
- **Self-replacement carries a mandatory robustness rider** — the legitimate residue of strand (2), and the
  one part of this card that is **not already shipped**. Because `connectedCallback` can fire `>1×` and with
  `isConnected===false`, and the HTML spec warns against tree manipulation in reactions, a family-A unwrap
  **must** be **idempotent** (re-entry guard), **`isConnected`-guarded**, and **microtask-deferred**. This is a
  **forced invariant** (the alternative — unguarded self-replacement — is *broken*, not a coherent choice). The
  current base **satisfies two of the three legs**: idempotent via the `#replaced` guard
  ([fui:blocks/transient/TransientElement.ts:54-55](../../frontierui/blocks/transient/TransientElement.ts#L54-L55))
  and deferred via `queueMicrotask` ([:75](../../frontierui/blocks/transient/TransientElement.ts#L75)) — **but it
  does *not* check `this.isConnected`** before replacing, so the `isConnected` leg is a **real (small) new
  requirement**, not a no-op. Codify all three as a family-A conformance rider so the next transient block
  inherits it; the build is a one-line guard (`if (!this.isConnected) return;`) filed as a separately-prioritized
  item, not part of this ruling.
- **A non-binding watch (not a fork):** if a *sanctioned* declarative "render-as-native" primitive ever ships —
  DOM Parts, or the parser-level mechanism WebKit floated for the `td`/`template` case
  ([whatwg/html#8114](https://github.com/whatwg/html/issues/8114)) — revisit whether it supersedes the unwrap.
  A future contingency with no present excluded branch, so it is a rider, not a `## Fork`.

## Fork 1 — the scoping discriminator for self-erasure

*Fork-existence:* a genuine either/or at the *concept-posture* altitude (standing-test case b) — three
**coherent** scoping postures, mutually exclusive (the standard must name **one**; you cannot say both
"badge → transient" and "badge → persistent"). The composability probe does not dissolve it: "support both
families, scoped" *is* what (a) is, so the residual choice is genuinely *which discriminator draws the cut*.
**Honest confidence caveat (skeptic pass-0):** this is a **low-divergence** fork — branches (b) and (c) are
**already excluded by ratified statute**, not wide open: §7 item 7 / #1381 already rejected persistent-everywhere
and #1456 already rejected transient-for-groups, drawing *exactly* the cut (a) reaffirms (the discriminator —
*does the primary consumer need a persistent live ref / composite live-binding surface* — is verbatim the #1456
rationale). So Fork 1 is the **concept-level confirmation** the user asked for (does the #97 + unsanctioned-ness
challenge force abandoning or re-scoping family A — **no**), *not* a fresh wide-open call. Its two genuinely-new
outputs are the **#97-reconciliation-on-record** and the **robustness rider** above. This is *not* a
prioritization fork — each branch's downside is a **merit** (a11y / native-behaviour / node-cost) difference,
never cost/effort.

**Crux with refs.** The honest justification for transient narrows (per the survey's category check, §*Context*)
to exactly one property it uniquely buys: **a real native element in the final DOM, authored declaratively, with
zero wrapper** — free focus/activation/form/AT, SSR-degradable. `ElementInternals` (WebKit's alternative) grants
**form association + default ARIA role + custom states** only
([fui:renderers/component/declarativeComponent.ts:191-233](../../frontierui/blocks/renderers/component/declarativeComponent.ts#L191-L233)),
**not** native behaviour (focus ring, keyboard activation, implicit submit, label click-through are hand-wired) —
and only on *your own* element. So the cost of transient (a microtask-lived node + an unsanctioned deletion) is
borne **only where a consumer holds a live ref / a composite live-binding surface exists**; where none does, the
cost is ~0. That is the axis the discriminator must track.

- **(a) Reaffirm §7's persistent-ref cut.** *(default)* Transient (family A) for **behaviour-free leaves +
  single native form controls** (badge, tag, card, button, filter-chip, progress, meter, text-field,
  number-input, temporal pickers — the cases where no consumer holds a live ref; stateful ones keep their toggle
  on a `CustomAttribute` on the **surviving native** element). Persistent (family B) for **reactive / grouped /
  ref-bound** blocks (tabs, stepper, checkbox-group, AutoComplete, data-grid — a stable identity / composite
  `value` surface is needed). Discriminator = *does a consumer need a persistent live ref or composite
  live-binding surface*. **#97 is consistent with this** — it recommends persistent-host exactly where §7 routes
  to B, and never contemplated emit-a-true-native (family A).
- **(b) D's native-payoff cut.** *Rejected — wrong discriminator.* Scopes transient by *native-semantics payoff*
  (keep for form controls/buttons; persistent for badge/tag/card). But badge/tag/card are the **cleanest**
  transient cases — no state, no ref, no rename problem (#1961), zero wrapper — so moving them to persistent
  **adds a wrapper node** to avoid a fragility cost that is already ~0. *(Skeptic correction: a persistent
  `<we-badge style="display:contents">` erases its **box**, so this is **not** "full layout cost" — flex/grid
  direct-child breakage is avoided. But `display:contents` removes the box, **not the node**: the AX-tree entry,
  HTML content-model position, structural-selector / `:nth-child` shift, and the tree-walk node all remain — the
  exact "cheap node, not zero" #1963's spine draws. So persistent-badge is cheaper than first stated, yet still
  strictly costlier than zero-wrapper transient.)* The payoff axis mis-identifies *where transient's cost
  actually lands* (on ref-holders, not on no-semantics blocks).
- **(c) Abandon — persistent autonomous host + `ElementInternals` everywhere.** *Rejected — strictly worse for
  leaves.* It is coherent (Lit/Shoelace ship it) but for a behaviour-free leaf it **reimplements** native
  focus/activation/keyboard by hand, gets only *near*-native semantics, and **adds a persistent wrapper node** —
  the very bloat the composition-cost argument warns against. WebKit's own rec is *narrower* than "abandon": it
  targets *owned* semantics, which is family B's existing domain, not a mandate to drop family A.

```ts
// Fork 1 (a) — the discriminator, by family. The SAME authoring surface (<we-*>) backs both.

// Family A (transient): behaviour-free leaf / single native control → emit a TRUE native element, zero wrapper.
// Real focus/activation/form/AT are FREE; the host is gone after a microtask.
class BadgeElement extends TransientElement {            // fui:blocks/badge/BadgeElement.ts
  resolveTag() { return 'span'; }                        // <we-badge> → <span class="fui-badge"> ; no ref held → cost ~0
}
// Family B (persistent): a consumer holds a live ref / composite value → KEEP the host as the binding surface.
// ElementInternals gives form+role+state; native click/keyboard/focus are HAND-WIRED on the host.
class WeCheckboxGroup extends HTMLElement {              // fui:blocks/checkbox/CheckboxElements.ts
  static formAssociated = true;
  #internals = this.attachInternals();
  get values() { /* composite live surface — the reason the host must persist */ return []; }
  // …focus roving, keyboard, label wiring all explicit (no real native group element to erase into)
}
// (b) would push BadgeElement onto the WeCheckboxGroup shape — paying a wrapper node for a block that needs none.
```

`Skeptic:` SURVIVES-WITH-AMENDMENT (throwaway refute-only sub-agent, four axes). **Pass-0 (classification):** the
substance holds but the strongest hit landed — Fork 1(b)/(c) are *already excluded by §7/#1456 statute*, so this
is a **low-divergence confirmation**, not a wide-open Med-high fork; re-labelled as such + the two genuinely-new
outputs (#97-on-record, robustness rider) foregrounded. Config-dimension re-route **failed** (A/B is a
design-time per-block rule keyed to *primary consumer need*, not an author-flippable per-instance knob).
**Pass-1 (merit):** default (a) **stands** — beat the `display:contents`-makes-persistent-badge-free attack
(box erased, but node/AX/content-model/selector cost remains > zero-wrapper transient); the over-stated "full
layout cost" was corrected in (b). **Pass-2 (statute-overlap):** SURVIVES — no collision with
`native-first-baseline` / `persistent-b-data-source` / `config-extends-platform-default`; but the `codifiedIn`
target was a **dangling `§7.7`** — fixed to *Packaging governance item 7 (#1381)*. **Pass-3 (citation-scope):**
the #97 reading is faithful (used to kill `is=` and show #97 is *silent* on family A, never stretched to
"authorize" self-erasure); the single-substrate floor is scoped to `is=`, not the timing question; but the
rider's "already satisfied" claim was **false on the `isConnected` leg** (`TransientElement` has no `isConnected`
guard) — corrected to a real new requirement. Net: posture (a) ratified-shape; four amendments folded in.

## Context (the grounded analysis — below the call)

### The WebKit #97 argument, and what it actually condemns

WebKit's position ([standards-positions #97](https://github.com/WebKit/standards-positions/issues/97), closed,
`oppose`; `rniwa`/`annevk`) opposes **customized built-ins** because: form-associated custom elements solve the
form-control case better; `ElementInternals`/`ARIAMixin` give autonomous elements good a11y; customized
built-ins can't access shadow/`ElementInternals` (*"second-class"*); they can't have good built-in a11y
(*"logically different from the element they extend"*); progressive enhancement *"falls short"* (child elements
are HTML's established fallback — `canvas`/`picture`); the `is=` syntax violates the Priority of Constituencies;
only the HTML-**parser** case (`td`/`template`) is retained, to be solved differently
([whatwg/html#8114](https://github.com/whatwg/html/issues/8114)). The community counter (WebReflection) argues
`is=` gives best-a11y-free + no-FOUC + works-without-JS; romainmenke counters that async JS leaves elements
*"un-upgraded … behaving as native elements before being customized."*

**Why this bears on self-erasure, not just `is=`:** every objection is about customizing an existing native
element *in place*. The transient element is a **third thing** — it *emits* a real native element and deletes
itself. WebKit's constructive rec (persistent host + `ElementInternals`) is an argument for **family B** and for
*owned near-native* semantics on an element you **keep** — it does not deliver a *true native element*. So #97
**reaffirms** the §7 cut (persistent where you need owned semantics) rather than condemning family A.

### The genuine counter-weight (the real either/or)

Self-erasure was chosen for real reasons `ElementInternals` does not replace: a transient element leaves a
**true native element** (free focus/activation/form/AT — all *re-implemented by hand* on a persistent host);
**zero wrapper** (no extra node to fight in CSS/layout — the exact problem Astro is removing from
`<astro-island>`); **progressive-enhancement/SSR** (degrades to plain native HTML with no JS). So the call is
real: *true-native-but-self-erases* vs *persistent-host-but-only-near-native* — decided on **how much that one
property is worth** against the detached-node / unsanctioned-deletion cost, *per the discriminator above*.

### Composition cost — mis-attributed to transient (category check)

| Need | Web-native answer | Adds a node? |
|---|---|---|
| Compose **N behaviours** onto one element | **`CustomAttribute` mixin** (35+ in FUI, WeakMap out-of-band) | **no** — the real zero-node composition primitive |
| Attach behaviour to an **existing native** element with no wrapper | customized built-in `is=` | no — **but dead in Safari (#97)** |
| Emit a **true native element** with no wrapper in the output | **transient self-erasure** | the node exists, then is **deleted** |

Transient is the **third** row — a **1:1 node-elimination** (author `<we-button>` → emit one `<button>`), not a
stacking mechanism (you cannot nest 10 transient layers onto one node). So *"the web has no zero-DOM
composition, so we self-erase"* is **mis-attributed**: behavioural depth already composes node-free via
`CustomAttribute`, and deep *structural* composition is **#1963 Fork 2's** turf. Strip the composition argument
away and transient's justification is exactly the one property in §*the genuine counter-weight*. The full
seven-cost enumeration of an added DOM level (layout/content-model/AX/selector/tree-walk/engine/shadow) lives in
the [survey report](../reports/2026-06-29-transient-self-erasure-concept-viability.md) and underpins #1963's bar.

## Relationships

- **Reconsiders** the ratified transient pattern,
  [we:block-standard.md → Packaging governance, item 7](../docs/agent/block-standard.md) (#1381) — a Tier-0
  statute; a ruling here **amends or reaffirms** it (the recommended default reaffirms, adding the robustness
  rider + the #97 reconciliation). On resolve, `codifiedIn` → that *Packaging governance item 7* anchor (there is
  **no** §7.7 sub-section — skeptic pass-2 caught the dangling citation).
- **Case 1's facet of [#1963](1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md)** — which
  already found emit-to-native (transient) is *full parity* for behaviour-free leaves and delegated the mechanism
  choice here. **`blockedBy: #1963`** — this card *resolves under #1963's framework-parity bar* (a hard
  prerequisite: the bar + the budgeted-host-node spine must lock before case 1 is ratified against them). The
  edge is **one-directional and acyclic**: #1963 only *delegates* case 1 here (it does not decide it), so #1963
  can ratify its bar + cases 2–10 first, then this card ratifies case 1 under the locked bar — settling #1963's
  delegated case-1 row (the #581 delegated-fork pattern). **Ratify #1963 first, then #1962.**
- **Higher-altitude than #1960 / #1961**, which *mitigate* the current pattern. **No `blockedBy` edge** — those
  mitigations stand and ship regardless. If this card ruled **(c) abandon** it would supersede them; the
  recommended **(a) reaffirm** keeps them the live contract.
- **Statute reconciliation:** the discriminator refines §7's per-block rule (#1381) on the *same turf* — stated
  as a reaffirmation, not a rival; consistent with [native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline)
  (transient leaves a real native element = **single substrate**, no shim) and the persistent-B cluster
  (#1456/#1457). No statute collision (skeptic pass-0/2).
