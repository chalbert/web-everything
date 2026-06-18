---
type: issue
workItem: story
size: 2
parent: "880"
status: open
dateOpened: "2026-06-18"
relatedReport: reports/2026-06-18-locus-migration-lowconf.md
tags: []
---

# Spot-check the 394 we: locus defaults from the #885 migration; correct any that are fui/plateau

The #885 bulk repo-locus migration defaulted 394 path tokens (237 distinct) that resolved in no tree to we:. The full list is fenced in we:reports/2026-06-18-locus-migration-lowconf.md. Quality follow-up: spot-check the list and correct any that should be fui:/plateau:. Low risk — these are overwhelmingly WE-historical or WE-conceptual paths (e.g. we:base.html, removed in #795), and we: is the correct default for the backlog's own conceptual refs. Not blocking; the gate is green either way.
