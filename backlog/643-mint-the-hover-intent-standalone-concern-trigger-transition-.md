---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["609"]
dateOpened: "2026-06-14"
tags: []
---

# Mint the hover-intent standalone concern (trigger-transition) + its Technical Configurator card

Ratified by #609 Fork 2A: hover-intent (open/close-delay + safe-area corridor tolerating diagonal trigger→panel travel) is a standalone reusable concern, NOT a dimension on the anchor intent — it's a trigger-transition behavior orthogonal to anchor's placement/dismissal contract, composed by reveal-nav, menu submenus, and hovercards. Mint it as a small intent in intents.json (intent-UX-only: "tolerate diagonal travel; don't open on incidental pass-through"). The unsettled mechanic (delay-only vs CSS safe-area bridge vs JS pointer-direction polygon) is NOT part of the intent — author it as a Technical Configurator card (delay ms / close-delay / safe-area strategy / touch) in plateau-app per intent-UX-only→configurator.
