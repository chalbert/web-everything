---
type: issue
workItem: story
size: 5
parent: "099"
status: resolved
blockedBy: ["558"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "@frontierui/auto-update-orchestrator post-deploy rollout axis — RolloutPolicy + emitArgoRollout + emitFlaggerCanary (src/index.ts)"
tags: [auto-update, runner, post-deploy, rollout, argo, flagger, frontier-ui]
---

# Auto-update post-deploy rollout config-emit (Frontier UI)

Slice 2 of the #497 ruling (Fork 1 → A). Extend the Frontier UI orchestrator to emit progressive-delivery config (Argo Rollouts CRD / Flagger) from the update-policy post-deploy axis: staged rollout → metric analysis → auto-rollback on regression. Native-first / impl-is-not-a-standard — WE delegates the rollout mechanics to existing in-cluster controllers and only declares the policy; the slice emits their config, it does not reimplement them. Builds on the policy-reading core from slice 1 (#558). Publishes @frontierui (no-leakage). Per #497 Ruling and slice plan.

## Progress

- **Resolved 2026-06-14.** Extended `@frontierui/auto-update-orchestrator` (slice 1, #558) with the
  **post-deploy rollout axis** — a new self-contained section in `src/index.ts`. Native-first /
  impl-is-not-a-standard: WE declares the policy, the in-cluster controller executes it; the slice only
  *emits* config.
  - **`RolloutPolicy`** declared shape — staged `steps` (canary `setWeight` + `pauseMs`), `analysis`
    metrics (`{name, threshold, direction: min|max}`), `autoRollback`. `DEFAULT_ROLLOUT_POLICY` is the
    safe-default flavor (10→50→100 with 5m soaks; success-rate ≥99 / duration ≤500; rollback on) a project
    config extends via `resolveRolloutPolicy` (mirrors slice 1's `resolvePolicy`).
  - **Two concrete bindings:** `emitArgoRollout(name, policy)` → an Argo `Rollout` CRD
    (`argoproj.io/v1alpha1`) with canary `setWeight`/`pause` steps + one `AnalysisTemplate` per metric
    (`successCondition` encodes threshold/direction); `emitFlaggerCanary(name, policy)` → a Flagger
    `Canary` (`flagger.app/v1beta1`) with `stepWeight`/`maxWeight`/`interval` + metric `thresholdRange`s.
    `autoRollback:false` drops the analysis (Argo) / zeroes the failed-check budget (Flagger).
  - **Kept separate from the pre-merge gate** (bias to separation): slice 1's `UpdatePolicy`/
    `resolvePolicy` is untouched. Publishes `@frontierui` (no-leakage).
  - **Verified:** 28 package tests pass (11 new), `tsc --noEmit` clean, FU `check:standards` green.
    Slice 3 (#560) builds on slice 1 next.
