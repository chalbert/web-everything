---
bornAs: xgr6vaq
kind: task
parent: "2357"
status: open
blockedBy: ["2762"]
dateOpened: "2026-07-28"
tags: []
---

# Native PHP SSR renderer: resource:loader + defer directives

Add the two passthrough directives to the PHP renderer (rides slice A's scaffold): resource:loader emits the success branch with resolved data inline (zero-JS baseline), defer emits the placeholder branch only (the content branch is stamped client-side). Both are simple inner-branch emits over interpolate. Demo: passes resource-loader + defer vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
