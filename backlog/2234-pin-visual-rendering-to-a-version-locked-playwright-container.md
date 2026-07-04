---
kind: task
status: open
parent: "2232"
blockedBy: [2233]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, playwright, determinism]
---

# Pin visual rendering to a version-locked Playwright container image

Run both baseline generation and the `check:visual` comparison inside a version-locked Playwright
container (`mcr.microsoft.com/playwright:vX.Y.Z-jammy`, pinned to the installed `@playwright/test`
version) so rendered pixels are byte-reproducible across machines and CI. Today the `visual` job in
we:.github/workflows/ci.yml renders on a bare `ubuntu-latest` runner whose font/AA stack drifts with the
image, and the baselines are platform-tagged `-chromium-linux` vs `-chromium-darwin` — so a local
regenerate can never match CI. Pinning the container collapses that split to one reproducible target.

## Scope

- Wrap the `visual` job (and the #2238 refresh flow) in `container: image: mcr.microsoft.com/playwright:...`
  pinned to the exact Playwright version in we:package-lock.json; add a check that the image tag and the
  installed version stay in lockstep (fail loud on drift).
- Confirm the FUI-sibling build + `build:docs` still run inside the container (same sibling layout).
- Document the pin bump procedure (image tag follows the Playwright upgrade).

Blocked by the platform decision #2233 (self-hosted-container is its default). Enables #2235 and #2237.
