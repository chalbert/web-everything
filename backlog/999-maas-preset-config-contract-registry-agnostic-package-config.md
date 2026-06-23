---
kind: story
size: 5
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: #1258 files a servePathIR form-catalog strain case"
dateOpened: "2026-06-19"
tags: []
---

# MaaS preset-config contract — registry-agnostic package config schema (A3)

Implement the #979-ratified (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule) A3 surface: WE owns a registry-agnostic preset-config schema (a package's default export is a declarative {form,target,strategy,...} object, eslint-config pattern), the C1 carrier (?preset=<id>), B1 composition (explicit params override the preset), and the private-overlay precedence rule (reserved sigil shadows public resolution). npm is the native default registry but the schema is resolver-agnostic (JSR/URL ok). Declarative-not-executable config is fixed. Resolution code + catalog are origin/FUI (#855/#817); only the schema crosses into WE.

**Parked `maturityGated` — building the preset schema now means guessing its shape against zero real param-list pain (the worse-artifact hazard).** Unparks when the [#1258 framework-churn watch](/backlog/1258-framework-churn-watch-keep-we-s-forward-adapters-current-as-/) — which absorbed the MaaS serve-contract currency watch from the retired #978 — files a real `servePathIR` form-catalog strain case. (Was previously `blockedBy: #978`; repointed when #978 folded into #1258, 2026-06-22.)
