---
kind: decision
parent: "1287"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-28"
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

## REVISION 2026-06-27 — REOPENED: the real principle is the SUBSTRATE BOUNDARY

**Human ruling.** The prepare-time framing got the *layer* wrong, and chasing it surfaced the actual
principle: **every "how do we do component X" question is one question — which substrate owns the
responsibility.** Fix the boundary once and the 100s of downstream calls (does a card have a title? what
namespace? section or article? where does the heading go?) become **mechanical placements**, not decisions.
The card is just this principle's worked example.

### The substrate boundary (this is what codifies)

| Substrate | Owns | Deliberately does NOT own | Card example |
|---|---|---|---|
| **WE** — *standard* | the **contract**: semantic identity + the minimal invariant. Names what a thing *is*. **Under-specifies on purpose** — any "a card has a title" claim is contradicted by the next design. | concrete structure, optional parts, look values | "a card is a styleable surface bound to a self-contained-composition root" — nothing more |
| **FUI** — *implementation* | the **primitive**: the reusable mechanism realizing the contract — transient root-binding, root resolution, the tokenized base style hook, slot/prop machinery. Product-agnostic. | any product-specific design opinion (titles, footers, menus) | `we-card` (→`<article>`), `we-section-card` (→`<section>`) |
| **Product** — *composition* | **concrete, semantically-named, namespaced components** composing primitives into what *this* product needs (title, footer, items, menus, behaviors). | the underlying standard/primitive (it consumes, never re-mints them) | `standard-card` = `we-card` + title + footer + … |

**Placement is explicit and load-bearing.** The product-composition components (`standard-card`,
`standard-section`) live in the **product** substrate — for the docs, *the WE website's own frontend* — **not
in WE and not in FUI**. `we-*` names belong to the standard+primitive layer; `standard-*` is product UI that
*consumes* the primitives. (The WE website's frontend co-locating in the `webeverything` repo, which also
hosts the WE standards, does **not** make `standard-card` a standard — it is product code dogfooding FUI, so
no conflict with "WE holds zero standard impl".) The FUI-vs-product line, when it blurs, is decided by the
existing [reusable-against-all-implementers → neutral home](docs/agent/platform-decisions.md#reusable-neutral-home)
statute: product-agnostic + reusable ⇒ graduate to an FUI primitive; product-specific ⇒ stays in the product.

**Delivery vehicle (the original error).** A component is **not** delivered as a classname. It is a
**composed web component** — own tag, multiple elements, props, behaviors, slots — at *both* the FUI-primitive
and product-composition layers. `<section class="fui-card">` was only ever the degenerate look-only residue,
never the authored deliverable.

**Native-first is preserved as a constraint on the composition**, not a ban on the component: each layer's
component composes the correct native root internally (landmarks/roles/a11y) and never reinvents a sufficient
native primitive — but the deliverable is the custom element.

**FUI primitives are TRANSIENT (ruled).** `we-card`/`we-section-card` are authored as tags and **erase to
their native DOM at runtime** (`we-card`→`<article class="fui-card">`); the product component composes them.
Chosen: **(a) transient + (i) native-first-as-internal-constraint** (rejected: (b) a persistent custom element
that costs the landmark role; (ii) custom-element-as-identity with native roots optional).

### Every prior sub-question, dissolved by placement

- *"Does the card mandate a title?"* → **product** (`standard-card`); not WE, not the FUI primitive. **So old Fork 2 (heading/title on `we-card`) DISSOLVES — nothing to ratify on the primitive.** `standard-card` composes the `<hN id>` heading the docs need, ids preserved.
- *"Namespace / prefix?"* → `we-*` is reserved for the standard+primitive layer; the **product** owns its own namespace via a **config knob (default empty)** — the WE docs site uses unprefixed `standard-card`; the config lets any *published* product namespace its components without code change.
- *"`<section>` or `<article>` root?"* → **FUI** ships both primitives; the **product** picks per surface.

### Worked example (the substrate boundary in code)

```html
<!-- FUI primitives: root binding + base style hook + slot/prop machinery; NO design opinion -->
<we-card> … </we-card>                          <!-- transient → <article class="fui-card"> -->
<we-section-card id="overview"> … </we-section-card>   <!-- transient → <section id="overview" class="fui-card"> -->

<!-- PRODUCT concrete component: composes a primitive + THIS site's structure; semantic name, own namespace -->
<standard-card>                                 <!-- composes we-card + title + footer + items + menus -->
  <h4 id="scope-vocab">W3C selector vocabulary, wholesale</h4>
  <p>…</p>
</standard-card>
<!-- runtime: <article class="fui-card …"> with the <h4 id="scope-vocab"> preserved exactly as the product composed it -->

<!-- still REJECTED (Fork 1, unchanged): extrinsic author-fiat root override — the author writes the right primitive -->
<we-card as="section"> … </we-card>             <!-- ✗ use <we-section-card> -->
<!-- still BLESSED (Fork 1, unchanged): intrinsic, content-driven resolution -->
<we-button href="/x">Open</we-button>           <!-- resolveTag(): href ? 'a' : 'button' -->
```

**Edge to flag for the FUI build (not a fork — a transient limit).** A fully-transient primitive erases its
host, so a **custom behavior** on the *product* component (e.g. collapse) must be **delegated onto the
resulting native DOM** (document-level, attribute-keyed) — or that behavior lives in the product component's
own lifecycle around the erased primitive. The docs cards are structure-only, so this doesn't gate #1871;
capture it when `we-section-card` / `standard-card` are specced.

**What of the original survives unchanged:** **Fork 1** (intrinsic root resolution blessed; extrinsic
author-fiat `as=` rejected) and **Fork 2's token layering** (the *look values* live as FUI tokenized base +
product/flavor values) both hold — they are now seen as *consequences of the substrate boundary* (the boundary
is the general rule; token-layering is its style-axis instance). Only the "deliver via a bare native element +
class" claim, and the idea that title/heading is a `we-card`-level question, are superseded.

**Downstream re-scope:**
- **#1871** — docs author the **product component `standard-card`** (composing `we-card`) and a section-rooted
  concrete card (composing `we-section-card`); title/heading/`<hN id>` live there; **its old Fork 2 drops**.
- **New builds** — FUI primitive `we-section-card` (`CardElement`-style transient, `resolveTag(): 'section'`)
  + the product `standard-card` component (in the website); namespace config (default empty).
- **Re-codify** `we:docs/agent/platform-decisions.md#identity-semantic-look-composable` on re-resolve: lead
  with the **substrate boundary** (general), demote the card to its worked example, fold in the
  composed-transient-component delivery + the product-composition + namespace tiers. Consequences
  (different-semantic⇒different-element; native-first) hold.

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

> ⚠️ **The `<section class="fui-card">` "RECOMMENDED" line below is SUPERSEDED** by the 2026-06-27 REVISION
> above — a section card is now delivered as a transient composed component (`<we-section-card>`), not a
> hand-authored class. The bare class survives only as the *runtime residue*. The rest of this block
> (article `we-card`, rejected `as=`, blessed intrinsic `we-button`) is unchanged.

```html
<!-- RECOMMENDED: card-composition on its default <article> root (we-card is transient → <article class="fui-card">) -->
<we-card heading="Quarterly report"> … </we-card>

<!-- SUPERSEDED (see REVISION): authored as <we-section-card> now; this is only the runtime-erased residue -->
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
