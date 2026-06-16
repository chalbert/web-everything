---
type: issue
workItem: story
size: 8
parent: "715"
status: open
blockedBy: ["716", "717", "744"]
dateOpened: "2026-06-15"
tags: []
---

# Cross-bundler trait conformance suite — one fixture, identical manifest + chunk isolation everywhere

A conformance suite that runs one fixture (a component binding a lazy trait, an eager trait, and a preload trait) through every supported bundler (Vite, Rollup, webpack, esbuild, Parcel) and asserts they emit an identical manifest AND identical chunk isolation — an unused trait produces zero chunk under each. Mirrors the proven patterns next door: #234's 4-bundler marker test, #238's real webpack build, #506's MaaS golden vectors. This is what makes 'tree-shakable everywhere' a verified property rather than a per-bundler hope. Blocked on the #716 contract (the golden manifest) and #717 (the baseline implementations to test).
