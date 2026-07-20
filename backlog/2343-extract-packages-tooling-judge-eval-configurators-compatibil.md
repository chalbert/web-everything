---
kind: story
size: 5
parent: "2346"
status: resolved
blockedBy: ["2341"]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "plateau:packages/tooling/"
tags: []
---

# Extract packages/tooling — judge/eval, configurators, compatibility-map as CLI-shaped packages

Move the CLI-shaped tooling production into plateau:packages/tooling as @plateau/tooling: the judge/eval stack (plateau:src/judge-benchmark/, plateau:src/judge-corpus/, plateau:src/judge-eval/, plateau:src/judge-learning/, plateau:src/weight-tuning/), the configurators (plateau:src/intent-configurator/, plateau:src/technical-configurator/), and the compatibility-map — the headless, invoke-from-CLI surfaces, depending on @plateau/core. Keeps the pure judge/eval bits out of the dev-browser package.
