---
type: idea
workItem: story
size: 5
parent: "658"
status: open
dateOpened: "2026-06-17"
locus: frontierui
relatedProject: webdocs
tags: [dogfood, fui-blocks, chrome]
---

# Build the must-build FUI chrome blocks (app-shell, sectioned-disclosure nav, button) for the WE-docs dogfood

The #778 inventory mapped WE-docs chrome to FUI and flagged three FUI blocks the header/nav/footer/shell migration needs that FUI does not yet ship: app-shell/header layout primitive (C1), a sectioned-disclosure nav panel (C5 — nav-list is flat, not sectioned), and a button block (C6/C7 toggle + icon buttons). These are the must-build critical path: WE-docs chrome cannot mount what FUI doesn't ship. Build them as @frontierui/blocks families with mode-C mountInDocument exports so #865 can mount them. Locus FUI (impl→FUI per #765).
