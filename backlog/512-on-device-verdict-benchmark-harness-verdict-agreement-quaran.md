---
type: idea
workItem: story
size: 3
parent: "490"
status: open
blockedBy: ["511"]
dateOpened: "2026-06-14"
tags: []
---

# On-device verdict benchmark harness — verdict-agreement + quarantine-recall (per #488 F1/F4)

A provider-agnostic benchmark suite that runs any registered vision provider (scripts/design-refs/vision.mjs classifyCandidate) over a held-out labeled slice and reports verdict-agreement % + per-class quarantine-recall against the graduation thresholds (e.g. >=95% agreement) that promote the API bridge (#485) to the bundled on-device default. Demoable against the anthropic/manual provider on a fixture corpus, so it has value measuring the hosted provider before any on-device model exists. Consumes slice A's (#511) held-out manifest format. Slice B of epic #490.
