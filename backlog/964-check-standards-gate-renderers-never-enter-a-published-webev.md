---
type: issue
workItem: task
status: open
blockedBy: ["956"]
dateOpened: "2026-06-18"
tags: []
---

# check:standards gate — renderers never enter a published @webeverything exports map + per-form codegen-placement rule

Harden #956's ruling (form-generators stay WE-repo reference runtime; @webeverything ships only contract+vectors) by making its two load-bearing invariants enforced, not true-by-absence. (1) Add a check:standards rule asserting no @webeverything/* package exports map reaches blocks/renderers/* (today true only because no such export exists). (2) Elevate #956's per-form refinement from guidance to a gate: a genuinely-new framework target with no WE reference runtime must follow the #855/genWrapper pattern (contract+vectors in WE, generator in FUI), so a demo cannot manufacture a WE-side consumer to keep codegen in WE. Both surfaced by #956's red-team skeptic as hardening residuals.
