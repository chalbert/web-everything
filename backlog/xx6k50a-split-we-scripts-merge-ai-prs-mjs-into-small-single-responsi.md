---
kind: story
size: 5
status: open
blockedBy: ["2678"]
scope: ["we:scripts/merge-ai-prs.mjs"]
relatedTo: ["2606", "2679"]
dateOpened: "2026-07-28"
tags: []
---

# Split we:scripts/merge-ai-prs.mjs into small single-responsibility modules (RANK 1 — 25 scope-collisions)

Split we:scripts/merge-ai-prs.mjs along its existing seams into small single-responsibility modules under we:scripts/merge-ai/, keeping the entrypoint a thin re-export barrel. MOTIVATION (per #2678): this file is named in 25 queued items' scope: — the single largest scope-lease lock on the board. Under file-level leases those 25 items serialize (build one-at-a-time) with zero real overlap; splitting it lets them declare disjoint scopes and run in PARALLEL. The #1 highest-leverage parallelism unlock — do it FIRST. It is already a 42-export barrel of pure helpers, so the seams exist and refactor risk is low. Cluster exports into responsibility modules (e.g. label-plan, net-diff, lease-gate). Split ONLY along genuine seams — cohesion outranks line count. Statute: we:docs/agent/platform-decisions.md#small-file-preference.
