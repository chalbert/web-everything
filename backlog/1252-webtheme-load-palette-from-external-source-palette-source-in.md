---
kind: story
size: 5
parent: "364"
status: resolved
dateOpened: "2026-06-20"
blockedBy: ["1274"]
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webtheme/paletteSource.ts"
relatedReport: "reports/2026-06-20-palette-source-ingest.md"
tags: []
---

# webtheme: load palette from external source (palette-source ingest adapter)

## Progress (batch-2026-06-20) — DONE (first slice; broader source set is follow-on)

Built the ingest boundary in `we:webtheme/paletteSource.ts` per the #1274 ruling:
- **Default-less open registry** `CustomPaletteSourceRegistry` (#1274 Fork 1 → A) — ships empty, mandates
  no fixed source; a project registers the parsers it wants (Config-Extends-Platform-Default). No live/
  credential-holding client (file/snapshot shapes only, #817).
- **Shared value-type normalization** (`normalizeColorValue` + `argbIntToHex` / `floatRgbToHex`) — hex /
  ARGB-int (Material MCU) / Figma 0–1 float / oklch string all normalize to webtheme's pivot string value,
  so the token feeds `extends → derive → compile` unchanged.
- **First two built-in parsers** (the #1274 build order, DTCG → Tailwind): `parseDtcgPalette` (passthrough
  — the source already is the pivot) + `parseTailwindPalette` (`{family:{shade:value}}` → DTCG color group,
  matched on name). A static-mode ingest; generative-seed (Fork 2 → A) hands off to the existing
  `we:webtheme/schemes.ts` derive (no baking).
- 11 tests (`we:webtheme/__tests__/paletteSource.test.ts`) incl. an end-to-end ingest → `extendTokens` →
  `resolveTokens` → `compileToCss` proving the normalized palette flows through. Gate green.

**Follow-on (prioritization, not forks, per #1274):** the Material 3 seed / ASE-GPL / Figma-Variables-export
parsers register against the same contract; and the richer DTCG **structured-color object**
(`{colorSpace, components, alpha, hex}`) is a token-model enhancement over the current string pivot — both
deferred. Reuse `plateau:plateau-app/src/design-system-creator/importAdapter.ts` (#889) shapes when adding them.
webtheme already adopts DTCG 2025.10 as its internal token model (we:webtheme/tokens.ts parses docs, resolves `{alias}` refs, deep-merges via `extends`) and derives schemes/accent natively (we:webtheme/schemes.ts, we:webtheme/compile.ts). This item adds an **import boundary** in front of that model: a per-source parser/adapter that normalizes an externally-authored palette into the DTCG color-token pivot, which then feeds the existing extends → derive → compile path. Mirrors the Style Dictionary `source → parser → normalized pivot → emit` architecture and our ratified adapter-as-normalization-hub pattern (ingest incumbents bottom-up into a lossy internal pivot). File-then-review — research done, build not started.

## Scope notes (two forks carved to #1274 — this build is `blockedBy` it)

The two genuine forks once listed here are now carved to the `type:decision` #1274
(webtheme palette-source ingest: source priority + static-only vs generative), which blocks
this build: (1) which sources first / at all, (2) static-swatch ingest only vs static +
generative. Do not decide them in this story body — resolve #1274 first, then build to its ruling.

Settled implementation constraints (not forks):

- **Pivot = DTCG color tokens** — webtheme's existing internal model; per adapter-as-normalization-hub, each source gets a parser that normalizes into it.
- **Value-type normalization at the boundary is mandatory** — hex / ARGB int (MCU) / 0–1 float (Figma) / oklch (Tailwind v4); no two sources agree. Normalize to the DTCG structured color object (`{colorSpace, components, alpha, hex}`).
- **Lossy-seed sources** (ASE/ACO/.gpl carry flat colors only — no scales/semantics/aliases/alpha): treat as primitive-tier seeds, then synthesize ramps + semantic aliases on top.
- **Match on role/name, not position** (Radix step numbers, M3 `--md-sys-color-*`, DTCG paths) — except Open Color, which is positional.

## Prior art

Full standards + prior-art sweep in we:reports/2026-06-20-palette-source-ingest.md (DTCG 2025.10 color module, native CSS Color 4/5, Material 3 / Tailwind / Leonardo / Radix / Open Color / Style Dictionary / Tokens Studio-Figma / ASE-GPL interchange).

## Lineage

Extends the resolved #364 (unified design-token / theming system) — the palette-ingest seam its DTCG adoption makes possible. Does not reopen #364; sits beneath the #747 design-system bundle layer (a bundle could name an external palette source).

**Cross-reference #889** (resolved, locus plateau-app): the Plateau design-system *creator* already ships `parseDtcg` + `parseFigmaVariables` (plateau:plateau-app/src/design-system-creator/importAdapter.ts) that normalize DTCG + Figma variables into the creator's flat `themeTokens` pivot. Distinct track per the constellation — #889 is the **product-layer** import into a creator UI; #1252 is the **standard-layer** import boundary into webtheme's DTCG model. Reuse/mirror #889's parsers rather than rebuilding them; the open work here is the standard-side seam + the broader source set (Tailwind / Material 3 seed / ASE-GPL swatches) #889 doesn't cover.
