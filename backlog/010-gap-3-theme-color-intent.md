---
kind: decision
size: 3
status: resolved
dateOpened: "2026-05-31"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
tags: [gap-analysis, intent, theme, color]
relatedProject: webintents
---

# Decide on Theme/Color intent (gap #3)

**The most glaring hole in the intents catalog.** We standardized texture (`surface`), type, density, and motion — but never color scheme, contrast, or accent. Native-first is unusually strong *right now*: `color-scheme`, `light-dark()`, `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency`, `@property`-typed tokens. Dimensions sketch: `scheme` (`light`/`dark`/`system`), `contrast` (`normal`/`high`), `accent` (token ref). **Lean: intent-only** for now; defer a full design-token project until there's demand.

## Triage context

- **Kind**: Intent
- **Native grounding**: `color-scheme`, `light-dark()`, `prefers-color-scheme`, `prefers-contrast`
- **Native-first**: ▲ high · **Gap**: ▲ high · **Effort**: ▽ low
- **Rank**: 3 — next (now the lead item after #1 webintl and #2 locale shipped)

## Open call

Intent-only (lean) vs full design-token project.

## Resolution (2026-06-11)
**Intent-only, per native-first + intent-UX-only.** Ship a Theme/Color *intent* (`scheme`/`contrast`/`accent`) grounded on the native stack (`color-scheme`, `light-dark()`, `prefers-color-scheme`, `prefers-contrast`); the intent stays UX-only. A full design-token *project* is **deferred** until real demand — token elaboration is the technical half, not an intent dimension. This resolves the intent-vs-project fork; authoring the intent itself is a separate `/new-standard` build.
