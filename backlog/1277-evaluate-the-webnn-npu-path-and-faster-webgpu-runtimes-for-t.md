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

# Evaluate the WebNN/NPU path and faster WebGPU runtimes for the in-browser vision provider

Browser inference matured: WebNN now targets NPUs (Intel Core Ultra, Snapdragon X, Apple M-series) at far lower power, and faster WebGPU runtimes (WeInfer about 3.76x over WebLLM, plus Transformers.js and WebLLM) raise the ceiling. Evaluate adding a WebNN/NPU path and benchmarking these runtimes for the in-browser vision provider (#514 ONNX Runtime Web + WebGPU, #1082 Transformers.js Tier-2) — lower power for always-on classification, faster Tier-2. Surfaced by the 2026-06-20 model-capability watch (#1259).

## Progress

Evaluated the WebNN/NPU path + faster WebGPU runtimes — see `we:reports/2026-06-20-on-device-vision-tier-evaluation.md` §#1277. Recommendation (~70%): add
**WebNN as a capability-gated additional execution provider** to the ONNX Runtime Web provider (#514),
native-first (#031) — probe + select the best EP per device (WebNN/NPU → WebGPU → Wasm), prioritising
WebNN for the **always-on Tier-1 classifier** (power) and keeping WebGPU default for **Tier-2**
(throughput); benchmark WeInfer/Transformers.js/WebLLM for the Tier-2 runtime. Residual: WebNN VLM
op-coverage is uneven → additive EP behind a probe, never the sole path. Filed as a provider-enhancement
build on #514/#1082 (not a contract change); locus fixed plateau-app→webeverything.
