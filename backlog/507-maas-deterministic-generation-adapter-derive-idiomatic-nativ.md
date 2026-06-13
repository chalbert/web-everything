---
type: issue
workItem: story
size: 13
parent: "081"
status: open
blockedBy: ["505", "506"]
dateOpened: "2026-06-13"
tags: []
---

# MaaS deterministic generation-adapter — derive idiomatic native origin per language (AI-improved adapter, human-reviewed) + first .NET/Java target

Ratified in #463 (fork a): build the deterministic generation-adapter that derives an idiomatic, native MaaS origin per language (own repo) from the neutral contract (#505). Generation is deterministic — same source always yields byte-identical code; NO AI in the generation path. AI operates at adapter-development time only: it improves the deterministic adapter (rules/templates, against a regression corpus) until output is perfect-idiomatic — every change human-reviewed (a full-AI cycle is out of scope now). Deterministic-core / HTTP-shell split; fidelity gated by the #506 suite. Ships a first native target (.NET or Java) as proof; Wasm is exotic-only; runtime stays AI-free pure-native.
