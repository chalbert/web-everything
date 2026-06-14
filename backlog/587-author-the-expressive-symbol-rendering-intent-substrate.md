---
type: idea
workItem: story
size: 3
parent: "586"
status: open
dateOpened: "2026-06-14"
tags: []
---

# Author the expressive-symbol rendering intent (substrate)

Author the new expressive-symbol intent (sibling to icon, per #370 Fork 2) in intents.json + njk: a content/meaningful glyph distinct from the UI-affordance icon. Modes: emoji glyph + sticker (custom-image; label required, no CLDR fallback). Owns its accessible-name dimension (meaningful role=img + CLDR-short-name fallback; decorative opt-in). Skin-tone + text/emoji presentation as Unicode dimensions (VS15/VS16, emoji modifier base). Carries the render-strategy platform-config schema (native-font|image-set+vendor) but mandates no default — default-less, inherited/extended from platform flavor. Substrate for the picker + reaction consumers.
