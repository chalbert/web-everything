---
type: idea
workItem: story
size: 3
parent: "1095"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: plugs/webbehaviors/CustomAttributeRegistry.ts
tags: []
---

# webbehaviors: whenDefined(name) on CustomAttributeRegistry

Add the spec-required whenDefined(name):Promise (spec we:src/_includes/project-webbehaviors.njk:113) to we:plugs/webbehaviors/CustomAttributeRegistry.ts: resolve immediately if defined, else a pending-resolver map drained inside define() (we:plugs/webbehaviors/CustomAttributeRegistry.ts:178) covering the lazy path (:610). Do NOT copy the rejecting webregistries stub. Demo: unit resolves sync, on later define(), and on lazy-load completion.
