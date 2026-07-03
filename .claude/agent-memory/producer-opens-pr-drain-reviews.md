---
name: producer-opens-pr-drain-reviews
description: Decided 2026-07-02 — flip the drain PR model so producer lanes open draft PRs and the drain reviews+merges (drop pr-land self-approve); implement after the current batch drains
metadata: 
  node_type: memory
  type: project
  originSessionId: a1a732b9-4657-41e1-bc9e-6588cdded2e7
---

Agreed direction (user, 2026-07-02): change the deferred-drain PR model. **Today** `scripts/lane-drain.mjs` → `scripts/pr-land.mjs` opens the PR, **self-approves**, waits for the `test` check, and merges; producer lanes only push the `lane/*` ref + enqueue → so no independent review exists (self-approve is a rubber stamp).

**New model:** producer (stop-at-push, #2174) opens a **draft PR** per couple (CI runs concurrently across lanes); the **drain reviews the diff** (independent — different session than the lane that wrote it) then merges. Drop the self-approve.

**Must NOT move:** the drain keeps owning merge sequencing — cross-item `blockedBy` order, impl-first/WE-last, single unqueue-on-land clear point (#2161). Lanes never merge themselves.

**Why:** replaces rubber-stamp self-approval with a real independent review gate; secondary win is CI parallelism.

**How to apply:** file as backlog item (next id was ~2178) touching `pr-land.mjs` (split open-PR from approve+merge), the #2174 producer path (`parallel-execute.workflow.js`), and `lane-drain.mjs` `drain-one` (review gate). Draft is in this session's scratchpad. Do it AFTER `batch-2026-07-02-2113-2136` drains — do not rewire the producer/drain contract mid-run. Related: [[pr-land-dogfood-mechanics]].
