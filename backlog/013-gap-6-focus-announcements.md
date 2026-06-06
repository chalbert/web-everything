---
type: decision
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, intent, protocol, a11y, focus]
---

# Decide on Focus & Announcements intent / a11y protocol (gap #6)

Focus-trap, roving tabindex, `inert`, and live-region announcements live **scattered** across `modal`, `type-ahead`, and `selection` but are owned nowhere. A `focus` intent or small a11y protocol would centralize them. Native: `inert`, `aria-live`, focus management, `:focus-visible`.

## Triage context

- **Kind**: Intent and/or Protocol
- **Native anchor**: `inert`, `aria-live`, roving tabindex, focus management
- **Native-first**: ◆ medium · **Gap**: ◆ medium · **Effort**: ◆ medium
- **Rank**: 6

## Open call

Intent vs protocol vs both — and which existing intents (`modal`, `type-ahead`, `selection`) re-point at it.
