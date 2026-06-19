---
type: idea
workItem: story
size: 3
parent: "1073"
status: resolved
blockedBy: ["1080", "1081"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:scripts/design-refs/providers/transformers-vlm.mjs"
tags: []
---

# In-browser Transformers JS + WebGPU Tier-2 provider

Slice C of #1073: wrap slice B's (#1081) chosen small VLM behind slice A's (#1080) rich-output contract, running in-browser via ONNX Runtime Web / Transformers JS + WebGPU — the Tier-2 analogue of the Tier-1 provider #514. Self-registers behind registerVisionProvider; device-gated (WebGPU ~2 GB+), opt-in download, never default/mobile. Demoable as a standalone demo page running the VLM on a screenshot. Blocked by #1080 (contract) + #1081 (model). Feeds slice D.

## Progress

Shipped the Tier-2 in-browser VLM provider behind the #1080 rich-output seam:
- `we:scripts/design-refs/providers/transformers-vlm.mjs` — self-registers `registerVisionProvider('transformers-vlm', { analyzeRich })`,
  wrapping **Florence-2** (#1081 recommendation) via `@huggingface/transformers` + WebGPU (computed-specifier
  lazy import, model built once on first analyze). Device-gated: `assertDeviceCapable` throws an actionable
  error when `navigator.gpu` is absent (never default, never mobile, opt-in ~2GB download). Pure exported
  mappers — `FLORENCE_TASKS`, `boxToUnit` (pixel `[x1,y1,x2,y2]`→unit `{x,y,w,h}`), `tagsFromDetection`,
  `mapFlorenceResponse` (caption+OD → `{description,tags,regions}` via `normalizeRichOutput`) — so the #1080
  contract mapping is testable with no model/browser. No-leakage (#475): vendor lives only in this on-demand
  module, never the design-refs core.
- `we:scripts/design-refs/vision.mjs` — **seam extension**: `registerVisionProvider` now accepts a provider
  implementing *any* of `classifyCandidate`/`analyzeForCodification`/`analyzeRich` (was: `classifyCandidate`
  required), so a rich-only Tier-2 provider can register. Tier-1 anthropic provider unaffected (21 provider
  tests green).
- `we:scripts/design-refs/providers/__tests__/transformers-vlm.test.mjs` — 10 green (box conversion, tag
  derivation, envelope merge incl. label-without-box, caption/detection/empty tolerance, WebGPU gate).
- Full design-refs vitest suite green (116). WE `check:standards` 0 errors.

**Live in-browser demo page** (the body's "demoable as a standalone demo page") split to **#1142** — it
requires `@huggingface/transformers` installed + WebGPU + the opt-in ~2GB Florence-2 download, so it is
unrunnable in CI/batch; the provider core it exercises is shipped + verified here. Feeds slice D.
