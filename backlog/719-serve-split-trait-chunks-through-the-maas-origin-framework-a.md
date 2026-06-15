---
type: issue
workItem: story
size: 5
parent: "715"
status: open
blockedBy: ["716", "461"]
dateOpened: "2026-06-15"
tags: []
---

# Serve split trait chunks through the MaaS origin (framework-agnostic fetch)

Wire the code-split trait chunks through the #461 MaaS distribution origin so the split traits are fetchable framework-agnostically — a non-Vite/non-bundler consumer pulls only the traits a component binds, over HTTP. Reuse the substrate already built: #461's Fetch origin, #462's eager hot-set / lazy-default distribution policy, and #505's serve-path IR (or a trait-specific extension of it). Today the MaaS origin serves <component> module artifacts, not trait chunks — this is the integration that brings traits onto the served path. Blocked on the #716 neutral contract (so served manifests match built ones) and on #461 (the origin).
