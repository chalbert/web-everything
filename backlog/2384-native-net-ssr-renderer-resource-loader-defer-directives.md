---
kind: task
parent: "2360"
status: open
blockedBy: ["2383"]
dateOpened: "2026-07-10"
tags: []
---

# Native .NET SSR renderer: resource:loader + defer directives

Add the two passthrough directives to the .NET renderer (rides slice A's scaffold): resource:loader emits the success branch with resolved data inline (zero-JS baseline), defer emits the placeholder branch only (the content branch is stamped client-side). Both are simple inner-branch emits over interpolate. Demo: passes resource-loader + defer vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
