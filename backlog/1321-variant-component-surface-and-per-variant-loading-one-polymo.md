---
kind: decision
status: open
blockedBy: ["1318"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedProject: webintents
relatedReport: reports/2026-06-20-1321-fui-variant-surface-packaging.md
tags: [reproduction, variant, packaging, native-first, frontierui]
---

# Variant component surface and per-variant loading (one polymorphic block vs per-variant elements)

Surfaced by #1318. WE ratified the `variant` axis as an intent contract rendered via a plain attribute
(we:button[variant]) consumed by CSS — but HOW a block **packages** it is an FUI-locus call:
bare `<button variant>` + CSS (no wrapper), vs per-variant custom elements (`<ghost-button>`, the Material
Web shape), vs an autonomous element wrapping a real `<button>`. This decides FUI's **recommended /
default** packaging (every shape stays allowed — see Invariant). locus: frontierui.

## Grounding digest

Full survey: **we:reports/2026-06-20-1321-fui-variant-surface-packaging.md** · research topic
`/research/fui-variant-surface-packaging/`. This is an **FUI impl call** (the variant *contract* is WE's;
the *packaging* is FUI's); WE never imports/renders FUI block code (docs-rendering boundary), so no WE
artifact changes — the ruling guides FUI's button block.

- **The convergent benchmark shape is one element, variant as an attribute** — Shoelace
  `<sl-button variant>`, Adobe Spectrum `<sp-button variant treatment>`, Fluent UI WC
  `<fluent-button appearance>`, Carbon `<cds-button kind>`. **shadcn** ships the most native-first shape: a
  real `<button>` with a class computed from a `variant` prop (`buttonVariants({variant})`) — in the DOM
  indistinguishable from FUI's bare-CSS option.
- **Material Web is the lone per-variant-tag outlier** (`<md-filled-button>`/`<md-text-button>`/…); its
  only rationale is tree-shaking per-variant *modules* — weak for WE/FUI because the variant axis is
  **behavior-free CSS**: there is no per-variant module to shake, only a few CSS rules, against the cost of
  an unbounded tag namespace. A tag-per-value is also a *closed* namespace, the opposite of the ratified
  *open-numbered attribute* (#1318).
- **The open-numbered statute already settles the axis needs no element** —
  we:docs/agent/platform-decisions.md:588-589: "Surface is a plain attribute consumed by CSS
  (`button[variant]`) — no wrapper required, because a behavior-free axis needs none."
- **Native `<button>` gives keyboard/focus/`disabled`/form participation free; a wrapper must re-forward
  it** (`role=button` is necessary-but-insufficient; forms need `formAssociated` + `ElementInternals`).
  The item's a11y note ("most devs will not re-implement it") is the native-first argument.
- **Modern CSS removes the reason to wrap** — a bare `<button>` can now be a `display: flex`/`grid`
  container, so layout no longer forces a wrapper.
- **FUI's elements are sparse + bare-kebab, no `fui-` prefix** (5 of 75 blocks register as elements;
  custom-element-tag-naming research, #841), so "no element, styled native `<button>`" fits the grain.

## Axis-framing

The single design axis is **FUI's recommended-default packaging of a variant-bearing block**, decomposed
into two: (1) *element granularity* — one polymorphic element with the variant as an attribute vs
per-variant tags; and (2) *element-or-none* — given one element, a custom-element wrapper vs a
stylesheet/theme over the native `<button>`. Both are **impl/packaging** concerns (the WE contract — the
CSS-consumed `variant` attribute — is fixed by #1318); the variant treatment lives in the
**stylesheet/theme layer** (we:src/_data/intents/action.json holds the dimension;
we:docs/agent/platform-decisions.md:566-596 the statute). Per-variant *loading* collapses to a build
optimization: the axis is CSS-only, so there is no per-variant module to lazy-load.

## Invariant (set in the #1318 discussion — not a fork)

**The per-variant / per-level wrapper shape stays an *allowed* choice — this decision picks the
recommended *default*, never a prohibition.** Per most-flexible-default + minimize-lock-in
(we:docs/agent/platform-decisions.md), WE mandates the *contract surface* (the `variant` axis, #1318),
not the *packaging*; an implementer may ship `<md-filled-button>`-style wrappers that reflect the
attribute down to a real `<button>`. The forks below decide **what FUI recommends / ships as the floor**,
every shape preserved as a first-class opt-in. Native-first arguments shape the *default*, not the
*permission*.

## Recommended path at a glance

| Fork | Axis | Recommended default | Main alternative | Confidence |
|---|---|---|---|---|
| 1 | Default element granularity | **one element, variant = open-numbered attribute** | per-variant tags (Material Web) — not the default; stays an allowed opt-in | ~90% |
| 2 | Wrapper or bare native? | **bare native `<button variant>` + CSS/theme, no element** | single `<fui-button>` wrapper (Shoelace shape) | ~75% |

**Supported by default (not forks):** per-variant *loading* (CSS-only axis → ordinary bundling, a
deferred build optimization, not architecture); the variant treatment lives in the stylesheet/theme layer
(decoupled, standing separation bias); autocomplete/typing of the `variant` attribute is delivered by the
CEM/types over the WE-owned custom-element contract (#822), independent of whether FUI ships an element.

## Fork 1 — recommended-default element granularity: one polymorphic element vs per-variant tags

*Fork exists because* the *default* is singular and two coherent candidates genuinely cannot both be it:
FUI's recommended floor is either **one element with the variant as an attribute** *or* **per-variant
tags** (the Material Web shape) — not both. Both are coherent shipping shapes (Material Web proves per-tag
works), so this is a real either/or over the default — *not* a prohibition (per-variant tags stay allowed,
see Invariant).

- **A — one element, variant as the open-numbered attribute** *(recommended, ~90%)*. Matches the statute
  (we:docs/agent/platform-decisions.md:588-589) and the convergent benchmark shape
  (Shoelace/Spectrum/Fluent/Carbon). Keeps the axis open, dynamically bindable (changing the variant is an
  attribute write, not an element swap), and native-a11y-bearing.
- **B — per-variant tags as the default** *(not recommended; still an allowed opt-in)*. Material Web
  shape. *As the default* it makes the open-numbered axis a closed tag namespace, breaks dynamically-bound
  variants (changing the variant recreates the element), and forfeits native `<button>` a11y unless each
  tag re-wraps one; its only upside — per-variant *module* tree-shaking — does not apply to a behavior-free
  CSS axis. **The residual that would raise it to the default:** evidence variants need *materially
  different DOM* — but that is **block polymorphism, not a variant** (statute ceiling,
  we:docs/agent/platform-decisions.md:580-589), so it routes to the block/structure layer, never here.

## Fork 2 — does FUI ship a custom-element wrapper, or just CSS over native `<button>`?

*Fork exists because* both branches are coherent and genuinely cannot coexist for the *default* button
block: FUI either ships a custom element as the block's primary surface, or it ships a stylesheet/theme
over the native element — it must pick one default. The statute's "no wrapper required" settles the
*variant axis* needs no element, but the *button block as a whole* (busy/loading, icon slots, group
behaviors) could still motivate one, so the call is genuinely open at the FUI-packaging level.

- **A — bare native `<button variant>` + CSS/theme, no custom element** *(recommended, ~75%)*. FUI ships a
  **stylesheet/theme**, not an element; the variant is a plain attribute consumed by CSS, exactly like
  shadcn's DOM. *Why:* native `<button>` gives keyboard/focus/`disabled`/form participation **free** (the
  a11y argument the item raises); zero JS; modern CSS lets the bare button be a flex/grid container so
  layout needs no wrapper; consistent with FUI's sparse-element, no-prefix grain (#841); most-permissive
  native-first floor. The block's *other* axes (busy, icon, group) attach as attributes/behaviors on the
  same native element — the established FUI pattern for `type:Component` blocks.
- **B — a single autonomous custom element `<fui-button variant>`** wrapping/forwarding a real `<button>`
  (Shoelace/Spectrum shape). *Why considered:* one encapsulated element gives a typed property surface
  (DevX/autocomplete), Shadow-DOM isolation, and a single host for the block's non-variant behaviors. *Why
  not the default:* it must re-forward all native button a11y + form participation (`formAssociated`,
  `ElementInternals`) just to break even on what A gets free, requires JS, and adds an element to load.
  **The residual that would flip this:** if FUI's button block accrues enough *non-variant* runtime
  behavior (rich busy/loading orchestration, slotted composition, group coordination) that an encapsulated
  element earns its keep independent of the variant axis — a block-level call, revisit when that behavior
  lands. *(~75%; residual is the block's non-variant complexity, not the variant axis.)*

## For the deciding agent (red-team flags)

- **Fork 2 is the high-leverage one** — its default (no element) is a strong native-first stance the
  skeptic should press on the block's *non-variant* needs (does FUI's button already have enough
  busy/loading/group behavior that a wrapper pays for itself today?). The default survives only if those
  needs are still thin; if FUI's button is already element-shaped for other axes, A is moot.
- **Fork 1 is near-settled** by the open-numbered statute + the Invariant (per-variant tags allowed but
  not default); the residual is purely the materially-different-DOM case, which the ceiling routes away.
