---
kind: story
size: 3
parent: "490"
status: open
blockedBy: ["513"]
dateOpened: "2026-06-14"
tags: []
---

# In-browser ONNX Runtime Web + WebGPU vision provider (per #488 F3, the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule)

An in-browser ONNX Runtime Web + WebGPU provider that self-registers behind the existing vision seam (we:scripts/design-refs/vision.mjs registerVisionProvider, via DESIGN_REFS_VISION_PROVIDER_MODULE) wrapping slice C's (#513) quantized student — same no-leakage boundary as we:providers/anthropic-vision.mjs, mirroring its pure-fn + thin-wrapper shape. On graduation this becomes the bundled on-device default; the API provider stays as the premium upgrade. Slice D of epic #490.
