---
kind: decision
parent: "1287"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#identity-semantic-look-composable"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-project-include-we-card-migration.md
relatedProject: webblocks
tags: [we-card, semantic-style-separation, root-agnostic, base-flavor, dogfooding, platform-principle]
---

# Card is a root-agnostic structure+style applied to a native element — we-card = the article binding, not element-polymorphic; FUI base + flavor values

## Digest

The governing decision behind the `we-card` work: a card is **not** a semantic element — it is a composable
structure+style applied **to** a native-semantic element. `we-card` = the binding to an `<article>` root; a
`<section>` that wants the card look keeps `<section>` and wears the card *style*. The surface is tokenized:
FUI ships one neutral base, flavors supply values, the assembler composes. Two forks to ratify (both already
grounded in shipped code, so a fast ratify): **Fork 1** — root-agnostic composition, rejecting an
*extrinsic author-fiat* `<we-card as>` (but **not** the intrinsic, content-driven polymorphism `we-button`
already ships); **Fork 2** — the look lives as a FUI tokenized base + product/flavor values, not hardcoded in
core. On resolve, codify the principle to `we:docs/agent/platform-decisions.md`.

## The principle (codify on resolve)

**A component's *identity* is its semantic element; its *look* is an orthogonal, composable style layer applied
to that element. Visual similarity is never semantic identity.** Two consequences:

1. **Different semantic value ⇒ different element** (`we:docs/agent/platform-decisions.md` "name by semantics,
   not by uniformity"; the role/variant/annotation minting contract — *different arrangement → distinct entity;
   different look, same arrangement → variant*). A card (`<article>`, self-contained composition) and a section
   (`<section>`, thematic region) have different semantic value → different elements. They may share a *look*;
   that shared look is a **style**, not a shared element.
2. **Native elements are the semantic standards; WE recognizes, it does not re-mint.** Thought experiment that
   settles it: *if HTML had no `<article>`/`<section>`, would WE mint standards for them? Yes.* So they are
   semantic standards the platform already provides — native-first means WE recognizes them and builds the
   orthogonal style layer on top, never wraps a custom element around a sufficient native one.

## What the card is

- **A root-agnostic structure+style standard** — structure = a titled surface (header/body/footer slots, per
  `fui:blocks/card/Card.ts`); style = a tokenized surface (border/radius/background/elevation). It carries **no
  semantic identity of its own** — it is *applied to* a root element that supplies the semantics.
- **`we-card` = the card bound to an `<article>` root** — the common-case declarative convenience: `CardElement
  extends TransientElement`, `resolveTag(): 'article'` (`fui:blocks/card/CardElement.ts:17-21`), so `<we-card>`
  is **transient** — it erases itself, leaving `<article class="fui-card">`. This is composition: `we-card` does
  **not** subclass/extend `<article>`; it is "card-composition with an `<article>` root."
