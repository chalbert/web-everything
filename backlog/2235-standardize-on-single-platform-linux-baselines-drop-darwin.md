---
kind: task
status: resolved
parent: "2232"
blockedBy: [2234]
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: [ci, visual-regression, playwright, hygiene]
---

# Standardize on single-platform (container-linux) baselines; drop the darwin set

Once rendering is pinned to the Playwright container (#2234), commit only the container-`linux` baseline
PNGs and delete the `-chromium-darwin` set. Maintaining two platform baselines doubles refresh work,
invites drift, and is the reason a developer's local `check:visual` can't match CI. A single reproducible
target means one baseline, generated one way, checked one way.

## Scope

- Remove `*-chromium-darwin.png` under we:tests/visual/rendered-site-visual.spec.ts-snapshots/ and the
  companion cross-origin spec's snapshots.
- Update we:playwright.config.ts / the visual specs so local runs use the containerized baseline (e.g. run
  `check:visual` via the container, or document that local visual checks require the container) — no
  platform suffix branching.
- Update any doc/comment (e.g. the `visual` job header in we:.github/workflows/ci.yml, the #2238 refresh
  flow) that references the darwin-alongside-linux convention.

Blocked by #2234 (the container is the single target). Feeds the seed slice #2239.
