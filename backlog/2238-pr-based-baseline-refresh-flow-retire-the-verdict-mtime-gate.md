---
kind: task
status: open
parent: "2232"
blockedBy: [2234]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, workflow, governance]
---

# PR-based baseline-refresh flow; retire the #2179 verdict/mtime gate

Rework baseline updates so review happens in a **pull request**, not a direct-to-main bot commit. Today
we:.github/workflows/update-visual-baselines.yml regenerates PNGs and pushes straight to a branch — but the
#2179 pre-commit gate (`we:scripts/check-visual-baseline-update.mjs`) blocks any snapshot without an
approved verdict JSON written *after* the PNG. Since the workflow can't author verdicts and its
regenerated PNG always post-dates any pre-written verdict, the two are in permanent deadlock — which is the
root reason baselines could never be seeded. Best practice replaces the sidecar-verdict mechanism with PR
review: the PR's rendered image diff IS the "did a human/AI look at this" surface.

## Scope

- Change the refresh workflow to **open a PR** (branch + `gh pr create`) carrying the regenerated
  container-linux baselines, with the before/after visible in the PR's image diff.
- Retire or repurpose the #2179 verdict/mtime gate: drop the pre-commit block in favor of "baseline PNG
  changes require an approved PR" (branch protection), keeping the intent (no unreviewed baseline) without
  the deadlock. Remove `we:tests/visual/verdicts/` + the guard script, or narrow the guard to local-only.
- An AI reviewer (or human) approving the baseline PR is the recorded judgment — document the review bar.

Blocked by #2234 (refresh runs in the pinned container). Feeds the seed slice #2239.
