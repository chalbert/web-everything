---
type: issue
workItem: task
status: open
dateOpened: "2026-06-18"
parent: "746"
locus: frontierui
relatedProject: webadapters
tags: [maas, polyglot, block-explorer, frontierui]
---

# FUI: register react-wrapper/vue-wrapper form-catalog values; retire React-only functional form

Per #974 (A1 ruling): the MaaS wrapper-serve need rides the existing catalog-gated `form` param — no new WE contract surface. Register `react-wrapper`/`vue-wrapper` as injected FUI catalog values on the servePathIR `form` seam (validated against the injected catalog, unknown→400), and retire the accidentally React-only `functional` form by folding it into `react-wrapper`. genWrapper(cem,target) is the transform-provider injected at the endpoint. locus:frontierui. Provisional — refine the value-set as #912 surfaces real cases; promote to a neutral `framework` param only if forward-adapter routing later demands it (deliberate servePathIR version bump).
