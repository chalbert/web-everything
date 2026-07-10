---
kind: task
status: open
humanGate: { kind: review, what: "Generating the first 'correct look = current look' baselines runs through #2238's PR-based refresh flow — a CI workflow_dispatch, not a local lane op — and gates on a human/AI approval that each visual target (home, detail-card, grid) renders correctly before landing. That perceptual sign-off is not something a batch can perform." }
parent: "2232"
blockedBy: [2235, 2236, 2237, 2238]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, baselines]
---

# Seed the initial reviewed container-linux baselines through the new flow

With container-pinned rendering (#2234), single-platform baselines (#2235), deterministic fixtures (#2236)
and render hardening (#2237) in place, and the PR-based refresh flow live (#2238), generate the **first**
real baselines and land them through a reviewed PR. This is the initial "current look = correct look"
snapshot, established deliberately rather than auto-committed.

## Scope

- Trigger the #2238 refresh flow to produce the container-linux PNGs for every visual target (home, the
  detail-card and grid targets rendered from the frozen fixture set).
- Review the generated baselines in the PR (the AI/human approval bar from #2238) — confirm each target
  renders correctly before approving.
- Land the baselines under we:tests/visual/rendered-site-visual.spec.ts-snapshots/ (and the cross-origin
  spec) so `check:visual` has something to compare against.

Blocked by #2235, #2236, #2237, #2238. Immediately precedes reactivation (#2240).
