---
kind: story
size: 5
parent: "364"
status: open
dateOpened: "2026-06-20"
relatedReport: "reports/2026-06-20-palette-source-ingest.md"
tags: []
---

# webtheme: load palette from external source (palette-source ingest adapter)

webtheme already adopts DTCG 2025.10 as its internal token model (we:webtheme/tokens.ts parses docs, resolves `{alias}` refs, deep-merges via `extends`) and derives schemes/accent natively (we:webtheme/schemes.ts, we:webtheme/compile.ts). This item adds an **import boundary** in front of that model: a per-source parser/adapter that normalizes an externally-authored palette into the DTCG color-token pivot, which then feeds the existing extends → derive → compile path. Mirrors the Style Dictionary `source → parser → normalized pivot → emit` architecture and our ratified adapter-as-normalization-hub pattern (ingest incumbents bottom-up into a lossy internal pivot). File-then-review — research done, build not started.

## Scope notes (carve a type:decision at pickup)

Two genuine forks live here — when this item is picked up, carve them to a `type:decision` item that blocks the build (do not decide them in this story body):

1. **Which sources first / at all** — DTCG color file (already the pivot — trivial), Tailwind `family→{shade:hex}` map, Material 3 seed or scheme JSON, Figma Variables REST (0–1 float `{r,g,b,a}`), flat swatch files (ASE, GIMP .gpl). Prioritized subset vs broad adapter set.
2. **Static-swatch ingest only vs static + generative** — Material 3 (HCT seed) and Adobe Leonardo (contrast ratios) persist *inputs* and derive; everyone else persists swatches. CSS Color L5 (`oklch(from …)`, `color-mix()`) lets us do the generative derivation natively in-cascade.

Settled implementation constraints (not forks):

- **Pivot = DTCG color tokens** — webtheme's existing internal model; per adapter-as-normalization-hub, each source gets a parser that normalizes into it.
- **Value-type normalization at the boundary is mandatory** — hex / ARGB int (MCU) / 0–1 float (Figma) / oklch (Tailwind v4); no two sources agree. Normalize to the DTCG structured color object (`{colorSpace, components, alpha, hex}`).
- **Lossy-seed sources** (ASE/ACO/.gpl carry flat colors only — no scales/semantics/aliases/alpha): treat as primitive-tier seeds, then synthesize ramps + semantic aliases on top.
- **Match on role/name, not position** (Radix step numbers, M3 `--md-sys-color-*`, DTCG paths) — except Open Color, which is positional.

## Prior art

Full standards + prior-art sweep in we:reports/2026-06-20-palette-source-ingest.md (DTCG 2025.10 color module, native CSS Color 4/5, Material 3 / Tailwind / Leonardo / Radix / Open Color / Style Dictionary / Tokens Studio-Figma / ASE-GPL interchange).

## Lineage

Extends the resolved #364 (unified design-token / theming system) — the palette-ingest seam its DTCG adoption makes possible. Does not reopen #364; sits beneath the #747 design-system bundle layer (a bundle could name an external palette source).
