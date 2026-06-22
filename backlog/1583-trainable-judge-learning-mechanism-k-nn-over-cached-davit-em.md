---
kind: story
size: 8
parent: "1552"
status: open
blockedBy: ["1581"]
dateOpened: "2026-06-22"
tags: []
---

# Trainable-judge learning mechanism — k-NN over cached DaViT embeddings, eval-gated logistic-probe escalation

Implement the v1 learning mechanism behind the JudgeModel seam (#1553 Fork 2): k-NN retrieval over cached DaViT vision-encoder embeddings (free off the already-loaded Florence-2 encoder; on-device; works from the FIRST label / cold-start), voting nearest labeled states. Escalate to a linear/logistic probe on the SAME embedding cache at ~tens of labels, eval-gated by #1582. k-NN→probe share the whole pipeline, so v1 is not throwaway. The recipe is encoder-parameterized (embed→k-NN→probe), authored model-agnostically so it ports to any judge agent; probe weights are model-specific but disposable. Full VLM fine-tune stays parked (server-side, >~1k labels). Per we:docs/agent/platform-decisions.md#trainable-judge.
