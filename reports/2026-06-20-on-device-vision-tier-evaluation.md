# On-device vision tier — evaluation & recommendations (#1276 / #1277 / #1278)

**Date:** 2026-06-20 · **Program:** model-capability watch (#1259) · **Feeds:** the #488 vision tier
cascade and its builds (we:plateau provider #1082, training #1084, pipeline #490, ONNX/WebGPU provider #514).

These three evaluations were surfaced as front-B follow-ups by the 2026-06-20 model-capability watch
(`we:reports/2026-06-20-program-model-capability-watch.md`). They are tightly coupled — model choice, runtime
path, and native-built-in deferral all shape the same on-device cascade — so they are evaluated together
here, against the #1279 cost/accuracy floor metric (`we:src/_data/modelCapabilityFloor.json`). The guiding
invariant throughout is **cost-linearity**: every flat-rate vision task resolves at a fixed on-device cost;
hosted Tier-3 is BYO-key only. Each recommendation is a **direction + a filed build**, not a ratified
design change (these are `story` evaluations, not decisions).

---

## #1276 — Tier-2 on-device VLM model choice

**Question:** does the 2025–2026 small-VLM frontier change Plateau's Tier-2 model selection?

**Finding:** yes, favorably. The menu that now clears the #1279 Tier-2 floor (≥0.75 task-success, ≤5 GB
RAM @ 4-bit, <3 s first result) is much richer than when #1082/#1084 were scoped:

- **Gemma 3n E2B/E4B** — purpose-built for on-device multimodal, ~5 GB RAM @ 4-bit. Best general
  capability/footprint fit for the Tier-2 default.
- **SmolVLM (256M)** — ultra-light; the low-resource fallback for weak devices where E4B won't fit.
- **Phi-4 multimodal / Qwen 3.5 small** — strong alternates to benchmark against E4B.
- **UI-specialized (ScreenAI, Ferret-UI)** — better at locate/ground tasks than general VLMs; a candidate
  adapter for the grounding subset rather than the whole tier.

**Recommendation (confidence ~75%):** make Tier-2 a **small ladder**, not a single model — primary
**Gemma 3n E4B**, low-resource fallback **SmolVLM-256M**, and evaluate a **UI-specialized adapter** for
locate/grounding tasks specifically. This shifts capability down from hosted Tier-3 (cost-linearity win).
The residual: real task-success numbers are unmeasured (the #1279 L2 eval harness, gated on #490) — the
ladder order should be confirmed against measured runs before it's hard-coded. **Filed:** the model-ladder
selection is a build refinement of #1082 (provider) / #1084 (training data); this evaluation sets its target menu.

---

## #1277 — WebNN/NPU path + faster WebGPU runtimes

**Question:** add a WebNN/NPU execution path and/or a faster runtime to the in-browser provider (#514 ONNX
Runtime Web + WebGPU, #1082 Transformers.js)?

**Finding:** the browser-inference ceiling rose on two axes — **WebNN** now targets NPUs (Intel Core Ultra,
Snapdragon X, Apple M-series) at far lower power, and faster WebGPU runtimes (WeInfer ~3.76× over WebLLM;
Transformers.js; WebLLM) raise throughput. These map cleanly onto the two tiers' different needs: the
**always-on Tier-1 classifier** is power-bound (favours NPU/WebNN), while **Tier-2 VLM** is
throughput-bound (favours the fastest WebGPU runtime).

**Recommendation (confidence ~70%):** add **WebNN as a capability-gated additional execution provider** to
the ONNX Runtime Web provider (#514), native-first per #031 — **probe and select** the best available EP per
device (WebNN/NPU → WebGPU → Wasm), prioritising the WebNN path for the **always-on Tier-1 classifier**
(power) and keeping WebGPU the default for **Tier-2** (throughput). Benchmark WeInfer/Transformers.js/WebLLM
to pick the Tier-2 runtime. The residual: WebNN op-coverage for VLMs is still uneven, so it's an *additive*
EP behind a probe, never the sole path. **Filed:** a provider-enhancement build on #514/#1082 (add the
WebNN EP + the runtime benchmark); not a contract change.

---

## #1278 — defer to the browser-native Prompt API (Gemini Nano)

**Question:** defer part of the on-device tier to Chrome's built-in Prompt API (Gemini Nano)?

**Finding:** the Prompt API is the **ideal cost-linearity path** — a zero-download, zero-per-call on-device
model that needs no bundled weights. It aligns exactly with native-first (#031). Caveats: it is Chrome-only
and availability-gated (model download + hardware), and its multimodal surface is still emerging (text is
stable; image input is rolling out), so it cannot serve the whole vision tier today.

**Recommendation (confidence ~80%):** add the Prompt API as the **top of the on-device cascade**, behind a
capability probe — route the tasks it supports (and, as multimodal Prompt API matures, vision tasks) to it
first, and **degrade to the bundled ONNX / Transformers.js tiers** (the #1276 ladder) for browsers without
it. This is the cleanest expression of native-first + cost-linearity: the bundled tiers become the
guaranteed floor, the native built-in the zero-cost fast path where present. The residual: don't let the
cascade's correctness depend on the Prompt API (it's absent on most browsers today). **Filed:** a
cascade-ordering build on #488 (probe `LanguageModel`/`window.ai` availability; route supported tasks;
fall back).

---

## Net

All three point the same way — **push more onto fixed-cost on-device paths** (richer small VLMs, NPU/WebNN
for power, native Prompt API for zero-cost), with the bundled ONNX/Transformers.js tiers as the always-works
floor. This strengthens the #1279 cost-linearity guard. None changes a ratified contract; each files a build
refinement of the existing #488/#514/#1082/#1084/#490 vision work. The next #1259 watch run should re-check
these against the model landscape and fill the #1279 ledger's `current` values once the #490 eval harness lands.
