---
type: issue
workItem: story
size: 3
parent: "715"
status: open
blockedBy: ["716"]
dateOpened: "2026-06-15"
tags: []
---

# Publish the trait tree-shaking story publicly on the Frontier UI website

Public documentation of the trait code-splitting / tree-shaking model on the Frontier UI website (FUI owns implementation docs and its own rendered display per the docs-rendering boundary). Cover: traits as the unit of code-splitting, the usage-scan → manifest → per-trait chunk pipeline, eager vs lazy vs preload delivery, the composed-component 'declare only the traits you bind' pattern, and the cross-bundler + MaaS reach. Ensures the capability is publicly discoverable, not just implemented. Blocked on the #716 contract being settled so the docs describe the neutral model, not a Vite-specific accident.
