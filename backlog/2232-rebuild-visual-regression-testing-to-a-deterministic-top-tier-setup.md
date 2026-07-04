---
kind: epic
status: active
dateOpened: "2026-07-04"
tags: [ci, visual-regression, testing, playwright, determinism]
---

# Rebuild visual-regression testing to a deterministic, top-tier setup

The `visual` CI job is **now disabled** (`if: ${{ false }}` in we:.github/workflows/ci.yml, landed with
this epic) because it was permanently red and unwatched — noise that masked the #2184 breakage for ~6h.
This epic rebuilds visual regression to industry best practice, then re-enables it as a **required,
watched** check (final slice #2240). It removes four compounding root causes: dual-platform baselines that
drift and can't be regenerated locally-for-CI; a refresh workflow that could never seed baselines; a
verdict/mtime gate (#2179) deadlocked with that workflow; and content-driven screenshots that shift on
every `backlog/` change.

## Target architecture (industry best practice)

- **Pinned-container rendering** — generate AND check screenshots inside a version-locked Playwright
  container image (`mcr.microsoft.com/playwright:vX-jammy`), so pixels are reproducible and the
  local-OS/CI-OS split disappears. (#2234)
- **Single-platform baselines** — commit only the container-`linux` PNGs; drop the `-darwin` set and the
  "regenerate two platforms" burden. (#2235)
- **Deterministic fixtures** — visual specs render frozen fixture data, not live `backlog/*.md`, so
  content churn never shifts a screenshot. (#2236)
- **Deterministic render** — animations off, `document.fonts.ready`, frozen clock/random, masked dynamic
  regions, pinned viewport + device-scale, self-hosted fonts, small `maxDiffPixelRatio` tolerance. (#2237)
- **PR-based baseline review** — the refresh workflow opens a PR carrying regenerated baselines; the PR's
  rendered image diff + approval IS the review, retiring the #2179 verdict/mtime gate. (#2238)
- **Seed + reactivate** — seed the first reviewed baselines through the new flow (#2239), then remove the
  `if: false` and promote `visual` to a required status check (#2240).

## Slices (queue order)

1. #2233 — [decision] platform: self-hosted Playwright-in-container vs hosted SaaS (blocks the rest)
2. #2234 — pin the Playwright container image
3. #2235 — single-platform (linux) baselines; drop darwin
4. #2236 — deterministic fixtures for visual specs
5. #2237 — deterministic-render hardening (config, specs, fonts)
6. #2238 — PR-based baseline-refresh flow; retire the #2179 verdict/mtime gate
7. #2239 — seed the initial reviewed baselines through the new flow
8. #2240 — **reactivate** the visual gate + promote it to a required, watched check
