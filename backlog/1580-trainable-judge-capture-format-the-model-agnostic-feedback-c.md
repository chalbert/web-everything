---
kind: story
size: 3
parent: "1552"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Trainable-judge capture format — the model-agnostic feedback corpus schema

Define the durable, model-agnostic corpus schema the trainable judge (#1553) learns from: per labeled state, {frozen-frame PNG, domSnapshot, stateId, verdict, composite spatial anchor (bbox primary / a11y-role+text tiebreak / DOM-path debug-only), label vocabulary}. Capture BOTH feedback channels — verdict-on-candidate (precision/severity) and missed-issue authoring (the only recall channel). This schema is the never-lose asset (embeddings are a re-derivable cache, never stored as the asset); it seeds #489 frame/verdict pairs and is the train/benchmark split point. Foundational — blocks the store, benchmark, and learning slices. Per we:docs/agent/platform-decisions.md#trainable-judge.
