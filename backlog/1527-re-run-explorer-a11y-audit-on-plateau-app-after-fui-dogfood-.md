---
kind: task
parent: "1254"
locus: plateau-app
status: open
blockedBy: ["1506", "1507", "1508", "1509"]
dateOpened: "2026-06-22"
tags: []
relatedReport: reports/2026-06-22-plateau-app-explorer-a11y-audit.md
---

# Re-run explorer a11y audit on plateau-app after FUI dogfood migration

Re-run the 2026-06-22 explorer audit (baseline: 147 color-contrast elements across 24 routes) once the FUI-component migration slices land; expect most contrast failures to resolve via FUI's accessible token defaults. Do NOT hand-fix contrast before then.

## Baseline + rationale

Baseline is [we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit.md): 147 `color-contrast` elements across 24/30 routes, all advisory `warn`s, 0 hard errors. The failures are a handful of shared hand-rolled token values (muted greys ~2.8:1, brand purple 4.21:1) reused app-wide — exactly what the #1254 dogfood migration replaces with FUI's accessible defaults. So the action is: land #1506–#1509, then re-run and diff against this baseline (ideally via the productized `--out` audit from #1525). What remains after migration is the real residual to fix at plateau's theme layer.
