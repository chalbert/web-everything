---
kind: story
size: 3
parent: "1601"
status: open
dateOpened: "2026-06-26"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, card, transient-ce, embed-boundary]
---

# FUI card transient-CE embed entry (we-card) + SSR baseline

The foundational prerequisite unblocking the #1601 catalog tiles-to-card family (#1607/#1608) — the card counterpart to the badge `#1758` embed entry and the code-view `#1785`. Ship `fui:embed/card-in-document.ts`: a runtime cross-origin-importable entry registering a transient `<we-card>` over `fui:blocks/card/CardElement` and injecting the card CSS once into the host document. Decide the card CE's SSR/FOUC baseline — does it self-replace to light-DOM like `we-badge` or keep a shadow root, and what `we-card{}` SSR baseline WE ships so the pre-upgrade tile doesn't flash. Wire the import into `we:src/_layouts/base.njk`; then #1607/#1608 unblock.
