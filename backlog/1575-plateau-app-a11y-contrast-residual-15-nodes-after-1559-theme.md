---
kind: story
size: 3
status: resolved
locus: plateau-app
parent: "1254"
relatedReport: reports/2026-06-22-plateau-app-explorer-a11y-audit-rerun.md
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: [plateau, a11y, color-contrast, fui-migration]
---

# plateau-app a11y contrast residual — 15 nodes after #1559 theme-token sweep

#1559 drove plateau-app's logged-in color-contrast from 403 → **15 nodes** (live axe re-run over :4000,
18 routes) by darkening the `text-muted`/`primary`/`error` tokens, adding `accent-text`, fixing
governance's wrong `--text-muted` var name, and repointing the compatibility-map greys. The 15 residual
nodes don't yield to a single token correction — each is a distinct, non-mechanical fix. Pick them off
per-cluster and re-run the explorer (`plateau:reports/explorer-2026-06-22-rerun/`) to confirm < the original
147 target is held and the residual lands at ~0.

## Residual (live axe, 2026-06-22, after #1559)

1. **Dark review sub-app — 8×** `#686a82 on #0f1220` (`/design-review`, also `/vision-review`,
   `/review-harness`). `plateau:src/design-review/design-review.css`, `plateau:src/vision-review/vision-review.css`
   and `plateau:src/review-harness/harness.css` are authored as a **dark** theme via fallbacks to
   non-existent tokens (`--color-bg`→#0f1220, `--color-surface-2`→#1b2030) **but** plateau defines some of
   the names they use (`--color-surface`=#f6f7fc **light**), so the sub-app renders a broken light/dark mix
   from a **token-vocabulary collision**. `var(--color-text-muted)` now resolves to the (correctly) darkened
   #686a82 which fails on the dark panels. Real fix: reconcile this sub-app's token vocabulary with
   plateau's (give it a real dark surface set + a dark-surface muted), not a blanket find/replace (a blanket
   `#9aa3bd` swap regresses the light-surface muted text in the same files — verified).
2. **Persona-accent buttons — 3×** `#ffffff on #3b82f6` (`/profiles`, `/design-system-creator`) +
   `#3b82f6 on #e0e9fb` (`/profiles`). Persona `accent` values in `plateau:src/profiles/roster.ts` are
   chosen for vibrancy and used as a button/badge background with white text (and as text on a light tint);
   several fail white-on-accent. Fix: either darken the failing persona accents, or derive the on-accent
   text color from the accent's luminance.
3. **Component-assembler grey — 2×** `#a8a9b9 on #f6f7fc` (`/component-assembler`). A **computed** light
   grey (no literal in `plateau:src/component-assembler/assembler.css` — likely an opacity/FUI-component
   default); needs per-element trace.
4. **Error-on-tint — 2×** `#c81e1e on #f0dde1` = 4.4 (`/control-plane`, `.cp-verdict--blocked` etc.). The
   #1559-darkened error token clears AA on white (4.85) but lands at **4.4** on the light-red tint
   background — a hair under 4.5. Nudge the tint darker, or use a dedicated `--color-error-text`.

## Acceptance

- [x] A live axe re-run over :4000 shows color-contrast at ~0 (held < the original 147 baseline).
- [x] The review sub-app theming collision (#1 above) is reconciled, not blanket-replaced.
- [x] Fixes stay at the theme/token (or per-persona data) layer where each cluster allows.

Relates to #1254 (FUI dogfood epic), #1559 (the sweep that drove 403→15), #1527 (the re-run that found the
original 403).

## Progress (resolved 2026-06-22, batch-2026-06-22-1575-1030)

Drove logged-in `color-contrast` to **0 distinct nodes** (live explorer re-run over the running :4000,
deduped per fg/bg/target — the explorer's per-state bundle report inflates by re-counting the same elements
across interactive states; the deduped distinct set is the real residual). Triaged each against the live
axe ratios, fixed at the theme/token/data layer per the "no blanket replace" constraint:

- **Cluster 1 — design-review tier chip (8×, `#686a82`/`#0f1220`=3.54).** Only `.dr-axis-tier` failed (not
  vision-review/review-harness as guessed). The chip draws its own dark bg, so plateau's *light-surface*
  `--color-text-muted` (#686a82) fails on it — pinned the dark-surface muted `#9aa3bd` (7.4:1).
  `plateau:src/design-review/design-review.css`.
- **Cluster 2 — persona/primary accents (3×).** White-on-accent and accent-on-tint fail for *arbitrary*
  persona/user colors, so a per-value darken is whack-a-mole. Added a shared luminance helper
  `plateau:src/styles/contrast-color.ts` (`onColor`, `inkOnLight`) and emit `--pf-accent-on`/`--pf-accent-ink`
  from `plateau:src/profiles/profiles-page.ts` (`.pf-tab--active` + `.pf-area-tag`) and `--dsc-on-primary`
  from `plateau:src/design-system-creator/creator.ts` (`.dsc-preview-btn`) — fixes every accent at once.
- **Cluster 3 — assembler count (2×, `#a8a9b9`/`#f6f7fc`=2.17).** `opacity: 0.55` dimmed the heading color
  below AA; replaced with the muted token at full opacity. `plateau:src/component-assembler/assembler.css`.
- **Cluster 4 + same-kind extras.** The `semantic-color text on a 12% tint of the same color` badge pattern
  lands ~4.4 (the #1559-tuned colors are ~4.85 on white but drop on the tint). Darkened the text in
  `cp-verdict--blocked`, the provider greens (`#1a7f3c`→`#176b32` in contract-drift / impact-analysis /
  platform-map / compatibility-map `.tone-ok`), and the unassigned amber (governance). The item scoped 15;
  the deduped live set was 19 (all the same four kinds) — all fixed.

Verified: explorer re-run → **0 distinct color-contrast nodes**; 273 plateau-app unit tests pass.
