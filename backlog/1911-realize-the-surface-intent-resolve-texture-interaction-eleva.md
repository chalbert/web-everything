---
kind: story
size: 5
relatedProject: webtraits
graduatedTo: "we:webtraits/surfaceIntentResolver.ts — the surface-intent → CSS resolver (+ realized elevation/variant dimensions on we:src/_data/intents/surface.json; hovercard surface composed from it)"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: [surface, intent, realize-declared-axis, assembler, dogfooding, css-resolver]
---

# Realize the surface intent — resolve texture/interaction (+ elevation/variant) to CSS and compose the hovercard from it

Per #1884's ruling (intent-owns-the-axis), realize the declared `surface` intent: resolve its `texture`/`interaction` dimensions — and realize `elevation`/`variant`, which its protocol declares but its `dimensions` block does not yet carry — to CSS via the trait resolver, then eliminate the raw-CSS blob in `we:src/_data/assemblerPresets/hovercard.json:70` by composing the surface properties from the declared `surface` intent (the preset already declares `composesIntents:[…surface]`). This is the ratified realize-a-declared-axis path and the actual fix for the card dogfood that spawned #1884.

## Resolution (2026-06-28)

- **Realized `elevation` + `variant` as dimensions** on `we:src/_data/intents/surface.json` — they were declared only in the intent's protocol/description (`SurfaceIntent.elevation`, `.variant`); now they are first-class `dimensions` (`elevation`: 0–5, `variant`: default/alt) alongside the existing `texture`/`interaction`.
- **Built the surface→CSS resolver** `we:webtraits/surfaceIntentResolver.ts` — a pure, dependency-free WE-resident resolver (same shape as `we:webtraits/intentProfileResolver.ts` / `we:webcases/requirementValidator.ts`; definition not impl, so it stays in WE per the zero-impl rule). `resolveSurface(profile)` maps a `{texture, interaction, elevation, variant}` profile to token-backed CSS declarations; `surfaceCss(selector, profile)` emits the full ruleset (base + hover/`:focus-visible` + reduced-motion guard). Output prefers `var(--surface-*, <native-first fallback>)` so a design system can re-theme without touching the resolver. Tests: `we:webtraits/__tests__/surfaceIntentResolver.test.ts` (15 cases).
- **Eliminated the hovercard raw-CSS surface blob** — `.hovercard-card`'s surface properties (background, border, box-shadow, lift interaction) in `we:src/_data/assemblerPresets/hovercard.json` are now the build-time emit of `surfaceCss('.hovercard-card', { texture:'solid', elevation:3, interaction:'lift' })`, marked with BEGIN/END realized-surface fences and a header pointing at the resolver. Layout (position/width/padding/flex), disclosure animation (opacity on `[hidden]`), and corner radius (`rounded` — the #1912 residual) stay preset-owned. The FUI recipe engine / Plateau assembler are the runtime consumers of this resolver.
- **Out of scope (filed elsewhere):** `rounded`/`bordered` residual → #1912; app-authored custom intents → #1913.