- **NOT extrinsic-author-polymorphic.** A single `<we-card as="section|article">` is rejected (Fork 1). To put
  the card look on a `<section>`, keep the native `<section>` and apply the card *style* via its style hook
  (`.fui-card`, `fui:blocks/card/Card.ts:34`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| **Fork 1 — what is the card?** | **Root-agnostic structure+style (composition); reject *extrinsic author-fiat* `as=`** | Element-polymorphic `<we-card as>` (author overrides the root) | High |
| **Fork 2 — where does the look live?** | **FUI tokenized neutral base + product/flavor values; assembler composes** | Hardcode the look in FUI core (design-system warehouse) | High |

*(Codifying the principle is the resolve action — `--codified-to` — not a third fork: there is no coherent "do
not codify" branch.)*

## Fork 1 — root-agnostic structure+style, or a concrete polymorphic element?

*Fork-existence:* the excluded branch is the **extrinsic author-fiat** `<we-card as="section|article">` — one
custom-element name whose DOM root is chosen by an author *override* that can contradict the element's own
content. It is excluded on **native-first** grounds, not on a blanket "polymorphism is forbidden" (which the
shipped tree refutes — see the amendment). The genuine either/or: a card is *root-agnostic composition* (the
author writes the right native root and applies card structure+style) **vs** a *polymorphic custom element*
whose root is an authored attribute.

- **Root-agnostic structure+style (composition) — RECOMMENDED.** The card is a structure+style recipe applied
  *to* a native-semantic root. `we-card` is the declarative convenience bound to `<article>`
  (`fui:blocks/card/CardElement.ts:19-21`); a `<section>` that wants the look keeps `<section>` and wears the
  card style. Optional per-root bindings (`we-card`, and *if* declarative ergonomics earn it, a separate
  `we-section-card`) are allowed as **FUI packaging** — a packaging/impl call, not a new semantic standard,
  and **not** a forced combinatorial explosion (the primary path is "native element + card style", O(1)).
- **Extrinsic-author-polymorphic `<we-card as="section|article">`** — *Rejected.* It imports React's
  `as=`/`component=` idiom, which exists because JSX has **no native-element-erasure mechanism** — the
  polymorphic prop *is* their transient. WE already has that mechanism (`TransientElement`), so `as=` solves a
  constraint WE does not have; the author can simply *write `<section>`* and add the card style. Worse, an
  author-fiat root decouples the DOM identity from the element's content (the anti-pattern principle (1)
  targets). *Native-First Default applies: align to the platform, don't import a bundler-era workaround.*

**Amendment (skeptic-folded): reject *extrinsic author-fiat* `as=`, not polymorphism per se.** The shipped tree
already ships **intrinsic, evidence-based** polymorphism and it is correct: `ButtonTransientElement.resolveTag()`
returns `this.hasAttribute('href') ? 'a' : 'button'` (`fui:blocks/button/ButtonTransientElement.ts:17-18`) — one
`we-button` resolving to `<a>` or `<button>` from its *own* `href`, a bigger semantic gulf (link vs button) than
article vs section. The real line is **who chooses the root**: *intrinsic evidence* (the element reads its own
content/attrs — `we-button`'s `href→a`) is **blessed** (native-first, the DOM identity follows the content);
*extrinsic override* (`as=` lets the author force a root that may contradict content) is **rejected**. Stating
the rule as "polymorphism forbidden" would wrongly condemn `we-button`; stating it as "intrinsic-yes /
author-fiat-no" is the defensible, code-consistent line. **Concrete style hook (also folded):** "section + card
style" must be ergonomic, so the card's style hook is the named class `.fui-card` (`fui:blocks/card/Card.ts:34`
`BASE_CLASS`, `:90` `CARD_CSS`) — `<section class="fui-card">`, not hand-rolled bespoke CSS.

*Code example (Fork 1 — the blessed shapes vs the rejected one):*

```html
<!-- RECOMMENDED: card-composition on its default <article> root (we-card is transient → <article class="fui-card">) -->
<we-card heading="Quarterly report"> … </we-card>

<!-- RECOMMENDED: a <section> wears the card LOOK by applying the style hook — same look, honest semantics -->
<section class="fui-card"> … </section>

<!-- BLESSED intrinsic polymorphism already shipped (root from the element's OWN content, not author fiat) -->
<we-button href="/x">Open</we-button>   <!-- resolveTag(): href ? 'a' : 'button'  (fui:blocks/button/ButtonTransientElement.ts:17) -->

<!-- REJECTED: extrinsic author-fiat root override — one element name, root chosen by attribute -->
<we-card as="section"> … </we-card>     <!-- ✗ use <section class="fui-card"> instead -->
```

*Skeptic: SURVIVES-WITH-AMENDMENT — the core call (root-agnostic composition, reject `<we-card as>`) held: on
native-first grounds `as=` is React's workaround for a constraint WE lacks (`TransientElement` erases roots
already), and a transient leaves no durable custom-element identity to be ambiguous. But the original rationale
"polymorphic single element is forbidden by principle (1)" was **refuted** by the shipped `we-button`
(`fui:blocks/button/ButtonTransientElement.ts:17-18`, `href?'a':'button'`); folded the fix — reject *extrinsic author-fiat* root
override, bless *intrinsic evidence-based* resolution — and specified the `.fui-card` style hook
(`fui:blocks/card/Card.ts:34`) so the "section + card style" path is ergonomic, not bespoke.*

