---
kind: story
size: 3
status: open
dateOpened: "2026-06-27"
tags: []
---

# Mint the custom-states plug contract (declared vocabulary + validation + polyfill) under webcomponents

Governed by the #1807 ruling. Mint the WE-owned plug *contract* for the declarative custom-state surface: a new we:src/_data/plugs.json entry under the webcomponents project defining (a) the declared state-vocabulary semantics (the states= attribute + the per-instance constructor-time declaration call), (b) the plugged validation contract (un-declared toggle rejected/warned), and (c) the polyfill contract for the nowhere-native declaration/validation layer. WE holds only the contract; the runtime impl is FUI (separate build). Single-substrate guardrail per #1826: plugged/unplugged is delivery+enforcement over one contract, not two.
