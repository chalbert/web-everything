---
kind: story
size: 3
parent: "1254"
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/styles/tokens.json"
tags: []
---

# plateau-app theme: express the proprietary theme as a DTCG token layer for FUI-enhanced markup

Re-express plateau-app's hand-rolled 93-line we:plateau:src/styles/theme.css as a DTCG design-token layer that styles FUI behavior-enhanced HTML — the single differentiator the #1253 first-party-dogfood mandate allows. Note (per the #1254 split investigation): FUI ships NO shared token base; blocks are consumer-themed, so this authors plateau's own DTCG tokens as the CSS layer over FUI markup, not a rebase onto FUI tokens. Foundation slice: underlies every surface migration, independent of any FUI block shipping. Demoable: plateau-app at :4000 renders with the DTCG-sourced theme.

## Progress

Re-expressed the hand-rolled 93-line `plateau:src/styles/theme.css` as a DTCG (Design Tokens Community
Group) token layer — plateau's own tokens (NOT a rebase onto FUI/webtheme; FUI ships no shared base):

- `plateau:src/styles/tokens.json` — the DTCG source of truth: groups `color` / `gradient` / `font` /
  `space` / `radius` / `shadow` / `transition` + top-level `ease` / `ease-out` / `sidebar-width` /
  `header-height`, each leaf `{ $type, $value }`. Cross-token wiring uses DTCG `{group.token}` refs
  (e.g. `color.info → {color.primary}`, `transition.fast → "0.14s {ease}"`).
- `plateau:scripts/gen-tokens.mjs` — dependency-free generator: flattens plateau:src/styles/tokens.json to CSS custom
  properties wrapped in `@layer tokens { :root { … } }`. A token's var name is `--` + its dot-path
  joined by `-`, which **preserves every existing variable name** (`--color-primary-hover`, `--space-1`,
  `--ease`, …) so plateau:src/styles/{layout,pages,reset}.css keep working unchanged. `{refs}` → `var(--…)`.
- `plateau:package.json` — `gen:tokens` script; `plateau:src/styles/theme.css` is now GENERATED (57
  tokens) with a do-not-edit header.

**Verified at :4000 (Playwright, computed styles on `:root`):** `--color-primary #6d5efc`,
`--color-info` resolves to `#6d5efc` (the `{color.primary}` ref), `--transition-fast` →
`0.14s cubic-bezier(0.4, 0, 0.2, 1)` (the `{ease}` ref resolves through the layer), `--sidebar-width
248px`, `--gradient-brand`/`--radius-sm`/`--space-4` all identical to the pre-change values — zero
console errors, pixel-identical render. The `@layer tokens` wrapping resolves correctly (no competing
declarations for these properties). Foundation slice for #1254 surface migrations. Fixed `locus`
(was `webeverything`) → `plateau-app`.
