---
kind: story
size: 3
parent: "1259"
locus: plateau-app
status: open
dateOpened: "2026-06-20"
tags: []
---

# Evaluate the WebNN/NPU path and faster WebGPU runtimes for the in-browser vision provider

Browser inference matured: WebNN now targets NPUs (Intel Core Ultra, Snapdragon X, Apple M-series) at far lower power, and faster WebGPU runtimes (WeInfer about 3.76x over WebLLM, plus Transformers.js and WebLLM) raise the ceiling. Evaluate adding a WebNN/NPU path and benchmarking these runtimes for the in-browser vision provider (#514 ONNX Runtime Web + WebGPU, #1082 Transformers.js Tier-2) — lower power for always-on classification, faster Tier-2. Surfaced by the 2026-06-20 model-capability watch (#1259).
