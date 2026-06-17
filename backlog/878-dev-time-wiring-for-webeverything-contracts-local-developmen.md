---
type: issue
workItem: story
size: 2
parent: "872"
status: open
blockedBy: ["874"]
dateOpened: "2026-06-17"
tags: []
---

# Dev-time wiring for @webeverything/contracts (local development without republish)

Let contracts be developed across repos without a publish on every change (per the #834 discussion: 'during development we could use npm link or similar'). Wire a dev-time path — prefer TS project references / a file: or workspace dependency over npm link (which is flaky on relink/resolution; type-only dodges the dual-runtime bug but path-mapping is cleaner). Release builds still use the published version (#877). Risk-mitigation story for the #872 epic addressing dev-loop friction.
