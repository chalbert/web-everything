# Prior-art survey — unified design-token / theming system (backlog #364)

**Date:** 2026-06-12 · **For:** decision item [#364](../backlog/364-unified-design-token-theming-system.md)
· **Published as:** `/research/design-token-theming-system/`

/ prep pass (`/prepare 364`) — the autonomous research half of an open decision. Surveys the native
web-platform token substrate + the `references.json` benchmark design systems so #364's forks are
grounded in prior art before the human call. No ruling is made here; the item stays `open + preparedDate`.

## The gap

Phase-3 coverage detection ([#347](../backlog/347-capability-mapping-gap-detection.md),
`reports/2026-06-12-coverage-gap-detection.md`) ranked **gap #4 `design-tokens-theming`** — "no unified
token system (spacing / radius / elevation / semantic color / dark)" — as a fileable miss. WE already
ships intents that touch *slices* of this concern (`typography`, `density`, `surface`, `motion`), and
[#010](../backlog/010-gap-3-theme-color-intent.md) resolved a **theme-color *intent*** (`scheme` /
`contrast` / `accent`) grounded on `color-scheme` / `light-dark()`. But #010 explicitly **deferred a full
design-token *project*** — *"token elaboration is the technical half, not an intent dimension"* — until
real demand. #364 is that deferred technical half: how WE structures the concrete-value layer the
semantic intents resolve into.

## What the survey found

### 1 · The token format standardized in Oct 2025 — DTCG 2025.10

The **W3C Design Tokens Community Group** reached its **first stable version, [Design Tokens Format
Module 2025.10](https://www.designtokens.org/tr/2025.10/format/)**, on
[2025-10-28](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/).
It is a vendor-neutral JSON interchange format (`$type` / `$value` / `$description`, aliasing via
`{group.token}` references, media type `application/design-tokens+json`, `.tokens`/`.tokens.json`
extensions). **10+ tools** implement it (Figma, Penpot, Sketch, Framer, Supernova, zeroheight) with
reference implementations in **[Style Dictionary](https://styledictionary.com/info/dtcg/)**, Tokens
Studio, and Terrazzo. This is the strongest "adopt-don't-coin" signal in the survey: an interop format
with a real swappable-vendor story, now stable — exactly the kind of external standard WE prefers to
conform to rather than reinvent.

### 2 · The native CSS substrate is Baseline (2024–2025) — strongly native-first

Every primitive a token runtime needs is now [Baseline-available](https://web.dev/articles/baseline-in-action-color-theme):

- **`--custom-properties`** — the variable carrier; **`@property`** — *typed* registration (syntax /
  inherits / initial-value), so tokens are type-checked + animatable.
- **[`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)** +
  **`color-scheme`** — light/dark scheme switching with **no `prefers-color-scheme` media query**;
  `color-scheme` also themes native UI (scrollbars, form controls). Baseline since May 2024.
- **Relative color syntax** (`oklch(from … )`) + **`color-mix()`** — derive a whole scale/state ramp from
  a single accent at runtime, in a perceptual space (oklab/oklch).
- **`prefers-contrast`** / **`prefers-reduced-transparency`** / **`prefers-reduced-motion`** — the
  contrast + motion axes the `surface`/`motion` intents already lean on.

The native stack covers scheme + accent-derivation at runtime with **zero build step** — the native-first
default writes itself for the *runtime* tier.

### 3 · The benchmark design systems are unanimous on a 2–3 tier taxonomy

| System | Tiers | Naming |
|---|---|---|
| [Material Design 3](https://m3.material.io/foundations/design-tokens/overview) | 3 | **reference → system → component** (`md.ref.*` → `md.sys.*` → `md.comp.*`) |
| [Adobe Spectrum](https://spectrum.adobe.com/page/design-tokens/) | 3 | global → alias → component |
| [Fluent 2](https://fluent2.microsoft.design/design-tokens) | 2 (+comp) | **global** (raw) → **alias** (semantic) |
| [Radix Themes](https://www.radix-ui.com/themes/docs/theme/color) | scales → aliases | 12-step accent/gray scales → semantic aliases; theme knobs `accentColor`/`grayColor`/`radius`/`scaling` |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/color) | semantic | **dynamic system colors** named by *purpose*, auto-adapting light/dark |

The shape is universal: **primitive (raw value) → semantic (role/purpose) → component (per-component
override)**. The semantic tier is always *purpose-named* ("background at hierarchy level N", "accent
action fill") — never appearance-named.

**Accent derivation — the genuinely divergent call (revised by the 2026-06-12 follow-up pass).** The
field runs *two* mature strategies, not one:

- **Curate** — [Radix](https://www.radix-ui.com/colors) ships deliberately hand-curated 12-step scales,
  on the premise that naive derivation (relative-color/`color-mix`) can miss WCAG contrast at specific steps.
- **Derive *with a contrast model*** — [Material Design 3's HCT tonal palettes](https://m3.material.io/styles/color/system/how-the-system-works)
  ([material-color-utilities](https://github.com/material-foundation/material-color-utilities)) auto-derive
  scales whose tone axis (`T`) is perceptual luminance, so the algorithm **pairs tones for a guaranteed 3:1 /
  7:1 contrast** — "every color in the M3 colorScheme meets WCAG when used correctly."
  [Adobe Leonardo](https://github.com/adobe/leonardo) generates scales **from a target contrast ratio** as
  open source. So derivation *with a validation gate* is a proven, mainstream accessible pattern.

The original prep cited only Radix and concluded "derivation can miss contrast → lean curate," which was
**one-sided**: MD3 + Leonardo show derivation + a contrast gate is the equal-or-stronger camp, and the one
that fits native-first. This reframes Fork 4 from "native-auto (risky) vs curate (safe)" to "**derive +
validate** (A′) vs curate-by-default" — and moves the recommended default to **A′** at med-high confidence
(see item Fork 4).

### 4 · The WE-specific reframe the survey surfaced

WE is not a from-scratch design system — it **already owns the semantic tier** as Intents. `surface`
([intents.json:997](../src/_data/intents.json)) names elevation (a `0-5` semantic scale) + texture;
`density` ([intents.json:20](../src/_data/intents.json)), `typography`
([intents.json:960](../src/_data/intents.json)), `motion` ([intents.json:3](../src/_data/intents.json)),
and the deferred theme-color intent name the rest. These intents *are* WE's "system/alias" tier in
MD3 terms. So the relationship-to-#010 question answers itself structurally: **the token project should
own the primitive tier + the component tier, and let the existing Intents remain the semantic tier** —
rather than coining a second, parallel semantic vocabulary. This keeps intents UX-only (the codified
rule) and gives the token layer the concrete values the intents resolve into. The survey thus *dissolved*
a latent fork ("does the token project re-name semantic roles?" — no, the intents already do) and
*sharpened* the real one (accent derivation: native-auto vs curated).

## Forks this grounds (see the item for options + defaults)

1. **Home / layer** — a new Web Project (the deferred technical half) vs Capability vs fold-into-intent.
2. **Format** — adopt DTCG 2025.10 as interchange, compiled to the native CSS substrate as runtime.
3. **Tier taxonomy + the #010 seam** — 3-tier (primitive · semantic · component), with the **semantic
   tier owned by the existing intents**, tokens owning primitive + component.
4. **Scheme + accent-derivation model** — **A′: derive + contrast-validation gate** (native derivation,
   WCAG/APCA-checked; curated scales = brand-precision override) vs bare native-auto vs curate-by-default.
   Moved low → med-high once MD3 HCT + Adobe Leonardo were surveyed (see below).

## Sources

- [DTCG — first stable version announcement (2025-10-28)](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) · [Style Dictionary DTCG support](https://styledictionary.com/info/dtcg/)
- [web.dev — Color themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme) · [MDN `light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) · [MDN `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)
- [Material Design 3 — Design tokens](https://m3.material.io/foundations/design-tokens/overview) · [Fluent 2 — Design tokens](https://fluent2.microsoft.design/design-tokens) · [Adobe Spectrum — Design tokens](https://spectrum.adobe.com/page/design-tokens/)
- [Radix Themes — Color](https://www.radix-ui.com/themes/docs/theme/color) · [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- **Fork 4 (added 2026-06-12 follow-up):** [MD3 — how the color system works (HCT, auto-contrast)](https://m3.material.io/styles/color/system/how-the-system-works) · [material-color-utilities](https://github.com/material-foundation/material-color-utilities) · [Adobe Leonardo (contrast-first generation)](https://github.com/adobe/leonardo) · [Open Props](https://open-props.style/)
