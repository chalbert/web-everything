---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-20"
tags: []
---

# Land the WE to @frontierui/plugs repoint for real (the #449 repoint is incomplete — WE still imports local plugs)

Although #449 is marked `status: resolved`, the WE tree has NOT repointed onto `@frontierui/plugs`: that package is absent from `we:package.json` and `we:node_modules`, and `we:blocks/*` + `we:src/*` still import heavily from the local `we:plugs/` (200+ files, including actively-built webportals slices). The #449 close was on-paper only. This item is the real remaining work the #1047 deletion waits on: wire WE to consume `@frontierui/plugs` (publish/alias the FUI plugs package, repoint WE imports off `we:plugs/`, verify the build is green importing from FUI), so that #1047 can then safely delete `we:plugs/`. Surfaced repeatedly in batch close-outs (#1047 stays blocked-in-fact until this lands). Reconcile vs #449: this is the un-done half of that item.
