# Explorer audit of plateau-app — a11y/contrast sweep (logged-out + simulated logged-in)

_2026-06-22 · Ran the explorer's Layer-1 oracle layer (`fui:tools/explorer/oracles/`) over the live plateau-app
on `:4000`, across all 30 routes — 10 logged-out + 20 behind a simulated sign-in. Full per-route screenshots
(offending elements outlined) + raw data live in the plateau-app workspace under
`plateau:reports/explorer-2026-06-22/` (the rendered report, the raw findings data, and the screenshots
bundle)._

This report serves two purposes:

1. **Forcing evidence for the Explorer CLI-autonomy epic.** The `fui:tools/explorer/cli.ts` surface could NOT
   produce this audit on its own (no auth, no screenshots, no whole-app-by-URL sweep, a11y collapsed to the
   first violation). I had to write a bespoke harness (`fui:tools/explorer/plateau-audit.ts`) to get there —
   that harness is the proof-of-concept for the autonomy gaps captured as backlog cards.
2. **Baseline for the plateau dogfood migration (#1254).** Most contrast failures trace to plateau's
   hand-rolled theme/CSS, which the FUI-component migration (#1506–#1509) is expected to largely resolve.
   Re-run this audit after that migration lands; do NOT hand-fix contrast first.

## How it was run

- The explorer CLI has no auth and plateau's session is an in-memory store that a full-page `goto` resets, so
  the harness logs in once via the form, then hops protected routes through the router's reload-free
  `route-view.navigate(path)` — keeping the session alive — and reuses the **real** oracle layer
  (`PlaywrightObservationCollector` + `OracleBus`: axe/WCAG A-AA incl. `color-contrast`, console errors, HTTP
  5xx, layout overflow, focus traps, crashes). Viewport 1440×900, headless chromium.

## Summary

- **Routes audited:** 30 (10 logged-out, 20 logged-in via simulated sign-in)
- **Routes with issues:** 24 / 30
- **a11y violations:** 157 offending elements
- **Other Layer-1 findings (console / layout / focus / 5xx / crash):** 0

### Issues by rule (whole app)

| Rule | Elements | Routes | Severity |
| --- | --- | --- | --- |
| `color-contrast` | 147 | 24 | serious (advisory `warn`) |
| `select-name` | 6 | 1 | — |
| `aria-required-children` | 2 | 2 | — |
| `scrollable-region-focusable` | 2 | 2 | — |

All findings are advisory `warn`s (the #770 axe posture) — none are gate-blocking errors. The dominant issue
is **color-contrast** by an order of magnitude.

### Worst routes (color-contrast element count)

`/compatibility-map` (22) · `/governance-ui` (19) · `/design-system-creator` (13) · `/component-assembler` (7)
· `/vision-review` (7) · `/libraries` (6).

### Recurring culprits (these repeat across the whole app)

| Pattern | Example fg / bg | Ratio | Where |
| --- | --- | --- | --- |
| Muted grey body/meta text on near-white | `#9698ad` / `#ffffff` | 2.84:1 | login, footers, table meta, entity lists |
| Lighter grey on off-white | `#9596a5` / `#fcfdfe` | 2.87:1 | shared `strong`/label chrome |
| Brand purple link just under AA | `#6d5efc` / `#f6f7fc` | 4.21:1 | landing/login/footer links |
| Cyan eyebrow on light | `#16d3e6` / `#f6f7fc` | 1.7:1 | landing eyebrow |

Because these are a handful of shared token values reused everywhere, fixing them at the token layer (or
inheriting FUI's accessible token defaults via the #1254 dogfood migration) collapses most of the 147.

## Disposition

- **No hand-fix now.** Per the dogfood mandate (#1253), plateau's product UI should be FUI components + a
  custom theme; the contrast failures are largely a symptom of the ~95%-hand-rolled current state. The
  migration slices (#1506 form controls, #1507 card, #1508 badge/status, #1509 graph) should absorb most of
  them. Re-audit after they land (tracked as a follow-up task).
- **The autonomy gaps are the actionable output of this run** — see the Explorer CLI-autonomy epic and its
  child cards.
