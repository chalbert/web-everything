---
kind: task
status: resolved
parent: "2232"
blockedBy: [2233]
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
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

## Resolution note

Hardened in we:playwright.config.ts and we:tests/visual/rendered-site-visual.spec.ts:

- `animations: 'disabled'` + `maxDiffPixelRatio`/`threshold` moved to config-level `expect.toHaveScreenshot`
  (repo-wide default; a no-op for every project/spec that doesn't call `toHaveScreenshot`).
- `reducedMotion: 'reduce'` and an explicit `viewport`/`deviceScaleFactor` pin added to the `chromium`
  project's `use` block (same values `devices['Desktop Chrome']` already resolves to today — zero pixel
  diff — but now immune to a future `@playwright/test` device-catalog change).
- Fonts: `--font-sans`/`--font-mono` resolve to system-font stacks only (fui:plugs/webtheme/defaultTheme.ts)
  — there is no `@font-face`/webfont in the docs site, so no FOUT/glyph-metric-shift risk exists to harden
  against today, and "confirm the container image has the needed fonts" is consequently a non-issue for
  THIS item (any base image ships the OS-default system fonts these stacks resolve to; #2234's container
  pin is the right place to revisit if a webfont is ever introduced). `document.fonts.ready` is still
  awaited before capture as a cheap, correct-regardless guard.
- Time & randomness: a `freezeClock()` helper (we:tests/visual/rendered-site-visual.spec.ts) freezes
  `Date`/`Date.now` via Playwright's own `page.clock.setFixedTime` (fixed 2026-01-01 epoch — preferred over
  a hand-rolled `Date` subclass, the library's fake-time implementation is the tested one) and installs a
  seeded `Math.random` (no Playwright Clock equivalent) via `page.addInitScript`, both before navigation.
  None of the current 3 target pages (home, backlog-detail, capability-adapter-detail) render live
  time/random output today (verified — no `mask:` entries were needed), so this is preventive.
- Masking: we:tests/visual/pages.json's per-page `mask:` field already existed and is documented as the
  escape hatch for future dynamic regions; no page needs one right now.

## Review note (self-reviewed, no Task/subagent tool available in this lane)

Considered and dismissed: project-wide `reducedMotion: 'reduce'` on the shared `chromium` project (also
used by a11y/smoke/content specs, not just visual) could in principle change rendered output for those
specs too. Checked: the only `@media (prefers-reduced-motion)` rule in we:src/css/style.css only zeroes a
`transform`/tweaks a `transition` on `.nav-menu-panel` (no layout/visibility change), and no block/asset JS
gates behavior on `matchMedia('(prefers-reduced-motion)')` (grepped `blocks/`, `src/assets/js/`) — so this
is a no-op for the a11y/smoke/content specs' actual assertions. Kept project-wide rather than splitting a
separate `visual` Playwright project, because a rename would change the committed screenshot baselines'
`-{projectName}-` filename segment and trip the #2179 AI-verdict gate on a pure rename (no pixel content
changed) — disproportionate for this item's scope; the value of the pin (defensive, config stays in sync
with what visual specs assume) doesn't require project isolation to be safe here.
