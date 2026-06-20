---
kind: story
size: 3
parent: "1259"
locus: plateau-app
status: open
dateOpened: "2026-06-20"
tags: []
---

# Re-evaluate the Tier-2 on-device VLM model choice against the 2025-2026 small-VLM frontier

The on-device small vision-language model frontier moved fast: Gemma 3n E2B/E4B (on-device multimodal, 5GB RAM at 4-bit), Gemma 4 (Apr 2026), Phi-4 multimodal, Qwen 3.5 small, SmolVLM (256M), and UI-specialized models (ScreenAI, Ferret-UI). Re-evaluate Plateau Tier-2 model selection (#1082 provider, #1084 training, #490 pipeline) against this menu so more capability runs on-device and tasks shift down from hosted Tier-3 — a cost-linearity win (cost scales with revenue; no uncapped per-call SDK in flat-rate). Surfaced by the 2026-06-20 model-capability watch (#1259).