## Fork 2 — where does the surface look live?

*Fork-existence:* the excluded branch is **hardcoding the look in FUI core** (FUI as a design-system warehouse
shipping a fixed register). It is excluded because FUI is a *customizable base*: a hardcoded register can't be
reskinned without forking CSS, which the whole token indirection exists to avoid.

- **FUI tokenized neutral base + product/flavor values; assembler composes — RECOMMENDED.**
  - **WE** — the card *contract*: root-agnostic structure + that it is surface-styleable. No values.
  - **FUI** — the *base* card: structure + behavior + a tokenized neutral surface. The base **already exists**
    and is already token-driven — `CARD_CSS` is written as `var(--color-border, …)`, `var(--radius-md, …)`,
    `var(--color-surface-card, …)` (`fui:blocks/card/Card.ts:90-103`), reskinnable by *setting tokens*, never
    forked. "Ship plain tokens now" **is** this layer.
  - **Flavor (product layer)** — token *values*. A docs-site look = its flavor; Material-like = another. The
    **Plateau assembler** composes/authors flavors (per Managed-Offering constellation layering:
    standard→WE, primitives→FUI, product→plateau).
  - Shipping many reference flavors is a *regression harness*, but the breadth of looks lives in the
    flavor/product layer + assembler. *(How many reference flavors ship is out of scope here.)*
- **Hardcode the look in FUI core** — *Rejected.* Bakes a single register into the base, so every app that wants
  a different look forks the CSS — the opposite of the `var(--token, fallback)` indirection already shipped
  (`fui:blocks/card/Card.ts:90`).

*Skeptic: SURVIVES — the "three-layer split is premature over-engineering / no consumer" attack collapsed on the
real tree: layer-1 (tokenized base) **already exists** as `CARD_CSS` (`fui:blocks/card/Card.ts:90-103`) and *is* the "plain
tokens now" the attacker wants; layers 2–3 are an **ownership boundary** (constellation layering), not three
artifacts that must be built now — the default explicitly ships **zero** flavors. Verified 0 card flavors exist
today, which is exactly what the default prescribes, not a gap. Residual (not fork-changing): "flavor" is new
vocabulary with no on-disk referent yet — a naming nit for the principle write-up, below.*

## Per-fork classification

- **Layer:** WE owns only the *contract* (root-agnostic structure + surface-styleable); the impl (base CSS,
  transient binding, token resolution) is FUI; the *values* are product/flavor; composition is the Plateau
  assembler. This is the standard three-layer carve, not a new mechanism.
- **Protocol / intent dimension:** the *style axis* this card surface is one recipe of is the presentation-trait
  vocabulary (#1884) — broader and foundational; the card ships on **plain tokens now** and retrofits later, so
  **#1884 does not block this**. The card itself mints no intent and no protocol.
- **DI-injectable / seam:** none — the look is token indirection, not a registry.
- **Most-permissive default:** FUI ships one neutral base; restriction-to-a-register is a product opt-in
  (flavor), never baked into core.

## Relationship to #1884 (presentation traits) — non-blocking

The card surface is just *one recipe* in the future presentation-trait ("finishes") vocabulary (#1884). That
vocabulary is foundational and broader than the card; the card ships on **plain tokens now** and retrofits to
traits later. The "flavor" vocabulary this decision introduces should be reconciled with #1884's tier-3
recipe/flavor naming when the principle is codified — a naming nit, not a blocker.

## Downstream once ratified

- **#1871** becomes mechanical: docs `<div class="standard-card">` → `we-card`; `<section class="section-card">`
  → native `<section class="fui-card">` (no bespoke CSS); `<a class="standard-card">` → `<a class="fui-card">`.
- **#1608** is then a clean frame-swap build.
- **On resolve** (this is a `kind:decision`): codify "semantic identity vs composable style; look ≠ identity;
  intrinsic-vs-extrinsic root resolution" to `we:docs/agent/platform-decisions.md` via `--codified-to`.
