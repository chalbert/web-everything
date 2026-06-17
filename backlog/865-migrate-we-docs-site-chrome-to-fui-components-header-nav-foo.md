---
type: idea
workItem: story
size: 5
parent: "777"
status: open
blockedBy: ["870"]
dateOpened: "2026-06-17"
tags: []
---

# Migrate WE-docs site chrome to FUI components (header/nav/footer/shell)

Replace the hand-written base.njk header/nav (the #645 reveal-nav), footer, and page-shell with FUI component impl mounted in-document via the mode-C DI-mount SDK (#786, resolved). Gate cleared: #765 (relax) and the #786 mode-C build both resolved. Core chrome migration slice.

## Re-blocked 2026-06-17 (batch-2026-06-17 pre-flight) — blocked-in-fact on the must-build FUI chrome blocks

Claimed in a batch; the body's "gate cleared" is true for the *mount mechanism* (mode C #786 + #765 relax both shipped) but **not** for the *components to mount*. The plan of record — the [#778 WE-docs UI→FUI inventory](../reports/2026-06-16-we-docs-ui-inventory-fui-map.md) — maps this exact chrome and flags it **must-build**: the header/page-shell (C1 app-shell), the sectioned-disclosure nav (C5 — `nav-list` is flat, not sectioned), and the nav-toggle + icon buttons (C6/C7 `button`) are all **FUI gaps**. Verified absent: `frontierui/src/_data/blocks.json` ships no `app-shell`/`disclosure`/`button`, and `frontierui/demos/` has only the one mode-C demo (`embed-dialog-in-document`). The inventory's own sequencing note: *"WE-docs chrome cannot mount what FUI doesn't ship … C1/C5/C6/C7 wait on the must-build set."*

Filed that prerequisite as **#870** (build the must-build FUI chrome blocks; locus FUI) and set this item `blockedBy: ["870"]`. Released to `open`; cascade-frees once #870 ships. The mountable subset (C4 `nav-list`, which already exists) is a smaller slice that could be carved separately if the full-chrome migration stays blocked — but as written this card is the whole header/nav/footer/shell, which is gated.
