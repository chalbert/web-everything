---
kind: story
size: 5
parent: "1552"
status: open
blockedBy: ["1580"]
dateOpened: "2026-06-22"
tags: []
---

# Trainable-judge corpus store — Plateau-owned, repointable label/embedding store

Persist the trainable-judge corpus (#1580 schema) as a Plateau-owned, repointable store behind the JudgeModel seam (#1553 Fork 3: Plateau owns the impl, WE owns only the contract). Holds {label rows + a re-derivable embedding cache keyed by (encoder-id, frame)} — embeddings are a cache, never the asset. v1 may co-locate on disk next to the explorer's Plateau-side orchestration tier for operational simplicity, but stays owned-by + exposed-through the Plateau vision capability (#1073/#475/#490) via the #475 stand-in→repoint pattern — locality is not ownership. Per we:docs/agent/platform-decisions.md#trainable-judge.
