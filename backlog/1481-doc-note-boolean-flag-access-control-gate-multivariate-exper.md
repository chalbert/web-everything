---
kind: task
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Doc note: boolean flag = access-control gate, multivariate = experiment intent (don't re-conflate)

Ratified by #1414. Add a short doc note recording the split so the two halves are not re-conflated: a BOOLEAN feature flag IS the access-control gate (authority: feature-flag, we:src/_data/intents/access-control.json) on the Guard provider seam; a MULTIVARIATE flag (one of N arms) is the separate experiment / variant-assignment intent (#1479). Same provider SHAPE, different outcome families (allow/deny vs pick-one-of-N) and trust boundaries. OpenFeature's typed-flag distinction (boolean=gate, string/object=selector) is the upstream precedent.
