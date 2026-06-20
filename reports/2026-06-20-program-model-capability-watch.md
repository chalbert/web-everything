# Model-capability watch (#1259) — living review report

The single living report for the Plateau model-capability watch. Each `/review-program 1259` run
appends a dated section below; the program's `relatedReport` points here so it stays registered.

## 2026-06-20 — first run (L0→L1)

Third program watch of the session. Plateau-side; reaches the WE-consumed vision service only through
the no-leakage client boundary.

### Orient

- **Program:** #1259 — keep Plateau's on-device cost-linearity current as the AI model landscape moves.
- **Plateau machinery (front-A context):** the vision **tier cascade** (#488 resolved) — Tier-1
  distilled classifier (#513 parked, #490 open), Tier-2 small VLM (#1082 Transformers.js provider,
  #1084 training resolved), Tier-3 hosted (BYO-key). Hard rule: cost scales ~linearly with revenue;
  on-device fixed-cost preferred; no uncapped per-call SDK in flat-rate pricing.
- **Prior state:** childless program, first run, no floor metric (L0).

### Front-B delta — the frontier moved *toward* Plateau's thesis

| Movement (2025–26) | Meaning for the cascade |
|---|---|
| Small VLMs far better/smaller — Gemma 3n E2B/E4B (5GB RAM @ 4-bit), Gemma 4 (Apr 2026), Phi-4 multimodal, Qwen 3.5, SmolVLM (256M), UI-specialized ScreenAI/Ferret-UI | Tier-2 does more on-device → push tasks down from hosted Tier-3 (cost-linearity win) |
| Browser inference matured — WebLLM, Transformers.js, WeInfer (~3.76× faster), WebNN/NPU (Intel/Snapdragon/Apple M, low-power) | The #514/#1082 provider gains a faster + lower-power path |
| Chrome built-in Prompt API (Gemini Nano) | Native, zero-download, zero per-call cost on-device model — the ideal cost-linearity path |

### Items filed (4) — under #1259

#1276 re-eval Tier-2 model choice (vs Gemma 3n/4, Phi-4, Qwen 3.5, SmolVLM, ScreenAI/Ferret-UI) ·
#1277 WebNN/NPU + faster WebGPU runtimes for the provider · #1278 defer on-device tier to native
Prompt API (Gemini Nano) · #1279 define the on-device cost/accuracy floor metric (front-A).

**Deduped:** crossRef in-flight #514/#490/#1082/#1084; #1278 (native Prompt API) is genuinely new.

### Front-A read

Capability exists (#488 resolved), build in-flight (#514/#490). No floor metric yet (that is #1279).
The delta is **favorable** — the model world moved toward on-device-fixed-cost, strengthening the
thesis and letting capability shift down-tier.

### Coverage / caveats

- Swept on-device SLM/VLM + browser-inference + native-browser-model. Did not deep-dive hosted-tier
  pricing (Tier-3 BYO-key) — out of scope for the on-device floor; revisit if pricing shifts.
- Model/version figures are point-in-time (mid-2026); worked items must re-verify at implementation.

### Sources

- [WebLLM in-browser inference](https://arxiv.org/html/2412.15803v2) · [Local-first AI: WebGPU/Wasm/Chrome built-in](https://www.sitepoint.com/local-first-ai-webgpu-chrome-guide/) · [On-device LLMs with WebGPU+WebNN](https://medium.com/codetodeploy/javascript-for-real-time-ai-on-device-llms-with-webgpu-webnn-0daaaea2a2fb)
- [Best open-source SLMs 2026 — BentoML](https://www.bentoml.com/blog/the-best-open-source-small-language-models) · [SLMs: Gemma/Phi/Qwen](https://www.digitalapplied.com/blog/small-language-models-business-guide-gemma-phi-qwen)
- [ScreenAI: VLM for UI understanding](https://arxiv.org/pdf/2402.04615) · [VLMs for edge networks survey](https://arxiv.org/html/2502.07855v1)
