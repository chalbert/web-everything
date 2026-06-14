---
type: idea
workItem: story
size: 3
parent: "586"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "intent:expressive-symbol (src/_data/intents.json)"
tags: []
---

# Author the expressive-symbol rendering intent (substrate)

Author the new expressive-symbol intent (sibling to icon, per #370 Fork 2) in intents.json + njk: a content/meaningful glyph distinct from the UI-affordance icon. Modes: emoji glyph + sticker (custom-image; label required, no CLDR fallback). Owns its accessible-name dimension (meaningful role=img + CLDR-short-name fallback; decorative opt-in). Skin-tone + text/emoji presentation as Unicode dimensions (VS15/VS16, emoji modifier base). Carries the render-strategy platform-config schema (native-font|image-set+vendor) but mandates no default — default-less, inherited/extended from platform flavor. Substrate for the picker + reaction consumers.

## Progress

- **Resolved 2026-06-14.** Authored the `expressive-symbol` intent in `src/_data/intents.json`
  (footgun-safe single-entry splice — 48 insertions, 0 deletions; no whole-file roundtrip). Sibling of
  `icon`, content/meaningful glyph. Five dimensions: **mode** (emoji | sticker — sticker requires a
  label, no CLDR fallback), **accessibleName** (meaningful | decorative; default meaningful — owns the
  accessible-name concern: role=img + CLDR-short-name fallback for emoji, explicit label for sticker,
  decorative is opt-in), **skinTone** (Unicode Fitzpatrick emoji modifier), **presentation** (VS15/VS16
  text-vs-emoji variation selector), **renderStrategy** (native-font | image-set+vendor — default-less
  platform config, inherited from the platform flavor per #370, WE mandates no default). Description
  carries the TS interface (ExpressiveSymbolIntent + ExpressiveSymbolRenderConfig). Page renders at
  /intents/expressive-symbol/ (11ty build smoke: 1539 pages, clean). Substrate for the #586 picker +
  reaction consumers.
