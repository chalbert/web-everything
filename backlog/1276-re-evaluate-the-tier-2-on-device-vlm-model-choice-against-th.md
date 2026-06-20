---
kind: story
size: 3
parent: "1259"
locus: webeverything
relatedReport: reports/2026-06-20-on-device-vision-tier-evaluation.md
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:reports/2026-06-20-on-device-vision-tier-evaluation.md"
tags: []
---

# Re-evaluate the Tier-2 on-device VLM model choice against the 2025-2026 small-VLM frontier

The on-device small vision-language model frontier moved fast: Gemma 3n E2B/E4B (on-device multimodal, 5GB RAM at 4-bit), Gemma 4 (Apr 2026), Phi-4 multimodal, Qwen 3.5 small, SmolVLM (256M), and UI-specialized models (ScreenAI, Ferret-UI). Re-evaluate Plateau Tier-2 model selection (#1082 provider, #1084 training, #490 pipeline) against this menu so more capability runs on-device and tasks shift down from hosted Tier-3 — a cost-linearity win (cost scales with revenue; no uncapped per-call SDK in flat-rate). Surfaced by the 2026-06-20 model-capability watch (#1259).

## Progress

Re-evaluated the Tier-2 VLM choice against the 2025–2026 small-VLM frontier — see `we:reports/2026-06-20-on-device-vision-tier-evaluation.md` §#1276.
Recommendation (~75%): make Tier-2 a **small ladder** — primary **Gemma 3n E4B** (on-device multimodal,
~5 GB @ 4-bit, clears the #1279 floor), low-resource fallback **SmolVLM-256M**, and a **UI-specialized
adapter** (ScreenAI/Ferret-UI) for locate/grounding tasks. Shifts capability down from hosted Tier-3
(cost-linearity win). Residual: confirm the ladder against measured task-success once the #490 eval
harness lands. Filed as a build refinement of #1082/#1084 (this evaluation sets the target menu); locus
fixed plateau-app→webeverything (the deliverable is a WE watch report, no plateau code).
