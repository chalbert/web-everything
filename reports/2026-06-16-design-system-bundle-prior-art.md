# Design-system bundle — prior-art survey (prep for #747)

**Date:** 2026-06-16 · **Decision:** [#747](../backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog.md) (parent epic [#746](../backlog/746-block-explorer-interactive-fui-block-workbench.md), Block Explorer) · **Builds on:** [#364](../backlog/364-unified-design-token-theming-system/) (`webtheme` token model) · **Research topic:** `/research/design-system-bundle-composition/`

## The question

The Block Explorer wants a gallery of popular-system presets (Material-like, Fluent-like, Carbon-like) a viewer switches between live, watching the same block re-skin **and possibly re-behave**. A design system isn't *just* a theme. This survey grounds #747: **what does a named, switchable "design system" unit actually contain, and is it a config flavor or a first-class entity?** Per design-first step 1 it surveys the leading systems + the token-format standards so the forks reuse platform vocabulary instead of coining a bespoke shape.

## What the survey found

### 1 · Where each leading system lands — tokens-only → +density → +behavior

| System | The switchable unit | Behavior in the bundle? | Position |
|---|---|---|---|
| **Carbon** (`@carbon/themes`: white/g10/g90/g100) | **color tokens only** | None — motion/spacing/type are *separate* `@carbon/motion`, `@carbon/layout`, `@carbon/type` globals a theme switch never touches | (a) tokens-only, strictest split |
| **DTCG** (official format module) | named value overrides | None *possible* by spec | (a) tokens-only |
| **Style Dictionary** | value sets + transforms/filters | None | (a) tokens-only |
| **Material Design 3** | color (+ typescale/shape) values over `md-sys-*` | None — "maintaining existing interaction patterns"; motion is a *separate system-wide scheme*, not per-brand; Material Web doesn't even implement `md-sys-motion` | (a)/(b) values-only |
| **Fluent UI v9** | one flat `Theme` token bag that *includes* motion duration/curve tokens | Motion *values* yes; density/interaction **no** (density is a per-component `size` prop, not a theme knob) | (b) tokens + motion values |
| **Radix Themes** (`<Theme>`) | color + **`radius` + `scaling` + `panelBackground`** | **Yes — shape, density, surface treatment bundled & inherited** | (c) tokens + *visual* behavior |

Sources: [material-web.dev/theming](https://material-web.dev/theming/material-theming/), [m3.material.io tokens](https://m3.material.io/foundations/design-tokens), [Fluent 2 tokens](https://fluent2.microsoft.design/design-tokens) + [we:packages/tokens/src/types.ts](https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/types.ts), [@carbon/themes README](https://carbondesignsystem.com/elements/themes/overview/) + [we:styles/docs/sass.md](https://github.com/carbon-design-system/carbon/blob/main/packages/styles/docs/sass.md), [Radix theme overview](https://www.radix-ui.com/themes/docs/theme/overview).

### 2 · The consensus is (a)/(b), not (c)

- **Switching a theme swaps token VALUES, never component behavior** in every system *except Radix*. MD3 says it explicitly; Fluent v9's static Griffel compilation enforces it; Carbon's theme is color-only by definition.
- **Motion and density are usually orthogonal axes, not theme members.** Carbon makes them separate packages; MD3 makes motion a separate system-wide scheme; Fluent keeps density out of the theme entirely.
- **Radix is the lone bundler of behavior — and only *visual* behavior** (radius = shape, scaling = density, panelBackground = surface treatment). Even Radix never switches *interaction logic / state machine / focus order*. There is **zero prior art** for bundling interaction behavior into a switchable theme.
- A consistent tiering appears everywhere: **reference/global → semantic/alias → component**. The semantic/alias tier is universally "the layer a theme overrides"; behavior, where present, attaches to the *component* layer (Radix props, Fluent `size`, MD3 state machines), not the token layer.

### 3 · The token-interchange standards cap the bundle at named values

The **official DTCG Format Module has no `$themes` / theming construct** — a token is exclusively a named value + metadata (`$value`/`$type`/`$description`/`$extensions`). The `$themes`/`$metadata` multi-theme convention is a **Tokens Studio vendor extension, not DTCG** (confirmed by sd-transforms docs). Style Dictionary likewise models multi-theme as a *build-config emergent* (config matrices + filters + `themeable` transforms), never a behavioral mechanism. **If a unit must be expressible in DTCG/Style-Dictionary (forward-adapter / portability reach), it cannot carry behavioral defaults — those must live in a WE-owned sidecar that *references* the token bundle.** Sources: [DTCG Format Module](https://www.designtokens.org/TR/drafts/format/), [Tokens Studio themes](https://docs.tokens.studio/manage-themes/themes-overview), [sd-transforms](https://github.com/tokens-studio/sd-transforms), [Style Dictionary config](https://styledictionary.com/reference/config/).

### 4 · How this maps onto WE's existing architecture

WE already *is* the "tokens in the standard format + defaults in a WE-owned sidecar" shape the prior art points to:

- **`webtheme` owns primitive + component tokens**, authored/interchanged as **DTCG 2025.10**, with `extends` deep-merge over a platform default and a DTCG→CSS compile — [we:webtheme/tokens.ts:1-22](../webtheme/tokens.ts) (model + `extends` + alias resolution), [we:webtheme/defaultTokens.ts:8-12](../webtheme/defaultTokens.ts) (the platform default), [we:webtheme/compile.ts:2-8](../webtheme/compile.ts) (DTCG→native CSS).
- **The intents own the semantic tier** — `we:webtheme/tokens.ts:10-13` states it outright: *"the existing intents (surface/density/typography/motion/theme-color) ARE the semantic tier; a token never re-coins a role name."* Registered intents: [we:intents.json](../src/_data/intents.json) `motion` (:3), `density` (:20), `typography` (:1019), `surface` (:1056).
- **`extends`-over-platform-default is the established config machinery** — generic in [we:plugs/core/CustomRegistry.ts:7,22,26,45](../plugs/core/CustomRegistry.ts), realized for tokens by the `extends` deep-merge in `we:webtheme/tokens.ts`.
- **Catalogs auto-render from a registry** — the `/protocols/` and `/intents/` precedent: [we:src/protocols.njk:50-74](../src/protocols.njk) iterates [we:protocols.json](../src/_data/protocols.json); [we:src/intents.njk:41-51](../src/intents.njk) iterates we:intents.json; nav in [we:base.njk:41,44](../src/_layouts/base.njk); a new catalog surface = page + `_data` registry + nav + authoring note + validator.
- **Traits already separate presentational vs behavioral concerns** — [we:traits.json](../src/_data/traits.json): delivery (lazy/eager, :41-60), inert dead-zone (:61-74), visibility gate (:75-88). These are *behavioral* activation knobs, distinct from presentational defaults.

## Takeaways that reshape the forks

1. **Content determines entity — decide content FIRST.** Value-only bundles behave like config (Carbon, Style Dictionary, DTCG = flavors with no identity beyond their values); bundles carrying semantic + behavioral identity behave like first-class entities (Fluent's `Theme` factory, Radix's `<Theme>`). The flavor-vs-entity call should *follow* the tokens-only-vs-tokens+behavior call, not precede it.
2. **A new, genuine fork the original framing missed: the *scope* of trait defaults.** Bundling *visual* behavior (radius/density/motion-feel) has exactly one precedent (Radix); bundling *interaction* behavior has none and conflicts with the leaders' clean separation. This is where the novelty/risk concentrates and deserves its own fork.
3. **The DTCG ceiling validates the sidecar shape.** A WE design-system manifest that *references* a DTCG token doc (rather than embedding tokens) keeps tokens portable in the standard format and intent/trait defaults in a WE-owned layer — exactly what `webtheme` (DTCG tokens) + intents (WE semantic tier) already are.
4. **A switchable gallery still needs a browsable registry to render from** (catalog-auto-render rule) even if each bundle is "just a manifest" — so Fork 1 (flavor) and Fork 3 (catalog) resolve together: the *bundle* is a manifest flavor, and a thin `we:designSystems.json` registry lists the named presets the `/design-systems/` page renders.

## Decision-relevant checklist (handed to #747)
- Bundle content: tokens + **optional** intent defaults + **optional** trait defaults (most-flexible; a colors-only brand omits the rest).
- Trait-default scope: bound to **presentational** traits (Radix precedent); behavioral-trait activation stays per-usage, not bundled (no prior art).
- Entity shape: a **manifest flavor that `extends` the platform default** (tokens referenced as DTCG, not embedded), *plus* a thin catalog registry for rendering.
- Surface: a new **`/design-systems/`** catalog (page + registry + nav + authoring note + validator), per the catalog-auto-render precedent.
