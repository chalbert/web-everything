---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: [lane, pr-flow, merge-queue, integrator, session-tooling]
relatedTo: ["2138"]
---

# Durable lane manifest (#2138 Fork 2): per-item cross-repo shape, couple-order, cross-item blockedBy in the WE lane commit; drain deletes it at landing

Implements #2138 **Fork 2 (ruled: option a)** — the durable source of truth the deferred drain needs for each queued item. Today the cross-repo shape (which repos' `lane/*` refs form the item, the impl-first/WE-last order, and `blockedBy` edges **between queued items**) lives **only in the orchestrator's in-run memory** (`crossRepoRefs`) and evaporates when the session ends. Fix: write a standalone **`we:.lane-manifest.json`** as a **new file in the WE lane commit** — a one-sided add that preserves the #1869 conflict-free WE-lane merge and doesn't pollute the resolve diff. It is a **superset** of the run-scoped array (also carries cross-item/cross-session `blockedBy` the in-run array never held). Shape per the decision's schema (`item`, `repos[]` with order + `carriesResolve`, `blockedBy`, `mergeRiskFiles`). **The drain deletes it at landing** (co-located with `lane/*` ref deletion) so `main` carries no post-drain cruft. Buildable now, independent of #2153; **consumed by** the drain command (#2162).
