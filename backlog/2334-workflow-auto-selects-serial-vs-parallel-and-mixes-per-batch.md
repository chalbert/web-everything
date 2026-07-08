---
kind: story
size: 8
parent: "1143"
status: open
dateOpened: "2026-07-08"
tags: []
---

# /workflow auto-selects serial vs parallel (and mixes) per batch, adapting as it progresses

Today the execute model is a manual per-invocation choice: /batch is serial, /workflow is parallel. The orchestrator should instead DECIDE the model from the pack's real shape and ADAPT as the batch runs — provably-disjoint items go parallel, items sharing a touch-set (e.g. several PRs all editing the drain/review core: we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs, we:scripts/lib/review-escalation.mjs) run serially, and the partition re-evaluates as items land and free/contend files. Degenerates to all-serial when nothing is disjoint (correct) and all-parallel when everything is. Goal: the user picks 'batch', not 'which engine'. Surfaced 2026-07-08 in batch-2026-07-07-1821-2325, where 9 lane/PR/review-infra items shared the drain core and were run serially by hand; the user asked for exactly this adaptive/mixed model.
