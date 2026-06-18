---
type: idea
workItem: story
size: 5
parent: "715"
status: parked
blockedBy: []
dateOpened: "2026-06-15"
tags: []
---

# SWC-native trait transform (Turbopack/rspack) + Babel pre-step — deferred until adoption

The SWC-native path (a Rust/WASM SWC plugin powering Turbopack/rspack) and a Babel transform pre-step for the trait Enforcer, against the #716 contract. Explicitly deferred-until-adoption, mirroring the parked #232 verdict that a Rust/WASM SWC plugin for <component> is 'only worth it if heavy-SWC adoption demands it' and #234's treatment of Babel as a documented pre-step rather than a full impl. Carried as a real card so the gap is visible, but lower priority than the four baseline bundlers (sibling baseline card). Ship only when real SWC/Turbopack adoption forces it.
