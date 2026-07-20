---
kind: story
size: 5
parent: "2346"
status: resolved
blockedBy: ["2341"]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "plateau:packages/saas/"
tags: []
---

# Extract packages/saas — hosted product surface as a workspace package

Move the SaaS production into plateau:packages/saas as @plateau/saas: the control-plane, marketing, web-docs, and profiles surfaces (plateau:src/control-plane/, plateau:src/marketing/, plateau:src/web-docs/, plateau:src/profiles/), depending on @plateau/core. This is the hosted/product-facing package, kept distinct from the dev-browser tool and the CLI tooling so its build + deploy footprint is isolated.
