---
kind: decision
parent: "2015"
status: open
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
relatedReport: reports/2026-07-01-2028-light-dom-base-element-contract.md
tags: [webcomponents, light-dom, display-contents, element-internals, transient-element, block-standard]
---

# Persistent light-DOM base-element contract for the soft-7 presentational leaves

#1974 (soft-7 light-DOM migration) pre-flight surfaced this. [#1962](1962-transient-self-erasing-element-viability-as-a-concept-vs-the.md)
ratified the POLICY (behaviour-free leaves are light-DOM, no self-erasure) but did NOT ship the concrete
base-element contract: all seven leaves still extend
[fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts) (self-erasing),
and there is **no persistent light-DOM base class** in `fui:blocks/`. This item fixes the reference shape so the
#1974 migration is mechanical. Soft-7 = **badge, tag, section-card, card, auto-heading, meter, progress**.

## Grounding digest

- **The self-erasing base** ([fui:blocks/transient/TransientElement.ts:53-76](../../frontierui/blocks/transient/TransientElement.ts#L53-L76)):
  `connectedCallback` resolves a native tag, transfers attrs + children onto a freshly-created native element,
  runs a `decorate(el)` hook, then `queueMicrotask(() => this.replaceWith(el))` — the host **vanishes**, leaving a
  bare native tag with zero wrapper. Guarded by `#replaced`; no `isConnected` guard (a #1961 gap, owned by #2015).
- **Two DOM families already exist among the soft-7** — and they are NOT symmetric:
  - **Bare-single-tag leaves** — badge/tag emit a bare `<span class="fui-badge …">`
    ([fui:blocks/badge/BadgeElement.ts:16-46](../../frontierui/blocks/badge/BadgeElement.ts#L16-L46)), auto-heading
    a bare `<hN>` ([fui:blocks/transient/AutoHeading.ts:40-81](../../frontierui/blocks/transient/AutoHeading.ts#L40-L81)),
    card/section-card a bare `<article>`/`<section class="fui-card">`
    ([fui:blocks/card/CardElement.ts:17-51](../../frontierui/blocks/card/CardElement.ts#L17-L51),
    [fui:blocks/card/SectionCardElement.ts:21-32](../../frontierui/blocks/card/SectionCardElement.ts#L21-L32)). The
    class + any `role`/`aria` land **on that single native tag**.
  - **Already-wrapping leaves** — progress/meter emit `<div class="fui-progress"><progress …>` /
    `<div class="fui-meter"><meter …>` ([fui:blocks/progress/Progress.ts:47-75](../../frontierui/blocks/progress/Progress.ts#L47-L75),
    ProgressElement `resolveTag()` returns `'div'`). **The real `<progress>`/`<meter>` is ALREADY a nested child;**
    transient only ever erased the outer `<we-progress>`.
- **role/aria today land on the native output, not the host.** Badge sets `role="status"` + tone `aria-label` on
  the span ([fui:blocks/badge/BadgeElement.ts:40-45](../../frontierui/blocks/badge/BadgeElement.ts#L40-L45));
  progress sets `aria-labelledby`/`aria-valuetext` on the real `<progress>`
  ([fui:blocks/progress/Progress.ts:71-72](../../frontierui/blocks/progress/Progress.ts#L71-L72)). Tag is
  decorative-only — no role by design
  ([fui:blocks/tag/TagElement.ts:10-13](../../frontierui/blocks/tag/TagElement.ts#L10-L13)).
- **A native-first host-ARIA mechanism ALREADY ships in FUI**, but is not wired into these leaves:
  declarativeComponent lowers `default-role`/`default-aria-*`/`states` → `attachInternals()` + `internals.role` /
  `internals.aria*` / `internals.states`
  ([fui:blocks/renderers/component/declarativeComponent.ts:101-120](../../frontierui/blocks/renderers/component/declarativeComponent.ts#L101-L120)).
  This is the WHATWG `ElementInternals` surface — a persistent custom element can carry real default ARIA with **no
  wrapper**.
- **CEM** — FUI generates a Custom Elements Manifest (`fui:custom-elements.json`) and consumes it in its
  props-table renderer ([fui:blocks/props-table/cemToRows.ts](../../frontierui/blocks/props-table/cemToRows.ts)).
  The CEM documents the **custom element** — the authored host — regardless of what it emits.
- **Consumer blast-radius is small.** There are **no** `.fui-badge >` descendant selectors and **no**
  `querySelector('.fui-badge')` in either repo (grep, WE + FUI). CSS is keyed to `.fui-badge` *on the styled node*;
  unit tests assert `el.className` on the built node. So keeping the class where `createBadge` puts it today
  ([fui:blocks/badge/Badge.ts:48](../../frontierui/blocks/badge/Badge.ts#L48)) leaves CSS + tests untouched.
  #1962's zero-wrapper→wrapper concern is a per-node-count change, not a selector break.

## What #1962 already settled — and what it left open

**Settled (not re-litigated here).** #1962 ruled the soft-7 "emit their natural native tag
(`<span>`/`<div>`/`<hN>`/`<progress>`/`<meter>`) **inside** a persistent, styleable, nameable host … a
`display:contents` wrapper where a box would break flex/grid"
([#1974:19-21](1974-expose-transient-vs-light-dom-as-a-configurable-per-project-.md), codifying
[#1962](1962-transient-self-erasing-element-viability-as-a-concept-vs-the.md) →
`we:docs/agent/block-standard.md#packaging-governance-1321`). "Native tag **inside** a persistent host" is
**wrap-child**: the host persists, the real native tag is its child. So the original framing of this item
("does the host **style itself** with `.fui-badge` + `internals.role`, OR wrap a native child?") is **already
decided in favour of wrap-child** — a host-styles-itself branch (host *is* the `.fui-badge` node) is
**statute-barred**. Two independent grounds confirm it (skeptic red-team, below): the a11y merit (§Fork 1) and
no blast-radius advantage (grounding digest).

**Left open (the genuine residual #2028 owns).** #1962 said "a `display:contents` wrapper **where a box would
break flex/grid**." It did **not** decide the base-class *default*: does **every** soft-7 host carry
`display:contents` (uniform shell, always adds a node), or **only** the box-breaking leaves — the inline-`<span>`
leaves (badge/tag) instead letting the host be a plain `display:inline` styleable node with the native tag inside?
That is a real base-class-shape fork with an a11y edge and a DOM-node-count edge. That — plus building the base
class + piloting one leaf — is the whole of #2028.

## Standing test on the three sub-questions

| Sub-question | Verdict |
|---|---|
| **Q1 host-styles-itself vs wrap-native-child** | **NOT an open fork** — #1962 ratified wrap-child ("native tag inside a persistent host"). Grounding as statute, not a `## Fork`. The residual (below) is *within* wrap-child. |
| **Q1′ (residual) `display:contents` on every host vs only box-breaking leaves** | **Genuine fork** → `## Fork 1`. Two coherent branches (uniform shell vs minimal-node) can't both be the default; the excluded branch is whichever loses. |
| **Q2 where role/aria/naming/CEM land** | **Derived, not a fork.** Under wrap-child, role/aria land on the native child (where they already are — fui:BadgeElement.ts:43, fui:Progress.ts:71); CEM documents the host (the custom element is the API) in every branch. Folded into Fork 1 as a consequence line, not a `## Fork`. |
| **Q3 zero-wrapper→wrapper regression surface** | **Grounding, not a fork.** No `.fui-badge >`/`querySelector('.fui-badge')` consumers exist; the change is node-count only. Treated as the pilot's verification scope. |

## Glance table

| Leaf | Native tag today | Already nested? | Needs its own box? | Recommended host |
|---|---|---|---|---|
| badge | `<span class="fui-badge">` | no (bare) | inline — no | `display:inline` host, `<span>` inside |
| tag | `<span class="fui-tag">` | no (bare) | inline — no | `display:inline` host, `<span>` inside |
| auto-heading | `<hN>` | no (bare) | block, semantic | `display:contents` host, `<hN>` inside |
| card | `<article class="fui-card">` | no (bare) | block/landmark | `display:contents` host, `<article>` inside |
| section-card | `<section class="fui-card">` | no (bare) | landmark | `display:contents` host, `<section>` inside |
| progress | `<div class="fui-progress"><progress>` | **yes** | block | `display:contents` host, `<div>` inside |
| meter | `<div class="fui-meter"><meter>` | **yes** | block | `display:contents` host, `<div>` inside |

## Fork 1 — `display:contents` on every host, or only where a box would break flex/grid?

**Fork exists (#819):** both branches ship a persistent light-DOM base class emitting a real native tag inside the
host; they diverge on the host's *own* box, which changes both the a11y-tree exposure of role-bearing leaves and
the emitted node count — one branch must be the base-class default.

- **(a) Uniform `display:contents` on every host.** The base class always sets the host to `display:contents`; the
  inner native tag is the only box. Simple, one rule. **Cost — the a11y hazard:** `display:contents` historically
  dropped the element from the accessibility tree; that was an Interop-2024 focus and is **fixed in Chrome (115,
  after a 113 regression) and Firefox**, but **Safari 17 (Sept 2023) still breaks buttons and headings** under
  `display:contents`. For badge in status mode (`role="status"`) and auto-heading (`<hN>`), a `display:contents`
  **host** wrapping the role/heading node risks Safari dropping it. Since the *role lives on the inner tag* here
  (not the host), the host being `display:contents` should be inert — but the Safari heading/button bug is exactly
  in this zone, so this branch is the riskier one for the two role/heading leaves.
- **(b) `display:contents` only where a box would break flex/grid; inline/plain host otherwise (bold default).**
  Badge/tag hosts are `display:inline` real nodes carrying nothing but layout-transparency; auto-heading/card/
  section-card/progress/meter hosts are `display:contents`. **This is #1962's literal text** ("where a box would
  break flex/grid") and it keeps the a11y-sensitive leaves off the pattern with the least-settled Safari support
  for exactly the inline leaves that never needed it. Slightly more per-leaf config (a `display` policy hook on the
  base class), but the base class already needs a per-leaf `resolveTag()`; adding a `hostDisplay` getter is the
  same shape.

**role/aria/naming/CEM (Q2, derived):** role/aria land on the **native child** in both branches — that's where
they already are (fui:BadgeElement.ts:40-45, fui:Progress.ts:71-72), and no host `ElementInternals` is needed
because the child is a real native tag with real semantics. Naming: the accessible name is the child's
text/`aria-label` as today. CEM documents the **host** custom element (the authored API) in both branches;
`fui:cemToRows.ts` reads it unchanged. The FUI `ElementInternals` mechanism (fui:declarativeComponent.ts:101-120)
is **not** used by these leaves — it is the host-styles-itself path that #1962 barred; recorded here only to show
host-ARIA was available and still not chosen.

**Default: (b).** It is #1962's ratified phrasing, it minimises Safari `display:contents` exposure for the two
role/heading leaves, and it adds no node where none is needed (inline leaves). (a)'s only win is uniformity, which
a one-line `hostDisplay` getter neutralises.

### Reference base class + pilot DOM (default (b))

Base class — a persistent light-DOM sibling of `TransientElement` (does **not** self-replace):

```ts
// fui:blocks/light-leaf/LightLeafElement.ts (new — the reference contract)
export default abstract class LightLeafElement extends HTMLElement {
  /** The real native tag this leaf renders INSIDE the persistent host (e.g. 'span', 'article', 'div'). */
  abstract resolveTag(): string;
  /** Host's own box: 'contents' erases it (block/landmark leaves); 'inline' for bare inline leaves. */
  protected get hostDisplay(): 'contents' | 'inline' { return 'contents'; }
  /** Config attributes NOT copied literally onto the native child. */
  get excludedAttributes(): string[] { return []; }
  /** Map config -> native child (classes, role, aria) — same body the transient decorate(el) had. */
  protected decorate(_el: HTMLElement): void {}

  #built = false;
  connectedCallback(): void {
    if (this.#built) return;            // idempotent (custom elements can re-connect)
    this.#built = true;
    this.style.display = this.hostDisplay;   // host stays; no replaceWith, no queueMicrotask
    const el = document.createElement(this.resolveTag());
    const excluded = new Set(this.excludedAttributes);
    for (const { name, value } of this.attributes) {
      if (name === 'is' || excluded.has(name) || name === 'style') continue;
      el.setAttribute(name, value);
    }
    el.append(...this.childNodes);      // move author children into the native child
    this.decorate(el);                  // role/aria/classes land ON el (the native child)
    this.replaceChildren(el);           // host now contains exactly the one native tag
  }
}
```

Pilot — badge (`hostDisplay = 'inline'`, since a `<span>` badge never breaks flex/grid):

```html
<!-- authored -->
<we-badge tone="success" status>Healthy</we-badge>

<!-- transient TODAY (host vanishes, bare span) -->
<span class="fui-badge fui-badge--success" role="status" aria-label="success: Healthy">Healthy</span>

<!-- default (b): persistent host, styled span inside; class + role stay on the span, unchanged -->
<we-badge style="display:inline">
  <span class="fui-badge fui-badge--success" role="status" aria-label="success: Healthy">Healthy</span>
</we-badge>
```

The `.fui-badge` class, `role`, and `aria-label` sit on the **same span** as today, so CSS + `createBadge` parity +
unit assertions on `el.className` all survive. The only DOM delta is the surviving `<we-badge>` host (node-count),
which no selector in either repo targets. Contrast (a): identical except `style="display:contents"` on the host —
functionally the same for badge, but on the pattern Safari mishandles for the neighbouring `role`/heading leaves,
which is why (b) is the safer catalog-wide default.

**Skeptic:** attack SURVIVED on the *original* framing (host-styles-itself was statute-barred by #1962 +
Safari-a11y + moot blast-radius) and the item is re-scoped accordingly; the *residual* Fork 1 (uniform vs
box-conditional `display:contents`) holds as the one genuine call, with (b) tracking #1962's literal text and the
lower Safari exposure. Q2 confirmed derived (role/aria already on the child; CEM on the host either way); Q3
confirmed grounding (zero `.fui-badge` consumers). No statute collision: #1962 codified the *policy*, this fixes
the *base-class default* #1962 left explicitly conditional ("where a box would break flex/grid").

## Relationships

- **Implements** [#1962](1962-transient-self-erasing-element-viability-as-a-concept-vs-the.md)'s ratified
  wrapper-first / light-DOM policy — this is the missing base-class contract, not a re-decision.
- **Unblocks** [#1974](1974-expose-transient-vs-light-dom-as-a-configurable-per-project-.md) (`blockedBy: #2028`):
  once the base class ships + a pilot lands, the soft-7 conversion is the mechanical size·3 slice it was scoped as.
- **Under** epic [#2015](2015-fui-migrate-transient-blocks-to-wrapper-first-1962-review-co.md) (FUI transient->
  wrapper migration); the retained `TransientElement` `isConnected` hardening stays with #2015, not here.
