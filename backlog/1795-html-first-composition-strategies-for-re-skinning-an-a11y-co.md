---
kind: decision
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "docs/agent/platform-decisions.md#composition-preserves-a11y-contract"
codifiedIn: "docs/agent/platform-decisions.md#composition-preserves-a11y-contract"
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-composition-strategies-prep-1795.md
relatedResearch: html-first-composition-strategies
tags: [composition, blocks, slots, configuration, html-first]
---

# HTML-first composition strategies for re-skinning an a11y-complete block

Designers bring many visual variations of one core component. Some are structural and warrant a new block; many are *mostly visual yet not purely CSS-achievable* — inject an icon, add a status badge, wrap a child in a popover, swap a sub-element. When WE already has an a11y-complete navigation pattern (the W3C APG Disclosure Navigation, git-tracked as the `we:demos/reveal-nav-conformance.ts` conformance demo), rebuilding it per variation is waste. React has a rich reuse menu (sub-component replacement, HOC/decoration, abstract-piece split, context config). **What is the HTML-first, standards-based set of strategies WE should offer for the same reuse** — and which are first-class, preserving the base block's a11y guarantees?

Prior art surveyed in [/research/html-first-composition-strategies/](/research/html-first-composition-strategies/).

## The rule, in one sentence

**If a variation needs to *change* the base block's a11y contract — different roles, focus order, or keyboard model — it's a new component. If it only *adds* to that contract (slots, decoration, scoped-replace), it's the same component, re-skinned.** The four sanctioned strategies below are exactly the add-only moves; the moment you'd override a role or rewire keyboard semantics you've left them, and you're authoring a distinct block. (The non-destructiveness invariant is the mechanism; this sentence is the test a developer applies.)

## Grounding digest

