# FUI variant-surface packaging — one polymorphic block vs per-variant elements

**Date:** 2026-06-20 · **Item:** #1321 · **Locus:** frontierui · **Feeds:** #1318 (ratified `variant`
axis), statute `we:docs/agent/platform-decisions.md#open-numbered-variants` · **Research topic:**
`/research/fui-variant-surface-packaging/`

## The question

#1318 ratified the WE side: the Action-Intent `variant` axis (`fill | outline | ghost | link`, open
vocabulary) renders as **a plain attribute consumed by CSS** (`button[variant="ghost"]`), and the statute
already records "*no wrapper required, because a behavior-free axis needs none*"
(`we:docs/agent/platform-decisions.md:588-589`). #1318 explicitly deferred *how FUI packages the block* to
this item: bare `<button variant>` + CSS (no wrapper) · per-variant custom elements (`<ghost-button>`,
the Material Web shape) · or an autonomous element wrapping a real `<button>`. This decision is an
**FUI-locus impl call** (the variant *contract* is WE's; the *packaging* is FUI's), tracked here because
the contract it conforms to is WE's. WE never imports/renders FUI block code (docs-rendering boundary), so
nothing here changes a WE artifact — it guides FUI's button block.

## Prior art — packaging shapes across the benchmark web-component libraries

The variant *vocabulary* convergence was surveyed in #1318's report. The **new** axis this survey adds is
**packaging shape** — how each library exposes that vocabulary in the DOM:

| Library | Shape | DOM | Variant exposed as |
|---|---|---|---|
| **shadcn/ui** | bare native + classes | `<button class="...">` (a real `<button>`) | a class computed from a `variant` prop (`buttonVariants({variant})`) — CSS only |
| **Shoelace / Web Awesome** | one custom element | `<sl-button variant="primary">` | an **attribute** on one element |
| **Adobe Spectrum WC** | one custom element | `<sp-button variant treatment>` | **two attributes** (`variant` semantic ⊕ `treatment` presentational) on one element |
| **Fluent UI WC / Carbon WC** | one custom element | `<fluent-button appearance>`, `<cds-button kind>` | an **attribute** on one element |
| **Material Web (`@material/web`)** | **per-variant elements** | `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>`, `<md-elevated-button>`, `<md-filled-tonal-button>` | the **tag itself** |
| **Open UI / WHATWG** | native | `<button>` | (no native variant axis; `appearance` CSS only) |

Two readings dominate:

- **The single-element-with-attribute shape is the convergent default** (Shoelace, Spectrum, Fluent,
  Carbon). The variant is data on one stable element — dynamically bindable, autocompletable, and a
  natural fit for an *open* value set.
- **Material Web is the lone per-variant-tag outlier**, and its own rationale is tree-shaking: importing
  `<md-text-button>` pulls only that variant's module. This is the *only* real argument for the per-tag
  shape — and it is weak for WE/FUI (see below), because WE's variant axis is **behavior-free CSS**, so
  there is no per-variant *module* to shake; the saving is a few CSS rules, against the cost of an
  unbounded tag namespace.
- **shadcn** ships the most native-first shape of all: a real `<button>` with a computed class. In the DOM
  it is indistinguishable from FUI's bare-CSS option — the React `variant` prop is just a class selector.

## In-tree facts that shrink the fork

1. **The statute already pre-decides the variant axis itself needs no element.**
   `we:docs/agent/platform-decisions.md:588-589` — "Surface is a plain attribute consumed by CSS
   (`button[variant]`) — no wrapper required, because a behavior-free axis needs none." So **Fork 1's
   *default* leans hard to one element** — a tag-per-value as the default is a *closed* namespace, the
   exact opposite of the ratified *open-numbered attribute* (per-variant tags remain an allowed opt-in,
   not a default — see the Invariant).
2. **Native `<button>` gives a11y, focus, `disabled`, and form participation for free; custom elements do
   not.** `role=button` is necessary-but-insufficient — a custom element must re-implement keyboard
   activation, focus, `disabled`, and (for forms) `formAssociated` + `ElementInternals`. The item's own
   a11y note ("most devs will not re-implement it") is the native-first argument.
