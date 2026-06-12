---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-11"
tags: [dev-experience, devtools, validation, linting, adapters, normalization, no-lock-in]
parent: "236"
---

# Validation-normalize: re-export leg (emit equivalent config for a different tool)

Second leg of the adapter-as-normalization-hub (spun out of #236, whose see leg shipped). Reverse the adapters: given the internal pivot model, emit an equivalent config for a DIFFERENT incumbent (eslint -> oxlint/biome, etc.). Must report round-trip loss honestly per cell (best-effort, never promise lossless) using the confidence/coverage grades already in knowledge.mjs. Adapters today only ingest; add an emit() per adapter. Engine + pivot model live in scripts/validation-normalize/.
