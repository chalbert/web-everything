# Palette-source ingest — standards & prior-art sweep (prep for #1252)

**Date:** 2026-06-20 · **Item:** [#1252](../backlog/1252-webtheme-load-palette-from-external-source-palette-source-in.md) · **Extends:** [#364](../backlog/364-unified-design-token-theming-system/) (`webtheme` token model) · **Sits beneath:** [#747](../backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog.md) (design-system bundle)

## The question

The theme configuration should be able to load a **palette from an external source**. This sweep grounds what "a palette" is across the industry, what standards exist, and how an import boundary should sit in front of webtheme's existing DTCG token model — before any build.

## What we already have (webeverything)

Not greenfield. The `webtheme` project (graduated from #364/#403/#404) already:

- **Adopts DTCG 2025.10** as authoring/interchange format — we:webtheme/tokens.ts parses DTCG docs, resolves `{alias}` refs, deep-merges via `extends`.
- Ships a platform default token set with oklch color ramps — we:webtheme/defaultTokens.ts.
- **Derives** schemes + accent ramps from a seed natively (relative-color / `color-mix`) with a WCAG/APCA contrast gate — we:webtheme/schemes.ts.
- Compiles to native CSS custom properties — we:webtheme/compile.ts.
- Has a Design Tokens protocol (we:src/_data/protocols/design-tokens.json) and a pending theme-color intent (scheme/contrast/accent, #010's build).
- A design-system bundle layer (#747): `we:designSystems.json` manifests in we:design-systems/.

Doctrine in play: intents own the semantic tier (UX-only); webtheme owns primitive + component tiers; we coin no format — we adopt DTCG.

## Standards landscape

### 1 · W3C DTCG (2025.10) — the interchange standard

W3C Community Group report; reached first stable version (2025.10) on 2025-10-28, split into Format + Color modules. Plain JSON, conventionally a `.tokens` (or `.tokens` JSON) file. A **token** = any object with `$value`; an object without it = a **group** (groups build the dotted namespace). Props: `$value` (required), `$type` (`color`/`dimension`/`fontFamily`/… inherits down from parent group), `$description`, `$extensions`, `$deprecated`.

**Color value — structured object in 2025.10** (hex now only an optional fallback field):

```json
{ "$type":"color", "$value": {
  "colorSpace":"oklch", "components":[0.62,0.19,256], "alpha":1, "hex":"#0d9488" } }
```

`colorSpace` enum: srgb, srgb-linear, hsl, hwb, lab, lch, oklab, oklch, display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d65, xyz-d50. Aliasing via `"{color.blue.500}"`; newer drafts add JSON-Pointer `$ref` for property-level refs. **A palette is just a group of color tokens; a ramp is a numeric-keyed sub-group — there is no dedicated palette/scale primitive.** Caveat: structured-color interop is still maturing; many exporters still emit/ingest the legacy hex string.

Specs: tr.designtokens.org/format, .../color, w3.org/community/design-tokens.

### 2 · Native CSS substrate

- **Custom Properties L1** — `--token: value` on `:root`; flat inheritable namespace; untyped (bad value → invalid-at-computed-value-time).
- **`@property` (Houdini)** — typed, animatable, validated tokens (`syntax:"<color>"`).
- **Color L4** — `oklch()`/`oklab()`, `color(display-p3 …)`; oklch is the modern default for ramps (perceptually-uniform L).
- **Color L5** — relative color `oklch(from var(--brand) 0.95 c h)` + `color-mix()`: generate a whole ramp from one base in pure CSS (parametric palette).
- **`light-dark()` + `color-scheme`** — binary scheme switch honoring OS pref, no media query.

All Widely-available except relative-color + `light-dark()` (cross-engine, ~90%+, "newly available" — guard with `@supports`).

### 3 · Major design-system palette formats

Three recurring shapes: (a) flat `family→{shade:hex}` map, (b) flat `--prefix-name-shade` CSS vars, (c) nested token tree with sets/themes/modes.

- **Material Design 3** — HCT space (Hue/Chroma/Tone; Tone == CIELAB L*, so tone→contrast is predictable). Seed → CorePalette → 6 tonal palettes → ~26 roles per light/dark. MCU returns ARGB ints; Theme Builder JSON uses hex with `seed`/`schemes`/`palettes`. **Generative** — persist the seed.
- **Tailwind** — `family × 50–950`. v3 nested hex; v4 CSS-first `@theme { --color-brand-500: oklch(...) }` (defaults ship OKLCH).
- **Adobe Leonardo** — generative, contrast-driven: key colors + target contrast ratios + bg → swatches computed to hit each ratio. Persist inputs.
- **Radix Colors** — static 12-step scales, each step a fixed UI role (9=solid, 11=low-contrast text, 12=high-contrast text). Consume by role number, don't generate.
- **Open Color** — 13 hues × 0–9, **positional arrays** (`blue[5]`) — positional, not shade-keyed.
- **Style Dictionary (Amazon)** — the reference external-palette→theme pipeline: `source → per-source parser (normalize any shape) → token pivot → transforms → emit`. Accepts CTI or DTCG (default v5). `outputReferences:true` keeps aliases as `var()`.
- **Tokens Studio / Figma** — Tokens Studio JSON = token sets + a reserved `$themes` JSON (set composition) + a `$metadata` JSON. Figma Variables REST API differs: collections→modes→variables, COLOR = 0–1 float `{r,g,b,a}`, aliases = `{type:"VARIABLE_ALIAS",id}`.
- **Penpot** — native DTCG, round-trips with Tokens Studio DTCG mode.

### 4 · Interchange / export-import formats

Only JSON token formats (DTCG, Tokens Studio) round-trip scales + semantics + aliases. Binary swatch formats are flat, lossy seeds:

| Format | Scales? | Semantics/aliases? | Alpha/wide-gamut | Notes |
|---|---|---|---|---|
| DTCG / Style Dictionary JSON | yes | yes (`{ref}`) | yes | the target |
| Tokens Studio JSON | yes | yes + theme composition | yes | a reserved `$themes` JSON ≈ portable theme config |
| ASE (Adobe Swatch Exchange) | one-level groups | no | no alpha | binary; no official spec (reverse-engineered) |
| ACO (Photoshop) | no | no | no alpha | binary |
| GPL (GIMP) | no | no | sRGB 8-bit | plain text, simplest import target |

## Design implications for #1252

- **Pivot = DTCG color tokens** — already webtheme's internal model. Done.
- **Per-source parser/adapter** normalizes incoming shapes (Tailwind / M3 / Figma / ASE / GPL) into the pivot — mirrors Style Dictionary and our ratified adapter-as-normalization-hub pattern (ingest incumbents bottom-up into a lossy internal pivot never seen by the project).
- **Value-type normalization at the boundary is mandatory** — hex / ARGB int / 0–1 float / oklch; no two sources agree. Normalize to the DTCG structured color object.
- **Match on role/name, not position** (M3 `--md-sys-color-*`, Radix step numbers, DTCG paths) — except Open Color (positional).
- **Support generative + static** — M3 (seed) and Leonardo (contrast ratios) persist inputs and derive; everyone else persists swatches. CSS L5 lets us do generative derivation natively in-cascade.
- **Lossy seeds** (ASE/ACO/GPL) fill the primitive tier only; synthesize ramps + semantic aliases on top.

## Open forks (for the eventual decision turn)

1. **Which sources first** — DTCG file (trivial) vs Tailwind vs M3 seed vs Figma API vs ASE/GPL swatches. Prioritized subset or a fork.
2. **Static-only vs static + generative** ingest.