3. **Modern CSS removes the historical reason to wrap a button.** A bare `<button>` can now be a
   `display: flex`/`grid` container (the old "buttons can't be flex containers" footgun is gone in current
   engines), so layout no longer forces a wrapper element around the label/icon.
4. **FUI's existing custom elements are sparse and bare-kebab.** Of 75 blocks only 5 register as custom
   *elements* (`auto-heading`, `auto-complete`, `route-view`, `route-outlet`, `background-tasks`); most
   `type:Component` blocks register as behaviors/attributes, and there is **no `fui-` prefix** anywhere
   (custom-element-tag-naming research, #841). A button block defaulting to "no element, just styled
   native `<button>`" is consistent with that grain; minting `<ghost-button>`/`<fill-button>` would be a
   sharp departure.
5. **Per-variant *loading* has no per-variant code to load.** Because the variant axis is CSS-only
   (statute), "load only what is needed" is ordinary CSS bundling/tree-shaking of a few rules, not a
   module-splitting architecture. There is no JS module per variant to lazy-load, so this is a build
   optimization (prioritization), **not an architectural fork**.

## Per-fork classification (the 7-question pass)

- **Which layer?** Impl/packaging (FUI), not a WE standard — the contract (CSS-consumed attribute) is
  already WE's. *Nothing in this item adds a WE artifact.*
- **Protocol or intent dimension?** Neither — it is *how the impl realizes* an existing intent dimension.
- **Expose the whole axis?** The axis (variant values) is already open-numbered and exposed by #1318;
  packaging does not re-expose it.
- **Fixed mechanic or dimension?** The recommended *default* element granularity is one element (Fork 1),
  but packaging stays a *dimension* — per-variant wrappers remain an allowed opt-in (Invariant). Whether
  FUI ships a *custom element wrapper at all* is the second genuine dimension (Fork 2).
- **DI-injectable?** N/A — packaging shape, not a registry seam.
- **Most-permissive default?** Native-first floor → the least-machinery option (bare native `<button>` +
  CSS) is the most-permissive default; a wrapper is the author/impl opt-in.
- **Seam between intents?** No new seam; the button block continues to consume Action Intent.

**Standing bias (separate/decouple):** keep the variant treatment in the *stylesheet/theme* layer,
decoupled from any element packaging — the variant axis composes with the block rather than being baked
into a tag.

## Invariant (set in the #1318 discussion, not a fork)

**The per-variant / per-level wrapper shape stays an *allowed* choice — this decision picks the
recommended *default*, never a prohibition.** Per most-flexible-default + minimize-lock-in
(`we:docs/agent/platform-decisions.md`), WE mandates the *contract surface* (the `variant` axis, #1318), not the
*packaging*; an implementer may ship `<md-filled-button>`-style wrappers that reflect the attribute down
to a real `<button>`. So both forks below decide **what FUI recommends / ships as the floor**, with every
shape preserved as a first-class opt-in. The native-first arguments shape the *default*, not the
*permission*.

## The prepared forks

### Fork 1 — the recommended-default element granularity: one polymorphic element vs per-variant tags

*Fork exists because* the *default* is singular and two coherent candidates genuinely cannot both be it:
FUI's recommended floor is either **one element with the variant as an attribute** *or* **per-variant
tags** (the Material Web shape) — not both. Both are coherent shipping shapes (Material Web proves per-tag
works), so this is a real either/or over the default — *not* a prohibition (per-variant tags stay
allowed, see Invariant above). The default leans hard to one-element: per-variant *tags as the default*
would make the open-numbered axis (#1318) a closed tag namespace, break dynamically-bound variants
(changing the variant recreates the element), and forfeit native `<button>` a11y unless each tag
re-wraps one. Material Web's per-tag shape exists only to tree-shake per-variant *modules*, which WE's
behavior-free CSS axis does not have.

- **A — one element, variant as the open-numbered attribute** *(recommended, ~90%)*. Matches the statute
  (`button[variant]`) and the convergent benchmark shape (Shoelace/Spectrum/Fluent/Carbon). Keeps the
  axis open, dynamically bindable, and native-a11y-bearing.
- **B — per-variant tags as the default** *(not recommended; still an allowed opt-in)*. Material Web
  shape; as the *default* it reintroduces the closed-namespace + dynamic-binding + native-a11y costs
  above. **Residual that would raise it to the default:** evidence that variants need *materially
  different DOM* — but that is **block polymorphism, not a variant** (statute ceiling,
  `we:docs/agent/platform-decisions.md:580-589`), so it routes to the block/structure layer, never here.

### Fork 2 — does FUI ship a custom-element wrapper, or just CSS over native `<button>`?

*Fork exists because* both branches are coherent and genuinely cannot coexist for the *default* button
block: FUI either ships a custom element as the block's primary surface, or it ships a stylesheet/theme
over the native element — it has to pick one default. The statute's "no wrapper required" settles that the
*variant axis* needs no element, but the *button block as a whole* (busy/loading state, icon slots, group
behaviors) could still motivate one, so the call is genuinely open at the FUI-packaging level.

- **A — bare native `<button variant>` + CSS/theme, no custom element** *(recommended, ~75%)*. FUI ships a
  **stylesheet/theme**, not an element; the variant is a plain attribute consumed by CSS, exactly like
  shadcn's DOM. *Why:* native `<button>` gives keyboard/focus/`disabled`/form participation **free** (the
  a11y argument the item raises); zero JS; modern CSS lets the bare button be a flex/grid container so
  layout needs no wrapper; consistent with FUI's sparse-element, no-prefix grain (#841); and it is the
  most-permissive native-first floor. The block's *other* axes (busy, icon, group) attach as
  attributes/behaviors on the same native element — the established FUI pattern for `type:Component` blocks.
- **B — a single autonomous custom element `<fui-button variant>`** wrapping/forwarding a real `<button>`
  (the Shoelace/Spectrum shape). *Why considered:* one encapsulated element gives a typed property surface
  (DevX/autocomplete), Shadow-DOM style isolation, and a single host for the block's non-variant behaviors
  (busy/loading, slots, group). *Why not the default:* it must re-forward all native button a11y + form
  participation (`formAssociated`, `ElementInternals`) to break even on what A gets free, requires JS, and
  adds an element to load — paying a real cost to recover capabilities the native element already has.
  **The residual that would flip this:** if FUI's button block accrues enough *non-variant* runtime
  behavior (rich busy/loading orchestration, slotted composition, group coordination) that an encapsulated
  element earns its keep independent of the variant axis — a block-level call, revisit when that behavior
  lands. *(~75%; residual is the block's non-variant complexity, not the variant axis.)*

## Supported by default (not forks)

- **Per-variant loading** — with the CSS-only variant axis there is no per-variant *module*; "load only
  what is needed" is ordinary CSS bundling/tree-shaking of a few rules. File any *measured* code-splitting
  as a deferred build optimization (prioritization, not a fork).
- **Variant treatment lives in the stylesheet/theme layer** — decoupled from packaging, composes with the
  block (standing separation bias).
- **Autocomplete/typing of the `variant` attribute** — delivered by the CEM/types over the WE contract
  (the custom-element surface is a WE-owned contract, #822), independent of whether FUI ships an element.

## Recommended path at a glance

| Fork | Axis | Recommended default | Main alternative (excluded/residual) | Confidence |
|---|---|---|---|---|
| 1 | Default element granularity | **one element, variant = open-numbered attribute** | per-variant tags (Material Web) — *not the default; stays an allowed opt-in* | ~90% |
| 2 | Wrapper or bare native? | **bare native `<button variant>` + CSS/theme, no element** | single `<fui-button>` wrapper (Shoelace shape) | ~75% |

## Cross-references

- #1318 — the ratified `variant` axis this packages.
- Statute `we:docs/agent/platform-decisions.md#open-numbered-variants` — the open-numbered + native-first
  surface rule.
- #822 / #841 — the custom-element surface is a WE-owned contract; FUI's tags are bare-kebab, no prefix.
- #1320 (build the `variant` dimension) · #1323 (sectioning/layout application).
