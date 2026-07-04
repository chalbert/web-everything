---
kind: task
status: open
parent: "2232"
blockedBy: [2239]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, branch-protection]
---

# Reactivate the visual gate and promote it to a required, watched check

**Final slice of #2232.** With deterministic, container-pinned, fixture-backed baselines seeded and
reviewed (#2239), turn the visual gate back on and make it a signal people actually watch.

## Scope

- Remove the `if: ${{ false }}` guard on the `visual` job in we:.github/workflows/ci.yml (added when the
  epic was filed) and delete the now-stale disable comment.
- Run it green on `main` at least twice to confirm stability (no flakes) against the seeded baselines.
- Promote `visual` to a **required** status check in branch protection (alongside `test`, per #2220) so a
  visual regression blocks merge instead of silently going red — closing the "unwatched red gate" hazard
  that let #2184 slip for ~6h.
- Update the #2232 epic to resolved once this lands (all slices done).

Blocked by #2239 (baselines must exist and be stable first). This is the last step in the queue.
