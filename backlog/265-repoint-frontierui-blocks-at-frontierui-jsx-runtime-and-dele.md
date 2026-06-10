---
type: issue
workItem: story
size: 3
parent: "125"
status: open
blockedBy: ["240", "264"]
dateOpened: "2026-06-10"
tags: []
---

# Repoint frontierui blocks at @frontierui/jsx-runtime and delete the divergent copy

Once the package JSXRenderer is re-synced to canonical (#240) and the bare-specifier resolution is settled (#264): point frontierui/blocks/renderers/jsx at @frontierui/jsx-runtime, delete the older divergent copy #2, update vite.config.mts jsxInject/jsxFactory + tsconfig, and verify both repos' suites (FUI JSXRenderer.test.ts + build, WE blocks suite + check:standards). Slice B of the #240 dedupe.
