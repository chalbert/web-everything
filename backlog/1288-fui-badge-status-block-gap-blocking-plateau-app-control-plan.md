---
kind: story
size: 2
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: [fui, gap, dogfood, plateau-app]
---

# FUI badge/status block — gap blocking plateau-app Control Plane dogfood

FUI has no badge/status-indicator block (data-grid covers tables, but no badge). The #1254 plateau-app dogfood found its Control Plane dashboard (we:plateau:src/control-plane/dashboard.ts) hand-rolls status badges, so that surface is could-not-split until FUI ships a badge. Per first-party-dogfood, file the gap. locus: frontierui. Unblocks the Control Plane migration slice once shipped.
