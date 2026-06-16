---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["770"]
dateOpened: "2026-06-16"
tags: []
---

# Auto-derive the a11y gate route set from the 11ty collection/sitemap

Replace the hand-maintained route allowlist (#770/#771) with auto-derivation from the 11ty collection/sitemap so every published page is gated automatically. Fork 3's deferred alternative in #763 — a genuine nice-to-have that becomes more attractive once the page set is component-generated and stable (post dogfood-rework), but couples the gate to the build graph and scans churn-y in-progress pages, so it's a later enhancement, not the day-one shape.
