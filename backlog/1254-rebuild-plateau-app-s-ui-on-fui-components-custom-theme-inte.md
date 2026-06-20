---
kind: epic
status: open
locus: plateau-app
dateOpened: "2026-06-20"
childlessReason: unsliced
tags: [dogfood, fui, plateau-app, theme, intents, site-rework, epic]
---

# Rebuild plateau-app's UI on FUI components (custom theme + intents only) — replace the hand-rolled chrome

Migrate plateau-app's product UI off hand-rolled vanilla TypeScript onto FUI components driven by WE intents, so the only thing distinguishing plateau-app's look is a custom theme. This is the build that lands the [#1253](/backlog/1253-plateau-app-dogfooding-mandate-its-product-ui-is-fui-compone/) dogfooding mandate ([first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood)). A 2026-06-20 audit found plateau-app is ~95% hand-rolled (~5k lines of `document.createElement` / `innerHTML` over a proprietary theme) with FUI present only as the plugs bootstrap + two SSR components in `we:`-adjacent `plateau:src/web-docs/`. The end-state: every surface renders from FUI; the residue that *can't* be built from `theme + intents` is filed as a gap, never hand-rolled around.

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
- **Unblocked by the boundary.** plateau-app is the product layer and already consumes FUI via workspace aliases; no WE↔FUI relaxation (the #765 gate that holds #777) applies here. The real gate is FUI *shipping* each component.

## Dependencies & gate

- **[#1253](/backlog/1253-plateau-app-dogfooding-mandate-its-product-ui-is-fui-compone/)** (decision, the charter) — `blockedBy` until ratified, then this epic carries the work.
- **#658** (promote `@frontierui/blocks` canonical) — resolved; the FUI floor exists.
- **Theme/intents bundle** — kin to [#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/) (design-system = theme + intents bundle); plateau-app needs its theme re-expressed as DTCG tokens over FUI's token base so migrated components carry plateau branding.
- **Per-surface slices** — to be carved from the target-list table above as the matching FUI components ship (mirrors #777's per-page ratchet). Each migrated surface gates on a rendered a11y/visual check (the conformance proof).

## Slices (carve as FUI parts land)

Not yet sliced — carve one batchable item per surface row above once its FUI component(s) exist, plus the theme-rebase slice first (it underlies all surfaces). `childlessReason: unsliced` until the charter ratifies.
</content>