- **The motivating example is real, but it's a demo not yet a packaged block.** The W3C APG *Disclosure Navigation* pattern is git-tracked as a self-contained conformance demo (`we:demos/reveal-nav-conformance.ts` — button `[aria-expanded]` disclosure, plain `<a>` links with no `role=menuitem`, popover-synced, hover-intent layered). There is **no** reusable `nav-list` block / `NavListBehavior`+`NavSectionBehavior` classes in `we:blocks/` yet — the a11y logic lives inline in the demo. (This *sharpens* the vector-corpus gap below: there isn't even a packaged nav block to attach vectors to.)
- **Four of the five strategies map to web-platform primitives already in the tree** (the fifth is a convention):
  - **Slots** → shadow `<slot>` named+default, already the `<component>` authoring form (`we:blocks/renderers/component/__fixtures__/component-cases.ts`; lifecycle-slot directives at `we:blocks/renderers/jsx/directives.ts:74-80`). Native dynamic slotting via `HTMLSlotElement.assign()` / `slotAssignment:'manual'`.
  - **Sub-component replacement** (CustomLink analog) → scoped custom element registry + IDREF, governed by #854 (ratified, codified `#component-dc`). **Now a native primitive** (scoped registries default in Chromium 146 + Safari, whatwg/html#10854).
  - **Behavior/decoration** (HOC analog) → `CustomAttribute` — the most mature strategy, with real child-decorating examples that mutate host a11y state (`we:blocks/router/behaviors/RouteLinkBehavior.ts` sets `aria-current` on its host `<a>`).
  - **Context-driven config** → webinjectors IDREF (`we:_site/plugs/webinjectors/declarativeInjector.ts`) + webexpressions `{{ }}` (`we:conformance-vectors/text-node.vectors.ts`), over the resolved #1780 three-layer config carve.
  - **Abstract-piece split** → a userland *convention* (#023 distinct-tags, #715 tree-shakable webtraits), no WE primitive needed.
- **The a11y enforcement corpus is a gap.** A11y vectors exist (`we:conformance-vectors/presentation-a11y.vectors.ts`) but are **deck/slide-specific** — there is **no** nav/disclosure a11y vector suite, and the vector schema (`we:conformance-vectors/schema.ts:24-82`) judges a *standard's* contract, not a "base + slot P + decoration Q" composed tuple. Per the constellation rule the verifier/impl live in FUI/Plateau ([conformance-verifier-vs-subject], [we-zero-standard-implementation]).
- **Strategy 2's runtime is mid-migration.** #854's contract is ratified and #900 (naming) resolved, but #901's `graduatedTo` registry file is absent from HEAD and webregistries is being ported into FUI (open re-home items incl. `we:backlog/1483-…`, `we:backlog/1545-…`). Adopt the ruling; the build is **blocked-on the re-home**.

## The axis

The decision's surface ("which strategies, and where is a11y enforced") resolves into three distinct shapes once the fork-existence test runs. Most of the menu is **support-all** — slots, behavior-decoration, and the abstract-piece-split convention are composable first-class patterns that don't exclude each other; a designer slots an icon *and* decorates a child *and* (once unblocked) scoped-replaces a sub-part on the same block. Sub-component replacement is **support-but-blocked** (contract ratified #854, runtime re-homing to FUI). The *one* genuine either/or is narrower than the item first framed: **where the base block's a11y contract is owned** — composed over a single base block, or dissolved into a configure-one-block matrix. Context-driven configuration, listed as a peer strategy, is actually the *configure-one-block* branch of that fork for the **visual** case (it stays sanctioned for non-visual config) — so it folds into the fork rather than counting as a fifth support-all strategy.

## Recommended path at a glance

| # | Concern | Resolution | Default |
|---|---|---|---|
| **Fork 1** | Who owns the a11y contract for mostly-visual variation | (a) compose-over-base · (b) configure-one-block | **(a)** |
| Ratify | A11y preservation guarantee | forced invariant — contract-level non-destructiveness, single-sourced on the base | — |
| Support-all | Slots · behavior-decoration · abstract-piece-split | first-class composable patterns (+ scoped-replace, blocked on re-home) | — |

## Supported by default (not forks)

These are composable mechanisms — none excludes another, so each is sanctioned, not chosen between (per the support-all rule, the #756 lesson):

- **Slots** — first-class. Shadow `<slot>` for injecting icons/badges/popovers; imperative `HTMLSlotElement.assign()` for dynamic sub-component slotting. Seam: the `<component>` shadow-authoring form.
- **Behavior/decoration** — first-class, most mature. `CustomAttribute` attached to a child to decorate it (the HOC analog). Seam: `we:blocks/router/behaviors/RouteLinkBehavior.ts`-style behaviors. Constrained by the Ratify invariant below (add-only to the a11y surface).
- **Sub-component replacement** — sanctioned, **blocked on the webregistries FUI re-home**. Adopts #854's ratified scoped-registry+IDREF ruling (`#component-dc`); do not re-decide it here. Build gated on #901's runtime landing in FUI.
- **Abstract-piece split** — a userland *convention*, not a WE primitive: factor reusable internals so a new block recomposes them (#023 distinct-tags + #715 tree-shakable traits). WE ships nothing for it.
- **Context-driven configuration** — sanctioned for **non-visual** config only (locale, data source, feature flags), via webinjectors/webexpressions. For *visual* variation it is the excluded branch of Fork 1 (see below), not a free-standing strategy.

## Code examples (HTML-first)

One a11y-complete base — `<nav-item>` (a disclosure-nav part, per the `we:demos/reveal-nav-conformance.ts` pattern) — re-skinned four sanctioned ways. The forms are the *real* authoring seams in-tree; the base block's a11y surface is single-sourced and untouched in every case (the Ratify invariant).

**Base definition** — the `<component>` shadow-authoring form (`we:blocks/renderers/component/__fixtures__/component-cases.ts`); named + default `<slot>`s are the injection points:

```html
<component name="nav-item" shadow="open">
  <!-- a11y contract lives HERE, once: the <a>, focus, keyboard, aria are the base's job -->
  <a part="link"><slot name="icon"></slot><slot></slot><slot name="badge"></slot></a>
</component>
```

**1 · Slots** — inject an icon + status badge with zero forking; the base `<a>`/a11y is inherited as-is. Dynamic sub-component slotting uses `slotEl.assign(node)` under `slotAssignment:"manual"`:

```html
<nav-item href="/inbox">
  <svg slot="icon" aria-hidden="true">…</svg>
  Inbox
  <span slot="badge" aria-label="3 unread">3</span>
</nav-item>
```

**2 · Behavior/decoration** (HOC analog, most mature) — a `CustomAttribute` registered `attributes.define('route:link', RouteLinkBehavior)` (`we:blocks/router/registerRouter.ts:38`) decorates a child `<a>`; it *adds* `aria-current` on match (`we:blocks/router/behaviors/RouteLinkBehavior.ts:100`) and never strips base a11y:

```html
<nav-item>
  <a route:link href="/inbox">Inbox</a>   <!-- behavior adds aria-current="page"; add-only -->
</nav-item>
```

**3 · Sub-component replacement** (CustomLink analog — **blocked on the webregistries FUI re-home**) — a scoped custom-element registry + IDREF (#854, `#component-dc`) swaps the internal link element for an app's own, the base contract preserved:

```html
<scope registry="app-registry">
  <nav-item><a is="app-link" href="/inbox">Inbox</a></nav-item>  <!-- 'app-link' resolved in the scoped registry, not global -->
</scope>
```

**4 · Context-driven config** (non-visual only) — a declarative injector + webexpressions (`we:_site/plugs/webinjectors/declarativeInjector.ts:12-15`) wires locale/data, never visual structure:

```html
<script type="injector" id="locale">{ "lang": "fr" }</script>
<nav-item injector="locale">{{ t('inbox') }}</nav-item>
```

**Fork 1 contrast — the rejected (b) shape.** The test is a11y-contract ownership, so the offending attribute is one that *changes* the contract. Here `as="menubar"` switches the disclosure-nav into a menu pattern — it forces `role=menuitem`, a different arrow-key/focus model, different aria. That can't be reached add-only, so it's **structural → a new component**, not a config flag on the base:

```html
<!-- (b) configure-one-block — REJECTED: 'as' rewrites the a11y contract (disclosure-nav → menubar) -->
<nav-item as="menubar">Inbox</nav-item>
```

Note the all-visual prop matrix (`variant`/`density`/`badge-style`/`chevron`…) is a *separate* objection — it doesn't change a11y, so Fork 1 doesn't reject it; it's discouraged on the #023 config-matrix grounds (accretes variant code), and visual-only variation belongs in **theme tokens / CSS** or slots, not element attributes.

## Ratify — a11y preservation is a forced invariant (not a fork)

*Why not a fork:* the alternative (a composition strategy may override or remove the base's a11y surface) is **broken** — it defeats the decision's whole premise ("preserves the base block's a11y guarantees"). So this is a forced invariant to ratify, not an either/or.

**Invariant:** the a11y contract is **single-sourced on the base block**, and every sanctioned composition strategy must be **non-destructive** to it — a slot/decoration/replacement may *add* to the base's ARIA/focus/keyboard surface, never *override or remove* it. WE owns the **contract statement**; whether a given composed variant honors it is a **FUI/Plateau conformance-run concern**, not a WE-shipped per-strategy proof matrix (composed variants aren't expressible in `we:conformance-vectors/schema.ts:24-82`, and the verifier/impl live downstream). The build slice this opens is the contract statement **plus the missing nav-block a11y vector corpus** the base block itself needs.

`Skeptic: REFUTED-as-written → corrected` — the original "ship a conformance vector per strategy per composed block" was refuted: no nav a11y vectors exist (`we:conformance-vectors/presentation-a11y.vectors.ts` is deck-only), a composed tuple isn't expressible in the schema, and shipping a verifier-against-subject violates [we-zero-standard-implementation]. Folded to the contract-level non-destructiveness invariant WE *can* own.

## Fork 1 — who owns the a11y contract for mostly-visual variation

*Fork-existence:* a genuine either/or on **a11y-contract ownership** — the two branches put the contract in different places and cannot both be the default. The excluded branch (b) dissolves the single a11y contract into a per-config matrix, making conformance a combinatorial property instead of one block's responsibility; #023 already excluded the analogous droplist shape ("distinct tags, NOT one configurable element"). The branches compose only at a *boundary* (config may select presentation-only slots), not as a merge.

- **(a) compose-over-base (default)** — the a11y-complete base stays one block and owns its a11y contract; visual variation arrives by slotting, decorating, scoped-replacing a sub-part, or theme tokens. Variation that can't be expressed that way is *structural* → a distinct block. Config may *select which presentation-only slots appear* but never owns the contract.
- **(b) configure-one-block** — one block exposes a rich injected-config surface and renders many visual variants internally from config. Fewer tags, but the a11y contract becomes a config matrix (every combination must be re-proven), and the block accretes variant code — the shape #023 ruled against.

**Default: (a).** Argued on native-first + a11y-ownership merit *for the block-reskin case directly*: a single block owning one a11y contract is easier to keep conformant than a config matrix, and it composes cleanly with the Ratify invariant (add-only). #023 is cited as **analogy, not controlling precedent** (its ruling is droplist-trait-granularity-scoped). Consequence: context-driven config is for behavioral/data wiring, not visual restructuring.

`Skeptic: SURVIVES-WITH-AMENDMENT` — the fork is real, but two amendments folded: (1) reframed from a raw compose-vs-configure either/or to the **a11y-contract-ownership axis**, with the legitimate *config-selects-presentation-slots* overlap carved out explicitly (it's a boundary, not mutual exclusion); (2) **#023 demoted from controlling precedent to analogy** (droplist-scoped), so the default is argued on the reskin case's own native-first merit.

## What you decide

Ratify Fork 1 (default **(a)**) and the a11y non-destructiveness invariant, or override. The "first-class vs userland" classification and the support-all list are prepared above (not a fork). Resolving opens the build slices: a contract statement for composition non-destructiveness, the missing `nav-list` a11y vector corpus, and the four first-class strategy seams (sub-component replacement gated on the webregistries FUI re-home).

## Decision (ratified 2026-06-27)

**Fork 1 = (a) compose-over-base**, and **a11y non-destructiveness ratified as a forced invariant**.
The a11y contract is single-sourced on the base block; the four sanctioned strategies (slots,
behavior/decoration, sub-component replacement, abstract-piece split) are **add-only** to it.
Developer test: *a variation that must change the a11y contract (roles/focus/keyboard) is a new
component; add-only variation is the same block re-skinned.* Context-driven config is sanctioned for
non-visual wiring only. Codified as the standing rule `#composition-preserves-a11y-contract` in the
platform-decisions statute (see `codifiedIn`) — **cite that anchor, not this `#1795`**. Build slices
filed: #1832 (non-destructiveness contract statement) · #1833 (`nav-list` a11y vector corpus) · #1834
(the four strategy seams, scoped-replace blocked on the webregistries re-home) · #1835 (review current
block interfaces for compliance, blocked on #1832).

## Acceptance

- The sanctioned composition strategies and their seams are codified (rule or doc), with the support-all set + the Fork 1 default recorded.
- A11y non-destructiveness is stated as a contract-level invariant single-sourced on the base block; the verification home (FUI/Plateau) is named, not a WE per-strategy vector.
- Build slices filed: composition non-destructiveness contract, `nav-list` a11y vector corpus, strategy seams (scoped-replace marked blocked-on the webregistries re-home).
- `check:standards` green.
