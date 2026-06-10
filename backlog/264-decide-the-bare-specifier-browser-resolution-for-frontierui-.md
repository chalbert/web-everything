---
type: decision
workItem: story
size: 2
parent: "125"
status: active
dateOpened: "2026-06-10"
dateStarted: "2026-06-10"
tags: []
---

# Decide the bare-specifier browser resolution for @frontierui/jsx-runtime

Pick how the vite-served browser resolves the @frontierui/jsx-runtime bare specifier when FUI blocks consume the package: built dist vs a vite src-alias vs an importmap entry. #239 noted the importmap currently resolves the package name back to WE's own source, not built dist. Gates repointing FUI's jsxInject off copy #2 (the #240 slice B). Tier-B — needs a ruling, not a build.
