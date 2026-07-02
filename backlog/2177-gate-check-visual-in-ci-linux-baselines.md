---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# Gate `check:visual` in CI — generate Linux baselines so the visual guard actually blocks merges

The visual-regression guard (`we:tests/visual/rendered-site-visual.spec.ts`, `toHaveScreenshot`) exists with committed baselines but is NOT run in CI — `we:.github/workflows/ci.yml` runs test:coverage + check:standards + test:interaction only. So a stale or unreviewed baseline merges green (proven 2026-07-02: three home-page look changes shipped with the home baseline never refreshed). Wiring it is not a one-line workflow add: the committed baselines are platform-tagged `-chromium-darwin` (captured on the dev mac) and CI runs on `ubuntu-latest`, so `toHaveScreenshot` would look for `-chromium-linux` snapshots that don't exist and fail. This is exactly why #799 deferred visual from CI (the option-C local bootstrap). To close it: generate `-linux` baselines deterministically in the CI container (or a pinned docker image), decide the cross-platform rendering tolerance, then add the `check:visual` step to `we:.github/workflows/ci.yml`. Revisits the #799 CI-deferral.
