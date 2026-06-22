---
kind: task
parent: "1254"
locus: plateau-app
status: resolved
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md
tags: []
relatedReport: reports/2026-06-22-plateau-app-explorer-a11y-audit.md
---

## Resolved (batch-2026-06-22-1545-1549) — re-run done; hypothesis FALSIFIED, residual filed as #1559

Re-ran the audit via the now-productized explorer CLI (`--auth` recipe #1523 + `--out` bundle #1525, two
passes: simulated-login click-nav over `[route\:link]` for the 20 logged-in routes, `goto` for the 10
public routes; 29/30 covered, `/apps/1` unreachable). Full diff + methodology:
[we:reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md);
bundles + recipes at `plateau:reports/explorer-2026-06-22-rerun/`.

**Result:** the FUI migration did **not** resolve contrast — 403 `color-contrast` nodes remain (vs the
147-node bespoke baseline), concentrated in the logged-in app shell; public/un-migrated routes are flat (a
clean harness control). Caveat: the bespoke baseline is non-reproducible and undercounted (several routes
baseline=0 → now double-digits), so part of the +256 is the CLI seeing what the baseline missed — but a
403-node residual is real. That residual (theme-layer contrast fix + a new `aria-required-children` on
`/profiles`+`/control-plane`) is filed as **#1559**. This task's job — re-run + diff + surface the residual
— is complete.

# Re-run explorer a11y audit on plateau-app after FUI dogfood migration

Re-run the 2026-06-22 explorer audit (baseline: 147 color-contrast elements across 24 routes) once the FUI-component migration slices land; expect most contrast failures to resolve via FUI's accessible token defaults. Do NOT hand-fix contrast before then.

## Baseline + rationale

Baseline is [we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit.md): 147 `color-contrast` elements across 24/30 routes, all advisory `warn`s, 0 hard errors. The failures are a handful of shared hand-rolled token values (muted greys ~2.8:1, brand purple 4.21:1) reused app-wide — exactly what the #1254 dogfood migration replaces with FUI's accessible defaults. So the action is: land #1506–#1509, then re-run and diff against this baseline (ideally via the productized `--out` audit from #1525). What remains after migration is the real residual to fix at plateau's theme layer.
