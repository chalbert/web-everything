---
kind: story
size: 3
parent: "1254"
locus: plateau-app
status: open
dateOpened: "2026-06-22"
tags: []
---

# plateau-app Control Plane dashboard onto FUI badge/status block

Migrate the Control Plane dashboard (plateau:src/control-plane/dashboard.ts) off hand-rolled DOM onto FUI status badges + tables. Ratchet release of #1254 now that the FUI badge/status gap #1288 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.
