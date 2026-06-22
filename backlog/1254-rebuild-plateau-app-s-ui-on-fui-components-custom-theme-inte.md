---
kind: epic
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateResolved: "2026-06-22"
graduatedTo: none
relatedReport: reports/2026-06-20-1254-split-analysis.md
tags: [dogfood, fui, plateau-app, theme, intents, site-rework, epic]
---

# Rebuild plateau-app's UI on FUI components (custom theme + intents only) — replace the hand-rolled chrome

Migrate plateau-app's product UI off hand-rolled vanilla TypeScript onto FUI components driven by WE intents, so the only thing distinguishing plateau-app's look is a custom theme. This is the build that lands the [#1253](/backlog/1253-plateau-app-dogfooding-mandate-its-product-ui-is-fui-compone/) dogfooding mandate ([first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood)). A 2026-06-20 audit found plateau-app is ~95% hand-rolled (~5k lines of `document.createElement` / `innerHTML` over a proprietary theme) with FUI present only as the plugs bootstrap + two SSR components in `we:`-adjacent `plateau:src/web-docs/`. The end-state: every surface renders from FUI; the residue that *can't* be built from `theme + intents` is filed as a gap, never hand-rolled around.

> **a11y baseline (2026-06-22).** An explorer audit of all 30 routes ([we:reports/2026-06-22-plateau-app-explorer-a11y-audit.md](../reports/2026-06-22-plateau-app-explorer-a11y-audit.md)) found 147 `color-contrast` failures across 24 routes — a handful of shared hand-rolled token values reused app-wide. This migration is expected to absorb most of them via FUI's accessible defaults; the post-migration re-audit + residual fix is tracked as **#1527** (blocked on the #1506–#1509 slices). Do NOT hand-fix contrast before the migration.

## Starting reality (the migration target list)

The audit pinned the hand-rolled surfaces to replace, each with the FUI component(s) it needs:

| Surface | File | FUI component(s) needed |
| --- | --- | --- |
| Intent Configurator | `plateau:src/intent-configurator/configurator.ts` | form controls, droplist, radio/checkbox, verdict panel |
| Technical Configurator | `plateau:src/technical-configurator/configurator.ts` | form controls, droplist, NL input box |
| Component Assembler | `plateau:src/component-assembler/assembler.ts` | tabs, cards, code viewer |
| Platform Map | `plateau:src/platform-manager/platform-map.ts` | graph/node viz (likely a gap to file) |
| Control Plane dashboard | `plateau:src/control-plane/dashboard.ts` | status badges, tables |
| Nav / sidebar | `plateau:index.html` (marked "workaround: no NavMenu") | NavMenu |
| Auth / profile | `plateau:src/main.ts` | droplist / combobox |
| Theme layer | `plateau:src/styles/theme.css` | re-express as a DTCG theme over FUI tokens, not a parallel token set |

Already on FUI (keep, conform): `Nav` + `ConformancePanel` SSR in `plateau:src/web-docs/served-site.ts`; plugs bootstrap in `plateau:src/main.ts`.

## Why this is its own epic

- **It's a stated end-goal not yet captured.** No existing item rebuilds plateau-app's own chrome out of FUI — [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/) is the *WE-docs site* twin, not plateau-app. This epic is that gap.
- **Forcing-function loop.** Per the [first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood) rule, every rendered a11y/visual regression on a migrated surface *is* a FUI component-conformance failure on the product's own front door — the same loop as the exercise apps (#314) and reproduction-conformance (#1225), turned inward.
- **Unblocked by the boundary.** plateau-app is the product layer and already consumes FUI via workspace aliases; no WE↔FUI relaxation (the [we-fui-embed-boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary) #765 gate that holds #777) applies here. The real gate is FUI *shipping* each component.

## Dependencies & gate

- **[#1253](/backlog/1253-plateau-app-dogfooding-mandate-its-product-ui-is-fui-compone/)** (decision, the charter) — `blockedBy` until ratified, then this epic carries the work.
- **#658** (promote `@frontierui/blocks` canonical) — resolved; the FUI floor exists.
- **Theme/intents bundle** — kin to [#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/) (design-system = theme + intents bundle, [intents-ux-only](../docs/agent/platform-decisions.md#intents-ux-only)); plateau-app needs its theme re-expressed as DTCG tokens over FUI's token base so migrated components carry plateau branding.
- **Per-surface slices** — to be carved from the target-list table above as the matching FUI components ship (mirrors #777's per-page ratchet). Each migrated surface gates on a rendered a11y/visual check (the conformance proof).

## Slices (ratchet — carve as FUI parts land)

Sliced 2026-06-20 (`/slice 1254`; analysis: [split-analysis report](../reports/2026-06-20-1254-split-analysis.md)). Investigation found plateau-app bootstraps `@frontierui/plugs/bootstrap` but wires **zero** FUI block behaviors, and FUI ships **no DTCG token base** (blocks are consumer-themed). Three surfaces are agent-ready against existing FUI blocks; five are gated on missing FUI components (gaps filed, not hacked — per [first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood)).

**Carved slices (ready):**
- [#1283](/backlog/1283-plateau-app-theme-express-theme-css-as-a-dtcg-token-layer-fo/) — theme: `we:plateau:src/styles/theme.css` → DTCG token layer (foundation, no FUI gate).
- [#1284](/backlog/1284-plateau-app-nav-sidebar-onto-fui-navigation-behaviors-the-fu/) — nav/sidebar onto FUI `navigation` behaviors (the FUI-block **integration-seam pilot**).
- [#1285](/backlog/1285-plateau-app-auth-profile-onto-fui-droplist-type-ahead/) — auth/profile onto FUI `droplist`/`type-ahead` (blockedBy #1284).

**Ratchet released 2026-06-22 — all four FUI-component gaps shipped, the gated surfaces are now carved migration slices:**
- [#1506](/backlog/1506-plateau-app-intent-technical-configurator-surfaces-onto-fui-/) — Intent + Technical Configurator onto FUI form controls (gap [#1286](/backlog/1286-fui-form-control-blocks-radio-checkbox-text-field-number-inp/) ✓).
- [#1507](/backlog/1507-plateau-app-component-assembler-onto-fui-card-block/) — Component Assembler onto FUI `card` (gap [#1287](/backlog/1287-fui-card-block-gap-blocking-plateau-app-component-assembler-/) ✓).
- [#1508](/backlog/1508-plateau-app-control-plane-dashboard-onto-fui-badge-status-bl/) — Control Plane dashboard onto FUI `badge`/status (gap [#1288](/backlog/1288-fui-badge-status-block-gap-blocking-plateau-app-control-plan/) ✓).
- [#1509](/backlog/1509-plateau-app-platform-map-onto-fui-graph-node-viz-block/) — Platform Map onto FUI graph/node viz (gap [#1289](/backlog/1289-fui-graph-node-viz-block-gap-blocking-plateau-app-platform-m/) ✓).

The ratchet is now fully released — every gated surface from the target-list table is carved. The epic resolves once these four migration slices land (each gated on its rendered a11y/visual conformance check).
</content>
