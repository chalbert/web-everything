# Explorer a11y re-run — plateau-app, post-FUI-dogfood migration (#1527)

_2026-06-22 · Re-ran the explorer a11y/contrast sweep over the live plateau-app (`:4000`) after the
#1254 FUI-component dogfood migration slices (#1506–#1509) landed. Baseline:
[we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](2026-06-22-plateau-app-explorer-a11y-audit.md)
(147 `color-contrast` nodes across 24/30 routes). Bundles + recipes:
`plateau:reports/explorer-2026-06-22-rerun/`._

## Headline — the migration did NOT resolve contrast

| | Baseline (bespoke harness) | Re-run (productized CLI) | Δ |
| --- | --- | --- | --- |
| `color-contrast` nodes | 147 | **403** | **+256** |
| Routes covered | 30 | 29 (`/apps/1` unreachable) | — |

The hypothesis behind #1527 — "expect most contrast failures to resolve via FUI's accessible token
defaults" — is **falsified by the data**: contrast did not broadly resolve. The logged-in app-shell
routes (the ones the migration touched) carry **~2.7× more** flagged nodes than the bespoke baseline; the
un-migrated public/marketing routes are **flat**.

## How it was re-run (now reproducible — unlike the baseline)

The baseline used a one-off bespoke harness (`fui:tools/explorer/plateau-audit.ts`) that was **never
committed** and is gone. This re-run instead uses the now-productized path the baseline hoped for —
the explorer CLI's `--auth` recipe (#1523) + `--out` bundle (#1525) — so it is **repeatable** (both recipe
JSONs are saved next to the bundles under `plateau:reports/explorer-2026-06-22-rerun/`):

- **Logged-in pass:** one declarative login (`fui:tools/explorer/authRecipe.ts` `steps` over the simulated
  `#login-form` — no real backend), then each of the 20 product routes reached by **clicking its
  `[route\:link="/path"]` sidebar link** — client-side SPA nav that never reloads, so plateau's
  **in-memory** `SimpleStore` session survives (a `goto` would drop it).
- **Logged-out pass:** the 10 public routes via plain `goto`, no auth.
- Same real oracle layer as the baseline (`PlaywrightObservationCollector` + axe/WCAG A-AA incl.
  `color-contrast`), headless chromium.
- **Coverage gap:** `/apps/1` (a deep entity route reached by clicking a dynamically-rendered list link)
  was `route-unreachable` — the async `/api/apps` list hadn't rendered the link within the per-route click
  timeout. 29/30 routes covered; baseline had 5 nodes there.

## Per-route diff

```
route                      base rerun  delta
-- public / un-migrated (flat — harness control) ----------
/home                         5     5     0
/login                        5     5     0
/signup                       4     4     0
/reset                        3     3     0
/pricing                      2     1    -1
/terms                        3     3     0
/privacy                      3     3     0
/deck                         1     1     0
/deck/developer               1     1     0
/deck/design-system           1     1     0
-- logged-in app shell (migrated) -------------------------
/                             4     5    +1
/apps                         5    17   +12
/apps/1                       5     0    (unreachable, not 0)
/libraries                    6    20   +14
/profiles                    14     0   -14   (→ gained aria-required-children instead)
/control-plane                9     0    -9   (→ gained aria-required-children instead)
/settings                     0     7    +7
/intent-configurator          0     6    +6
/vision-review                7     8    +1
/design-review                5    25   +20
/component-assembler          7    17   +10
/technical-configurator       0    33   +33
/design-system-creator       13    27   +14
/learn                        0    29   +29
/compatibility-map           22    67   +45
/impact-analysis              1    16   +15
/contract-drift               2    16   +14
/platform-map                 0    15   +15
/governance-ui               19    53   +34
/web-docs                     0    15   +15
-----------------------------------------------------------
TOTAL                       147   403  +256
```

## Reading the result honestly (the confound)

The +256 is **not** cleanly "the migration regressed contrast." Two things confound a direct count diff:

1. **The baseline is non-reproducible and undercounted.** Several routes were **baseline = 0 → now
   double-digits** (`/learn` 0→29, `/technical-configurator` 0→33, `/platform-map` 0→15, `/web-docs` 0→15,
   `/settings` 0→7). A genuinely clean route doesn't sprout 29 serious-contrast nodes from a token swap;
   far likelier the bespoke harness **never fully rendered/audited** those routes (it has the documented
   #1530 "CLI misses a11y findings present on the page" class of gap). So part of the delta is the
   productized CLI simply **seeing** what the baseline missed.
2. **The public routes are a clean control.** Same harness, same axe, un-migrated pages → **flat** (28→26).
   That rules out wholesale CLI over-counting and lends confidence the logged-in increase is real signal,
   not instrument noise.

**Net:** the migration did **not** deliver the hoped-for "FUI accessible defaults wipe out contrast"
outcome — the live app has a **large contrast residual (403 nodes)** concentrated in the app shell, dominated
by `/compatibility-map` (67), `/governance-ui` (53), `/technical-configurator` (33), `/learn` (29),
`/design-system-creator` (27), `/design-review` (25). Whether each node is an FUI component rendering with
its own low-contrast default token, or plateau's own muted-grey theme tokens now applied across more
FUI-rendered surface, needs **per-element inspection** (the CLI bundle persists counts + screenshots but not
per-target ratios; the screenshots under `plateau:reports/explorer-2026-06-22-rerun/` outline the offending
elements). That investigation + fix is the real residual — filed as **#1559**.

## Side findings

- `/profiles` + `/control-plane` flipped from `color-contrast` to **`aria-required-children`** (1 node each)
  — a structural a11y issue introduced/surfaced by the migration, worth folding into #1559.
- This productized-CLI run is the **new canonical, reproducible baseline** for plateau a11y; future re-runs
  should diff against `plateau:reports/explorer-2026-06-22-rerun/`, not the gone bespoke baseline.
