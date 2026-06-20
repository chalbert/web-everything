---
kind: story
size: 3
parent: "1259"
locus: plateau-app
status: open
dateOpened: "2026-06-20"
tags: []
---

# Evaluate deferring the on-device tier to the browser-native Prompt API (Gemini Nano)

Chrome ships a built-in on-device model via the Prompt API (Gemini Nano) — zero-download, zero per-call cost. Evaluate deferring part of the Plateau on-device tier to this browser-native model where available, per native-first (#031) and the cost-linearity rule: a native built-in model is the ideal fixed-cost path, with the bundled ONNX / Transformers.js tiers as fallback for browsers without it. Surfaced by the 2026-06-20 model-capability watch (#1259).
