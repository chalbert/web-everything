---
kind: task
status: open
relatedTo: ["1966", "2123", "2070"]
dateOpened: "2026-07-02"
tags: [testing, visual-regression, lanes, dx]
---

# Visual-regression spec hardcodes baseURL :8080 — a lane can't regen baselines without colliding with main

`we:tests/visual/rendered-site-visual.spec.ts` pins `test.use({ baseURL: 'http://localhost:8080' })` (the
WE-docs origin). Under #2123 (every edit, including visual, runs in a lane), regenerating a committed baseline
from a lane requires the lane's 11ty docs server bound to :8080 — but :8080 is the **main checkout's** dev-pair
(the human's). So `check:visual:update` from a lane either hits the wrong site (main's) or can't bind the port.

**Consequence (hit 2026-07-02 on the home orange-fix):** the CSS fix + baseline regen had to be done in the
main checkout instead of a lane, contradicting #2123.

**Fix:** env-ize the visual baseURL to the lane's `WE_ELEVENTY_PORT` (as `we:vite.config.mts` already reads
`WE_ELEVENTY_PORT`, #1997) so a lane renders + regenerates its own baselines against its own docs server. Then
visual work fully lanes (the #2123 "flip" from interactive-stays-on-primary to uniform). The a11y/smoke/content
specs pin the same :8080 and want the same treatment.
