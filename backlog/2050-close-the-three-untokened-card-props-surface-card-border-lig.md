---
kind: story
size: 3
status: open
blockedBy: ["2049"]
dateOpened: "2026-07-01"
tags: []
---

# Close the three untokened card props (surface-card, border-light, text-secondary) (#2026 coverage gap)

Ratified by #2026: the card reads --color-surface-card / --color-border-light / --color-text-secondary (fui:blocks/card/Card.ts:92,95,99-100) but they are absent from both defaultTheme (fui:plugs/webtheme/defaultTheme.ts) and the LEGACY_ALIASES source, so they only ever hit literal fallbacks and a loaded theme can't move them. Add the three rows to defaultTheme + the single FUI-owned alias source so they participate in the two-tier projection. Coverage gap, not a fork.
