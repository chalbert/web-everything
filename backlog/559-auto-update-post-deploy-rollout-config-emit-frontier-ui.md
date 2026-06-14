---
type: issue
workItem: story
size: 5
parent: "099"
status: open
blockedBy: ["558"]
dateOpened: "2026-06-14"
tags: [auto-update, runner, post-deploy, rollout, argo, flagger, frontier-ui]
---

# Auto-update post-deploy rollout config-emit (Frontier UI)

Slice 2 of the #497 ruling (Fork 1 → A). Extend the Frontier UI orchestrator to emit progressive-delivery config (Argo Rollouts CRD / Flagger) from the update-policy post-deploy axis: staged rollout → metric analysis → auto-rollback on regression. Native-first / impl-is-not-a-standard — WE delegates the rollout mechanics to existing in-cluster controllers and only declares the policy; the slice emits their config, it does not reimplement them. Builds on the policy-reading core from slice 1 (#558). Publishes @frontierui (no-leakage). Per #497 Ruling and slice plan.
