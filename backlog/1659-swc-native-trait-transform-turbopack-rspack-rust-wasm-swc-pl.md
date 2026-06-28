---
kind: story
size: 5
parent: "718"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a real SWC/Turbopack trait consumer"
dateOpened: "2026-06-23"
tags: [webtraits, trait-enforcer, build-tooling, swc, turbopack, rspack, maturity-gated]
---

# SWC-native trait transform (Turbopack/rspack) — Rust/WASM SWC plugin

Build the Rust/WASM SWC plugin that powers the trait Enforcer's usage-scanned code-splitting under Turbopack/rspack, against the #716 contract. Held maturityGated: building now tunes the plugin against no real SWC/Turbopack integration to validate — flips ready on a real SWC/Turbopack trait consumer (named adoptionSignal).
