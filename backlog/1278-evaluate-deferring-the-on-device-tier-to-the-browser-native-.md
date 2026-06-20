---
kind: story
size: 3
parent: "1259"
locus: webeverything
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:reports/2026-06-20-on-device-vision-tier-evaluation.md"
tags: []
---

# Evaluate deferring the on-device tier to the browser-native Prompt API (Gemini Nano)

Chrome ships a built-in on-device model via the Prompt API (Gemini Nano) — zero-download, zero per-call cost. Evaluate deferring part of the Plateau on-device tier to this browser-native model where available, per native-first (#031) and the cost-linearity rule: a native built-in model is the ideal fixed-cost path, with the bundled ONNX / Transformers.js tiers as fallback for browsers without it. Surfaced by the 2026-06-20 model-capability watch (#1259).

## Progress

Evaluated deferring the on-device tier to the browser-native Prompt API (Gemini Nano) — see `we:reports/2026-06-20-on-device-vision-tier-evaluation.md`
§#1278. Recommendation (~80%): add the Prompt API as the **top of the on-device cascade** behind a
capability probe (zero-download, zero-cost — the ideal native-first/#031 cost-linearity path), routing
supported tasks to it and **degrading to the bundled ONNX/Transformers.js tiers** (the #1276 ladder) for
browsers without it. Residual: Chrome-only + availability-gated + multimodal still emerging → never let
cascade correctness depend on it; the bundled tiers stay the guaranteed floor. Filed as a cascade-ordering
build on #488; locus fixed plateau-app→webeverything.
