---
kind: story
size: 3
parent: "1599"
status: open
dateOpened: "2026-06-26"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, code-view, transient-ce, embed-boundary]
---

# FUI code-view transient-CE embed entry (we-code-view) + SSR baseline

The foundational prerequisite for the #1599 code-view migration family (#1604/#1605/#1606), mirroring the badge family's #1758 embed entry. Ship fui:embed/code-view-in-document.ts — a runtime cross-origin-importable entry that calls registerCodeView('we-code-view') and injects the code-view block CSS once into the host document, the rule-7 transient-CE counterpart to fui:embed/badges-in-document.ts. Decide the SSR/FOUC baseline for a SHADOW-DOM transient CE (CodeViewElement uses a shadow root, unlike the light-DOM self-replacing we-badge): how the server-rendered pre-upgrade code surface avoids a flash and what we-code-view{} baseline WE ships. Wire the import into we:src/_layouts/base.njk alongside the #1758 badges import. Once shipped, the three migration children unblock: swap the njk pre/code surfaces to we-code-view.
