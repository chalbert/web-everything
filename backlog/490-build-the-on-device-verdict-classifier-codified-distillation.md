---
kind: epic
status: open
dateOpened: "2026-06-13"
relatedReport: reports/2026-06-13-on-device-ui-vision-capability.md
tags: [plateau, vision, on-device, distillation, webgpu, benchmark, training-pipeline]
---

# Build the on-device verdict classifier — codified distillation pipeline + benchmark + in-browser provider (per #488)

**Umbrella for the fixed-cost on-device floor of the vision gate** — a lightweight UI-screenshot
classifier for the 6-verdict taxonomy, distilled (per the [#488](488-on-device-ui-screenshot-vision-model-as-a-plateau-capability/)
ruling, the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule) from the hosted-model verdicts in the resolved [#489](489-archive-quarantined-frames-persist-frame-verdict-pairs-as-a-/)
corpus and run in-browser, so verdict-gated features can be flat-priced (the linear-cost rule).
**Sliced** into: **A** corpus-export + codified recipe artifact (ready now) → **B** benchmark harness →
**C** train+quantize the classifier (also gated on corpus *volume*) → **D** in-browser WebGPU provider;
plus **E** the scheduled stay-current re-benchmark. The seam is tooling-vs-model: the export + benchmark
build now against the corpus *format*; the trained student needs accumulated *data*.

## Spec (per #488 ruling — all five forks ratified)

- **Model (F1/F2):** a ≲10 MB-quantized MobileNet/ViT student for the 6 verdicts, via task-specific
  knowledge distillation (VL2Lite / PAND / VLM-KD) from the big-model labels in #489. Not a VLM — that's
  the separate Tier-2 build.
- **Runtime (F3):** an in-browser **ONNX Runtime Web + WebGPU** provider that self-registers behind the
  existing seam (`we:scripts/design-refs/vision.mjs` → `registerVisionProvider`) — same no-leakage boundary
  as `we:anthropic-vision.mjs`.
- **Codified training (F5):** a versioned, model-agnostic artifact — **corpus + distillation recipe +
  benchmark suite** — so a base-model switch *re-runs the recipe*, never re-labels. Keep it reproducible
  (config + dated-revision log).
- **Graduation benchmark (F1/F4):** e.g. ≥95% verdict-agreement with the hosted model + a quarantine-recall
  floor on a held-out slice → promote from the API **bridge** (#485) to the bundled on-device default;
  API stays as the premium upgrade.
- **Stay-current (F5):** a scheduled re-benchmark of the small-model frontier (the #192 cadence) — may
  spin out as its own recurring task once the benchmark suite exists.

**Sizing:** `size:13` is a placeholder — slice into batchable pieces (recipe / classifier / WebGPU
provider / benchmark harness) once #489 has produced enough corpus to train against.
