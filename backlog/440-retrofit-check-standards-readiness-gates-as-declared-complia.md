---
type: idea
workItem: story
size: 3
parent: "351"
status: open
blockedBy: ["436", "437"]
dateOpened: "2026-06-12"
tags: []
---

# Retrofit check:standards + readiness gates as declared compliance policies

Re-express the existing hard CI gates — check:standards and the readiness gates — as declared, severity-tagged policies extending the platform default, rather than scattered hardcoded scripts. They are already compliance (hard gates); this folds them in as the seed policy set so the gate set is data. Phase 5 of #351; needs the policy model (#436) and the gate runner (#437).
