---
type: issue
workItem: story
size: 3
parent: "507"
status: resolved
blockedBy: ["547"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# First foreign native target — .NET backend

Slice 2 of #507 (epic). A language-backend implementing the slice-1 (#547) interface that emits an idiomatic native .NET MaaS origin (own output tree) from the neutral contract (servePathIR.ts). Runtime is AI-free pure-native; Wasm out of scope. .NET chosen as first foreign target (which-first prioritization, not a fork — Java is a future sibling reusing #547/slice-3/slice-4). Home: generation/targets/dotnet/. Per #463 fork a.
