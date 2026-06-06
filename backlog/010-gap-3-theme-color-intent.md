---
type: decision
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, intent, theme, color]
relatedProject: webintents
---

# Decide on Theme/Color intent (gap #3)

**The most glaring hole in the intents catalog.** We standardized texture (`surface`), type, density, and motion — but never color scheme, contrast, or accent. Native-first is unusually strong *right now*: `color-scheme`, `light-dark()`, `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency`, `@property`-typed tokens. Dimensions sketch: `scheme` (`light`/`dark`/`system`), `contrast` (`normal`/`high`), `accent` (token ref). **Lean: intent-only** for now; defer a full design-token project until there's demand.

## Triage context

- **Kind**: Intent
- **Native anchor**: `color-scheme`, `light-dark()`, `prefers-color-scheme`, `prefers-contrast`
- **Native-first**: ▲ high · **Gap**: ▲ high · **Effort**: ▽ low
- **Rank**: 3 — next (now the lead item after #1 webintl and #2 locale shipped)

## Open call

Intent-only (lean) vs full design-token project.
