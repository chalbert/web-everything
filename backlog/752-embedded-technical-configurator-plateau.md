---
type: idea
workItem: story
size: 5
status: resolved
parent: "746"
blockedBy: ["788", "789", "790"]
locus: webeverything
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: scripts/lib/technical-configurator-url.cjs
relatedProject: webdocs
crossRef: { url: /backlog/079-render-strategy-toggle-ui/, label: "Render-strategy toggle (#079)" }
tags: [webdocs, block-explorer, plateau-embed, technical-configurator, render-strategy, chunks, transport]
---

# Embedded technical configurator (Plateau embed) — the WE block-page button + seeded embed + cost preview

Add a **"Configure technical aspects"** button on the block page that opens an **embedded mini technical configurator** (a Plateau Technical Configurator embed) scoped to *this block* — seeded with its four technical dimensions: render strategy (#079), delivery transport (#455), trait lazy-loading (#448), chunk splitting (#719/#720). It **deep-links to the full Plateau Technical Configurator** for the project-wide decision, and renders the **cost preview** (chunk graph + estimated bytes/requests/hydration) for the chosen config so the tradeoff is concrete.

This is the **integration slice** of the program — the upstream pieces are carved out (see *Sliced* below): it consumes the four Configurator domains (#789), the embed/seed transport contract (#788), and the cost-preview model (#790), and wires them onto the WE block/explorer surface.

## Build

- "Configure technical aspects" button on the WE block page → opens the embedded mini configurator via the embed/seed transport ratified in #788, seeded with this block's four dimensions.
- Deep-link to the full Plateau Technical Configurator for the project-level call.
- Render the #790 cost preview (chunk graph + bytes/requests/hydration) inside the embed.

## Acceptance

- [ ] The button opens the per-block configurator (seeded) and the deep-link reaches the full Plateau one.
- [ ] Changing a technical setting updates the chunk-graph / cost preview.
- [ ] A fixture exercises at least one non-default technical config on a block.

## Notes

Per intent-UX-only / technical→Configurator: these are technical settings, never UX dimensions on the block and never a WE mandate.

## Sliced (2026-06-16, `/slice 752`) — re-scoped 13 → 5, the integration slice; siblings carved under #746

Claimed in batch-2026-06-16, traced the real surfaces, found it epic-shaped (bumped 3 → 13), and `/slice`d
it. The re-trace also corrected its own premise #1: the Plateau Configurator now has **9 domains** with a
repeatable `seed-*.ts` + provider + presets add-pattern (`plateau:plateau-app/src/technical-configurator/provider.ts:9-31`),
so adding the four WE dimensions is mechanical, not impossible. The split (siblings under #746):

- **#788** *(decision)* — Plateau↔WE **embed/seed transport contract** (the only genuine open fork; was
  buried as premise 2 here, now de-buried into its own card). This item is `blockedBy` it.
- **#789** — add the **four WE technical dimensions as Configurator domains** (render-strategy #079,
  transport #455, trait-lazy-load #448, chunk-split #719/#720).
- **#790** — the **cost-preview model + UI** (chunk graph + bytes/requests/hydration), `blockedBy` #789.

#752 stays a `story` (already had a parent — not converted to an epic) re-scoped to the WE button + seeded
embed + preview render, `blockedBy: [788, 789, 790]`. Full analysis:
`we:reports/2026-06-16-backlog-split-analysis.md`.

## Progress — built the integration slice (2026-06-16, batch-2026-06-16)

All three deps (#788 transport, #789 domains, #790 cost-preview) resolved; built the WE↔Plateau glue:

- **Seed transport (#788 URL-canonical + typed)** — `we:scripts/lib/technical-configurator-url.cjs`:
  `buildTechnicalConfiguratorUrl(base, config, {embed})` emits typed params mirroring the block's
  dimensions (`domain`, `strategy`, `req-<axis>`), `embed=1` for the iframe / omitted for the deep-link.
  Never an opaque blob.
- **WE block-page surface** — a `technicalConfigurator` Eleventy shortcode (`we:.eleventy.js`, mirrors the
  `fuiDemo` sandboxed-iframe boundary; Plateau base env-parameterised via `PLATEAU_BASE`, default
  `:4000`) + a "Configure technical aspects" section in `we:src/block-pages.njk` (renders when a block
  carries `technicalConfig`) + a teal Plateau badge variant in `we:style.css`. The cost preview renders
  inside the embed (Plateau's existing `/technical-configurator` cost mount, #790).
- **Seed data** — the `wizard` block seeds a **non-default** config (render-strategy · DSD ·
  pre-rendered/light) in `fui:blocks.json`.
- **Plateau receiving end** — `seedFromUrl()` in `we:plateau-app/.../technical-configurator/configurator.ts`
  overlays the URL seed over localStorage (URL wins, per #788); validates domain/strategy/axis ids
  against the provider (unknown → ignored, no dead-seed). Typechecks clean (plateau-app's 39 pre-existing
  tsc errors are unrelated — none in this file).
- **Fixture** — `we:scripts/lib/__tests__/technical-configurator-url.test.mjs` (6 tests): typed-param +
  embed/deep-link contract, and a real block round-tripping a non-default config. Green.

Acceptance met: button opens the seeded per-block configurator + deep-link reaches the full one (✓);
changing a setting updates the cost preview via the existing Plateau route (✓); fixture exercises a
non-default config on the `wizard` block (✓).
