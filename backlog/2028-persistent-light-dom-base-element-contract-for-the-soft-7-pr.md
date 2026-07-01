---
kind: decision
parent: "2015"
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
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

## RULING (2026-07-01)

**Per-leaf shape by the reproducibility test.** All five *presentational* leaves (**badge, tag, card, section-card,
auto-heading**) are **host-is-the-node**: the `<we-*>` custom element carries the `.fui-*` class and its role/aria
via `ElementInternals`, with **zero sub-element**. **progress** and **meter** **wrap a real native child**
(`<progress>`/`<meter>` inside a `display:contents` host) — irreplaceable native, #1962 FIXED. The base class ships
a `childTag()` hook (`null` → host-is-node; a tag → wrap-child); badge is the pilot.

**The general rule this instantiates (the reproducibility test).** A block wrapping a native tag picks its shape by
what the native element *contributes* — three buckets:
1. **Host-reproducible** (semantics = role + ARIA only) → **host-is-node** via `ElementInternals`. Aligns with the
   budgeted-host-node spine (we:block-standard.md:384-387, [link](../docs/agent/block-standard.md#L384)).
2. **Irreplaceable-native** (unique rendering/interaction) → **persistent wrapper containing a real child** (#1962's
   (B)).
3. **Content-model-constrained** (parent accepts only the real tag) → the **reserved transient** break-glass (#1962's
   (A)).

The exhaustive tag-by-tag classification is **spun off** (not owned here) so #2028 stays the lean #1974 unblocker —
see Follow-ups. Full discussion in *Fork 1* below.

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

**Settled (not re-litigated here).** #1962 barred exactly two things for these leaves: **self-erasure** (transient
is demoted to a reserved break-glass mechanism) and, for **irreplaceable-native** blocks, it FIXED "a persistent
wrapper *containing a real native control*" (we:block-standard.md:390-392,
[link](../docs/agent/block-standard.md#L390)). That's the whole of the statute here. **Correction (2026-07-01,
this session):** an earlier draft of this item read #1962/#1974 as ratifying **wrap-child for all seven** ("native
tag *inside* a persistent host") and declared the host-styles-itself branch *statute-barred*. That was an
**overread** — #1974's phrasing, not #1962's ruling. The "(B) contains a real native control" rule governs
*native-control / irreplaceable-native* blocks (form controls, `<progress>`, `<meter>`); it says nothing about
whether a **pure presentational leaf** (badge/tag/card) must nest an inner tag. (Verified by re-reading #1962's
live ruling text against the earlier citation, per the "check ratified-#NNNN claims against live status" discipline.)

**What the standard actually prefers.** The composition rubric's **budgeted-host-node spine**
(we:block-standard.md:384-387, [link](../docs/agent/block-standard.md#L384)): *"the host node is the API surface …
budget it: pay a registered host only for [slot/AX-identity/lifecycle], route everything else through a zero-node
mechanism."* For a presentational leaf that means: **the custom-element host *is* the styled/semantic node** (class
+ `ElementInternals` role/aria), adding **no** sub-element — unless the semantic can't be reproduced on a custom
element, in which case a real native child is required.

**Left open (the genuine fork #2028 owns).** Per leaf: is the host itself the node (zero sub-element), or must it
contain a real native child? The answer splits by reproducibility — see Fork 1. The earlier "uniform vs
box-conditional `display:contents`" framing is **moot for the host-is-node leaves** (a host that is the node has no
box-of-its-own question; `display:contents` only arises where a real child *is* nested — progress/meter).

## Standing test on the three sub-questions

| Sub-question | Verdict |
|---|---|
| **Q1 host-is-the-node vs wrap-a-native-child** | **THE open fork** (`## Fork 1`) — *reopened 2026-07-01*. #1962 did **not** settle it for presentational leaves (see *What #1962 settled*); the budgeted-host-node spine actively prefers host-is-node. Splits per leaf by whether the semantic is host-reproducible. |
| **Q2 where role/aria/naming/CEM land** | **Derived from Q1.** host-is-node → role/aria on the **host** via `ElementInternals`; wrap-child → on the native child (where they are today — fui:BadgeElement.ts:43, fui:Progress.ts:71). CEM documents the host (the custom element is the API) in every branch. |
| **Q3 `display:contents` on the host** | **Only relevant to wrap-child leaves** (progress/meter). A host-is-node leaf has no separate box to make transparent. |
| **Q4 regression surface** | **Grounding, not a fork.** No `.fui-badge >`/`querySelector('.fui-badge')` consumers exist (grep, both repos); the change is node-count/role-locus only. Pilot verification scope. |

## Glance table

Shape is per-leaf, keyed to whether the host can reproduce the semantic (Fork 1). host-is-node = the
`<we-*>` element carries the class + `ElementInternals` role/aria, **no** sub-element. **Ruling: all five
presentational leaves are host-is-node; only progress/meter wrap** (they are irreplaceable native).

| Leaf | Native tag today | Host-reproducible semantic? | Shape |
|---|---|---|---|
| badge | `<span class="fui-badge">` role=status | **yes** (span carries no inherent semantics) | **host-is-node** — `<we-badge class>` + `internals.role=status` |
| tag | `<span class="fui-tag">` decorative | **yes** (no role at all) | **host-is-node** — `<we-tag class>` |
| card | `<article class="fui-card">` | **yes** (`internals.role=article`) | **host-is-node** |
| section-card | `<section class="fui-card">` | **yes** (`internals.role=region`+name) | **host-is-node** |
| auto-heading | `<hN>` | **yes** (`internals.role=heading`+`ariaLevel`) | **host-is-node** — see tooling consequence |
| progress | `<div><progress>` | **no** — cannot reproduce `<progress>` on a custom element | **wrap real `<progress>`** (#1962 FIXED) |
| meter | `<div><meter>` | **no** — cannot reproduce `<meter>` | **wrap real `<meter>`** (#1962 FIXED) |

**auto-heading tooling consequence.** Under host-is-node the heading is a `role=heading`+`aria-level` custom element,
not a real `<hN>`. The a11y headings list (screen-reader rotor) is fed by ARIA-role headings the same as real tags,
so **a11y is unaffected**. What changes: DOM tooling that scrapes `h1`–`h6` by tag misses it. The ratified stance
(2026-07-01) is **build role-aware tooling** — read `[role=heading]`/`aria-level`, not the tag — which is correct
regardless (it also catches ARIA headings). One live consumer today: we:src/_layouts/base.njk:319
([link](../src/_layouts/base.njk#L319)), the WE-website TOC extractor (`h.querySelector('h1…h6')`); plateau-app
gets role-aware tooling as it needs it. This becomes a follow-up item at closeout (no generic base/reset-stylesheet
concern exists — WE/FUI style through the platform theme-base + intents system, keyed to component/token, never
generic `h1–h6` selectors).

For the two wrap-child leaves (progress/meter) the host sets `display:contents` (transparent box) so the real child
participates in flex/grid directly — the only place the old "uniform vs conditional `display:contents`" question
survives, and there it is unconditional (`contents` always).

## Fork 1 — host-is-the-node, or wrap a real native child? (per leaf, by reproducibility)

The base class must support **both** shapes because the seven leaves genuinely split:

- **(A) host-is-the-node.** The `<we-*>` custom element *is* the presentational node: the `.fui-*` class goes on the
  host, role/aria via `attachInternals()` + `internals.role`/`internals.aria*` (the mechanism already shipping at
  fui:declarativeComponent.ts:101-120), author children stay in place. **Zero sub-element.** This is the
  budgeted-host-node spine's zero-node ideal. Correct for **badge, tag** unconditionally — a `<span>` carries no
  inherent semantics, so `<we-badge role=status>` is a11y-identical to `<span role=status>` with one fewer node.
- **(B) wrap a real native child.** The host contains a real native tag and sets `display:contents` (transparent
  box, child participates in flex/grid directly). **Required** for **progress, meter** — you cannot reproduce a real
  `<progress>`/`<meter>` (native value semantics, bar rendering, `aria-valuenow`) on a custom element; #1962's
  irreplaceable-native FIXED rule applies. role/aria stay on the real child, as today (fui:Progress.ts:71-72).

**The two open judgment calls (⚖ in the glance table):**

- **auto-heading** — `internals.role='heading'` + `internals.ariaLevel` reproduces the ARIA heading, but a real
  `<hN>` also joins the **document outline** and matches `hN {}` author CSS / tooling that keys off the tag.
  **Leaning (B) wrap real `<hN>`** — the outline/CSS coupling is a real win host-ARIA can't give.
- **card / section-card** — `internals.role='article'` / `='region'`(+name) reproduces the landmark; a real
  `<article>`/`<section>` is marginally more robust and needs no internals wiring. **Leaning (A) host-is-node**, but
  weak — could go (B) for the same outline-ish robustness reason as heading.

**Why this is the fork (not the old `display:contents` question):** with (A) there is no separate host box, so
"uniform vs conditional `display:contents`" never arises for those leaves; it only applies to the (B) leaves, where
it is unconditional (`contents` always, so the real child lays out directly). CEM documents the **host** custom
element (the authored API) in both shapes; fui:cemToRows.ts reads it unchanged. Q4 (regression): no
`.fui-badge >` / `querySelector('.fui-badge')` consumers in either repo, so the class-locus move is node-count only
for (A) leaves.

**Default (pending ratification, 2026-07-01):** badge/tag → **(A) host-is-node**; progress/meter → **(B) real
child** (forced); auto-heading → **(B) real `<hN>`**; card/section-card → **(A)** (weak lean). Net: five host-is-node
(badge, tag, card, section-card) + two forced wrap-child (progress, meter) + one wrap-child by judgment
(auto-heading) — i.e. **4 host-is-node / 3 wrap-child**, awaiting the two ⚖ calls.

### Reference base class + pilot DOM

The base class exposes a **per-leaf shape hook** so a leaf declares (A) or (B); the transient `decorate()` body
carries over unchanged onto whichever node ends up styled:

```ts
// fui:blocks/light-leaf/LightLeafElement.ts (new — the reference contract)
export default abstract class LightLeafElement extends HTMLElement {
  /** (A) host-is-node: return null (style the host, no child). (B) wrap-child: return the native tag ('progress', 'hN'…). */
  protected childTag(): string | null { return null; }
  /** Attributes NOT copied literally onto a wrapped child (config attrs). Unused in (A). */
  get excludedAttributes(): string[] { return []; }
  /** Apply class / role / aria to the styled node (host in (A), child in (B)) — the old transient decorate() body. */
  protected decorate(_node: HTMLElement, _internals?: ElementInternals): void {}

  #built = false;
  #internals?: ElementInternals;
  connectedCallback(): void {
    if (this.#built) return;                 // idempotent (custom elements can re-connect)
    this.#built = true;
    const tag = this.childTag();
    if (tag === null) {                       // (A) host-is-the-node — zero sub-element
      this.#internals ??= this.attachInternals();
      this.decorate(this, this.#internals);   // class on host; role/aria via internals
      return;
    }
    this.style.display = 'contents';          // (B) transparent host; real child lays out directly
    const el = document.createElement(tag);
    const excluded = new Set(this.excludedAttributes);
    for (const { name, value } of this.attributes) {
      if (name === 'is' || excluded.has(name) || name === 'style') continue;
      el.setAttribute(name, value);
    }
    el.append(...this.childNodes);
    this.decorate(el);                        // class/role/aria on the real child
    this.replaceChildren(el);
  }
}
```

Pilot — badge, the clearest (A) case:

```html
<!-- authored -->
<we-badge tone="success" status>Healthy</we-badge>

<!-- transient TODAY (host self-erases → bare span) -->
<span class="fui-badge fui-badge--success" role="status" aria-label="success: Healthy">Healthy</span>

<!-- (A) host-is-node: the host IS the badge; class on host, role via ElementInternals; NO span -->
<we-badge class="fui-badge fui-badge--success">Healthy</we-badge>
<!-- ^ internals.role = 'status'; internals.ariaLabel = 'success: Healthy' -->
```

**Pilot verification scope (Q4):** confirm CSS still matches (`.fui-badge` now on the host — check the stylesheet
selectors are element-agnostic, which they are: keyed to the class, no `span.fui-badge`), the computed a11y role is
`status` via internals, and no `.fui-badge` descendant/`querySelector` consumer breaks (none exist). `createBadge`
parity + `el.className` unit assertions may need repointing from the span to the host — that is the migration delta
to validate on the pilot before the #1974 sweep.

**Skeptic:** the *original* host-styles-itself-is-barred verdict **fell** on re-examination — it rested on reading
#1974's "native tag inside a host" as #1962 statute; #1962 only bars self-erasure and (for irreplaceable-native)
mandates a real contained control. The budgeted-host-node spine actively prefers host-is-node, so (A) is the
default *where the semantic is reproducible*; (B) is retained only where it must be (progress/meter) or earns its
node (auto-heading's document-outline coupling). No statute collision: #1962 fixed the *policy* (no self-erasure;
irreplaceable-native contains a real control); #2028 picks the *per-leaf node shape* #1962 left open for
presentational leaves. Residual risk: AT that mishandles `ElementInternals` role vs a real element — low; internals
role/aria is the WHATWG-endorsed host-ARIA surface FUI already ships.

## Relationships

- **Implements** [#1962](1962-transient-self-erasing-element-viability-as-a-concept-vs-the.md)'s ratified
  wrapper-first / light-DOM policy — this is the missing base-class contract, not a re-decision.
- **Unblocks** [#1974](1974-expose-transient-vs-light-dom-as-a-configurable-per-project-.md) (`blockedBy: #2028`):
  once the base class ships + a pilot lands, the soft-7 conversion is the mechanical size·3 slice it was scoped as.
- **Under** epic [#2015](2015-fui-migrate-transient-blocks-to-wrapper-first-1962-review-co.md) (FUI transient->
  wrapper migration); the retained `TransientElement` `isConnected` hardening stays with #2015, not here.

## Follow-ups surfaced in discussion (file at closeout)

1. **Role-aware heading tooling.** Repoint heading scrapers from tag (`h1–h6`) to `[role=heading]`/`aria-level` so
   host-is-node auto-headings are seen. Concrete consumer: we:src/_layouts/base.njk:319
   ([link](../src/_layouts/base.njk#L319)) (WE-website TOC); plus any plateau-app equivalent. Correct regardless of
   #2028 (also catches ARIA headings). *(task)*
2. **Visual page-hierarchy inspector.** A dev-browser/explorer tool that renders a page's heading + landmark tree
   live, reading `[role=heading]`+`aria-level` and landmark roles (not tags) — surfaces structure/skipped-level
   issues. Fits the dev-browser tooling family (epic #1522). *(story)*
3. **Smart / dynamic heading level (opt-in).** `<we-auto-heading>` computes its `aria-level` from sectioning-ancestor
   depth — the outline behaviour native HTML never shipped — trivial under host-is-node (set `internals.ariaLevel`,
   no tag swap). Ships as an **option**, not the default. *(story)*
4. **Native-element reproducibility taxonomy.** Classify all HTML tags into the three buckets above
   (host-is-node / wrap-real-child / content-model-constrained) as the reference block-packaging decision rule, so
   the catalog inherits one lookup instead of per-block judgment. Lives in the block-standard §7 / #1962 lineage.
   *(story)*
