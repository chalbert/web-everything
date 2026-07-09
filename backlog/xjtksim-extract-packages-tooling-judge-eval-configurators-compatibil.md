---
kind: story
size: 5
parent: "xyablkl"
status: open
blockedBy: ["x8yhhn0"]
dateOpened: "2026-07-09"
tags: []
---

# Extract packages/tooling — judge/eval, configurators, compatibility-map as CLI-shaped packages

Move the CLI-shaped tooling production into plateau:packages/tooling as @plateau/tooling: the judge/eval stack (plateau:src/judge-benchmark/, plateau:src/judge-corpus/, plateau:src/judge-eval/, plateau:src/judge-learning/, plateau:src/weight-tuning/), the configurators (plateau:src/intent-configurator/, plateau:src/technical-configurator/), and the compatibility-map — the headless, invoke-from-CLI surfaces, depending on @plateau/core. Keeps the pure judge/eval bits out of the dev-browser package.
