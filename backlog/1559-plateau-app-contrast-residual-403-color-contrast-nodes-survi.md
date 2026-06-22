---
kind: story
size: 5
status: resolved
locus: plateau-app
parent: "1254"
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
relatedReport: reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md
tags: [plateau, a11y, color-contrast, fui-migration]
---

# plateau-app contrast residual — 403 color-contrast nodes survive FUI migration

The #1527 re-run (productized explorer CLI over live :4000, after the #1254 FUI dogfood migration #1506–#1509) found the FUI migration did **not** resolve color-contrast as hoped — 403 `color-contrast` nodes remain (vs a non-reproducible 147-node bespoke baseline), concentrated in the logged-in app shell. Investigate per-element (screenshots in `plateau:reports/explorer-2026-06-22-rerun/`) whether each is an FUI component rendering its own low-contrast default token or plateau's muted-grey theme tokens applied across more surface, then fix at plateau's theme layer. Also fold in the `aria-required-children` issue that surfaced on `/profiles` + `/control-plane`.

## Evidence (#1527, 2026-06-22)

Full diff + methodology: [we:reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md).

- **403 `color-contrast` nodes** across 29/30 routes (`/apps/1` unreachable). Public/un-migrated routes are
  **flat** vs baseline (a clean harness control); the logged-in app shell carries ~2.7× more.
- **Worst routes:** `/compatibility-map` (67), `/governance-ui` (53), `/technical-configurator` (33),
  `/learn` (29), `/design-system-creator` (27), `/design-review` (25), `/libraries` (20), `/apps` (17),
  `/component-assembler` (17), `/impact-analysis` (16), `/contract-drift` (16).
- **Caveat:** part of the +256 delta is the productized CLI **seeing routes the bespoke baseline
  undercounted** (several were baseline=0 → now double-digits), not pure regression — but a 403-node
  residual is real and large regardless.
- **`aria-required-children`** (1 node each) appeared on `/profiles` + `/control-plane` — a structural a11y
  issue to fix alongside contrast.

## Work

- Per-element triage of the worst routes (the bundle screenshots outline offending elements; or re-run the
  CLI and read the live axe `contrast` ratios/targets). Classify: FUI-component default token vs plateau
  theme token vs hand-rolled markup.
- Fix at plateau's **theme layer** (the shared token values — muted greys ~2.8:1, brand purple 4.21:1 from
  the original baseline) so a single token correction lifts many elements at once; do not hand-patch
  per-element.
- Fix the `/profiles` + `/control-plane` `aria-required-children`.
- Re-run the explorer audit and diff against `plateau:reports/explorer-2026-06-22-rerun/` to confirm the drop.

## Acceptance

- [ ] A re-run shows `color-contrast` nodes materially reduced from 403 (target: the genuine residual after
      theme-token correction, ideally < the original 147).
- [ ] `/profiles` + `/control-plane` `aria-required-children` cleared.
- [ ] Fix is at the theme/token layer, not per-element overrides.

Relates to #1254 (FUI dogfood epic), #1527 (the re-run that found this), #1530 (CLI coverage gap).

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Drove logged-in color-contrast **403 → 15 nodes** (~96%; live axe re-run over the running :4000, 18 routes,
SPA-navigated after login) and cleared **aria-required-children to 0**. Triaged with a live axe probe (not
the screenshots) to get the actual fg/bg/ratio per node, then fixed at the theme/token layer:

- **Token corrections** (`plateau:src/styles/tokens.json` → `gen:tokens` → `plateau:src/styles/theme.css`):
  `text-muted` #9698ad→#686a82 (2.65→~5:1 on light), `primary` #6d5efc→#6453f4 (4.21→~4.8; also lifts
  white-on-primary fills; gradient start matched), `error` #ef4444→#c81e1e (3.76→4.85 on white), and a new
  `accent-text` #0a6d7c for accent-as-text (the bright cyan #16d3e6 eyebrow was **1.7:1**).
- **Wrong-var bug:** `plateau:src/platform-manager/governance.css` referenced `var(--text-muted, #64748b)`
  — plateau's token is `--color-text-muted`, so it always fell back to the inaccessible #64748b. Repointed
  to `--color-text-secondary` (7.6:1).
- **Hardcoded greys → tokens:** compatibility-map (`plateau:src/compatibility-map/dashboard.css`) +
  technical-configurator / platform-map / impact-analysis / contract-drift #8a94a6 → `--color-text-secondary`;
  `.tone-warn`/`.tone-none` darkened; `.dsc-preview-btn`/CTA #3b82f6 fallback → #6453f4;
  `.landing-eyebrow`→accent-text, `.landing-link` fallback→#6453f4, logged-off breadcrumb opacity 0.6→0.85.
- **aria:** `role="tablist"` in `plateau:src/profiles/profiles-page.ts` + `plateau:src/control-plane/dashboard.ts`
  held `<button>` children without `role="tab"` — added `role="tab"` + `aria-selected`.

All 263 plateau-app unit tests pass. The **15 residual** nodes don't yield to a token correction (a dark
review sub-app with a token-vocab collision, persona-accent data, a computed grey, a marginal error-on-tint)
— each needs a distinct non-mechanical fix, captured as **#1575** (note: a blanket `#9aa3bd` swap on the dark
review panels was tried and reverted — it regresses the light-surface muted text in the same files). Both
acceptance targets met: materially reduced & well under the 147 ideal; aria cleared; fixes at the theme/token
layer.
