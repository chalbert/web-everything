---
type: issue
workItem: task
parent: "170"
status: open
locus: frontierui
blockedBy: ["447", "448"]
dateOpened: "2026-06-12"
tags: []
---

> **Locus: frontierui (2026-06-13).** This task edits Frontier UI's path-alias config, deletes
> `frontierui/plugs/`, and verifies "FU build + tests green" — it builds and gates in **frontierui**,
> not webeverything. Both blockers (#447, #448) are now resolved, so it's ready — but in the FU repo
> with its own gate. A webeverything `/batch` correctly holds it out of the pool.

# Wire the @we/plugs/* alias in Frontier UI and delete the vendored plugs tree

Once WE is the runtime superset (#447 + #448), point Frontier UI at @we/plugs/* via path alias (the plateau-app precedent) and delete frontierui/plugs/. WE-ahead files (webvalidation×6, webguards×2, declarativeInjector, webinjectors/Injector + index #278, webregistries/CustomElementRegistry) reach FU through the alias automatically — no copy-down (folds in the body's old step (b), which would have been throwaway). Keep FU-only globals.d.ts out of the aliased path. Verify FU build + tests green. Terminal dedup of #170.
