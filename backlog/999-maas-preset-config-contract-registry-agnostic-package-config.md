---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["978"]
dateOpened: "2026-06-19"
tags: []
---

# MaaS preset-config contract — registry-agnostic package config schema (A3)

Implement the #979-ratified A3 surface: WE owns a registry-agnostic preset-config schema (a package's default export is a declarative {form,target,strategy,...} object, eslint-config pattern), the C1 carrier (?preset=<id>), B1 composition (explicit params override the preset), and the private-overlay precedence rule (reserved sigil shadows public resolution). npm is the native default registry but the schema is resolver-agnostic (JSR/URL ok). Declarative-not-executable config is fixed. Resolution code + catalog are origin/FUI (#855/#817); only the schema crosses into WE. Gated on #978 surfacing real param-list pain.
