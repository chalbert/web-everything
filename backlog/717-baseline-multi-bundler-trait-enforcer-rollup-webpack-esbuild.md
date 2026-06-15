---
type: issue
workItem: story
size: 8
parent: "715"
status: open
blockedBy: ["716"]
dateOpened: "2026-06-15"
tags: []
---

# Baseline multi-bundler trait Enforcer: Rollup, webpack, esbuild, Parcel

Implement the trait Enforcer (usage-scan → manifest of code-split trait chunks) for the four major bundlers beyond Vite, against the #716 neutral contract. Mirrors the component-compiler precedent #234 (one card delivered Rollup/webpack/Babel wrappers for the <component> transform) — same shape, applied to traits. Each bundler integration scans templates for trait attributes and emits per-trait chunks + the virtual manifest, so an unused trait ships zero bytes regardless of toolchain. Rollup is likely cheapest (the Vite plugin's hook shape is already Rollup-compatible). Conformance that all four agree byte-for-byte is the separate #716-gated suite.
