---
kind: story
size: 3
parent: "081"
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/module-service/reactivity.ts
tags: []
---

# Module-as-a-Service — reactivity (callbacks / effects / change detection)

Spun out of #081 (MaaS v1 close-out). The served functional form renders once; this adds the reactivity model — lifecycle callbacks, effects, change detection. Folds into the render-strategy Protocol (#052/#078) plus a future customChangeDetectorRegistry rather than baking a reactivity model into MaaS. Independent of the other #081 follow-ons.
