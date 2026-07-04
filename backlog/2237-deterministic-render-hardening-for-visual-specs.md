---
kind: task
status: open
parent: "2232"
blockedBy: [2233]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, determinism, fonts]
---

# Deterministic-render hardening for visual specs (animations, fonts, time, masking)

Flaky visual diffs come from non-determinism in the render, not real regressions. Apply the standard
hardening so a screenshot is a pure function of the styles under test:

## Scope

- **Animations/transitions off** — `toHaveScreenshot({ animations: 'disabled' })` (config-level) and a
  reduced-motion emulation.
- **Fonts** — self-host/bundle the docs fonts and await `document.fonts.ready` before capture, so
  fallback-font FOUT never shifts glyph metrics. Confirm the container image has the needed fonts.
- **Time & randomness** — freeze `Date`/`Math.random` (fixed clock) so any date/id rendered on the page
  is stable.
- **Mask dynamic regions** — `mask:` any intentionally-variable element (build id, timestamps, live
  counts) rather than baking it into the baseline.
- **Pin the viewport + deviceScaleFactor** and set a small `maxDiffPixelRatio`/`threshold` so sub-pixel AA
  noise doesn't flap the gate.
- Encode these in we:playwright.config.ts (the visual project) and the specs under we:tests/visual/.

Blocked by the platform decision #2233. Parallel with #2234–#2236. Feeds the seed slice #2239.
