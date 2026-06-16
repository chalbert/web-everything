---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
tags: [frontier-ui, webdocs, blocks, catalog, site, derivation]
crossRef: { url: /backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/, label: "Sibling — WE site renders real FUI blocks (#604)" }
relatedProject: webdocs
---

# FUI site's own block surface (7 of 21) — its relationship to the WE web-docs pipeline

The Frontier UI site has its **own** block catalog — `frontierui/src/_data/blocks.json` (7 hand-curated entries) rendered by `frontierui/src/blocks.njk` — while `frontierui/blocks/` ships **23 implemented families** (`droplist`, `for-each`, `navigation`, `renderers`, `resource-loader`, `text-nodes`, `traits`, `audit`, `lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`, `data-grid`, `type-ahead`, `background-task-surface`, … on top of the 7 shown). So the FUI site surfaces **~30%** of what it implements, and the gap is a static list that silently drifts — not missing implementation. This item decides what that FUI-local surface should *be*, because the existing web-docs pipeline doesn't cover it.

## Why this isn't already covered

The whole web-docs pipeline — [#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/) (derive), [#627](/backlog/627-assemble-the-web-docs-component-catalog-surface-from-the-der/) (catalog surface), [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) (render real FUI blocks) — targets the **WE docs site**: every reference is to `webeverything/src/_data/blocks.json` and `/blocks/` on `:8080`. None of them touch `frontierui/src/_data/blocks.json`, which is a **second, independent** block surface on FUI's own site. The constellation principle (WE = standard, FUI = impl, plateau-app = product) says docs-that-render-the-standard live on WE, not FUI — yet [#425](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/) (FUI self-hosts Web Docs UI primitives) means FUI plausibly *should* dogfood a rendered surface. That tension is the open call.

## The invariant (not a fork)

Whatever surface exists must be **auto-derived from the implementation** (CEM / a generated manifest), not the hand-maintained 7-entry `blocks.json`. The 7/21 staleness *is* the bug; nobody is arguing to keep curating by hand. Settle only where it renders.

## Correction (2026-06-15) — the original A/B was mis-framed against the rendering boundary

The fork was first written as "FUI exports a manifest only and **WE becomes the single rendered docs surface**" vs. "two renders." That framing contradicts a boundary already ruled on: **FUI owns both the implementation and its rendered display; WE never renders or imports FUI block code — it only *embeds* a FUI-hosted surface via the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) iframe component viewer (FUI-branded), which is the realisation of the [#700](/backlog/700-component-converter-playground-placement/) DC-7 ruling that ruled out cross-repo import.** There is no WE→FUI import seam (`vite.config.mts`/`.eleventy.js` have no `frontierui` alias; the only mechanism is the `fuiDemo` iframe shortcode in `.eleventy.js`).

So the old **Option A is ruled out, not a coherent branch**: WE *cannot* be "the single rendered surface" for FUI's blocks without exactly the cross-repo import #700 rejected. "Docs render the standard on WE" is true for WE's *own* standard pages, but a FUI block instance is FUI's deliverable — WE can only put a window onto it.

## The (collapsed) call

With A eliminated, the substance is no longer a fork — it's the **B shape, made precise**:

- **FUI renders its own local block catalog** (it owns impl + display), generated from a **single derived manifest** (CEM / generated), replacing the hand-curated 7-entry `frontierui/src/_data/blocks.json`. This dogfoods #425's self-hosted Web Docs primitives on real data.
- **WE surfaces FUI's catalog by embedding** FUI-hosted demos via the #701 `fuiDemo` iframe next to the matching standard page — it does **not** consume the manifest to render FUI blocks itself. The WE web-docs pipeline (#623/#627/#604) renders **WE's** standard surface; FUI's block instances reach WE only through the iframe window.

**The only genuine residual** (a build detail, not a fork): does WE embed FUI's *whole catalog browse* via one iframe, or only embed *individual demos* per standard page and link out to FUI's catalog for the full browse? **Default: individual demos per standard page + link out** — matches #701's grain (one demo per standard) and keeps the full "what FUI ships" browse owned by FUI.

> Reconciliation flag for #604: its acceptance still says "the **WE site** renders a live interactive instance of the real FUI block" with "HMR on the FUI source updates the page" and a Fork-2 "import `@frontierui` package surface" — written 2026-06-14, **before** the #700/#701 iframe ruling. That epic needs realigning to the iframe boundary (or explicitly carving an exception). Captured as a finding, not silently edited here.

## Ruling (2026-06-15) — collapsed call ratified

**FUI renders its own block catalog** from a single derived manifest (CEM/generated), replacing the hand-curated 7-entry `frontierui/src/_data/blocks.json`; this dogfoods #425. **WE never imports or renders FUI blocks — it embeds FUI-hosted demos via the #701 `fuiDemo` iframe** (the #700 DC-7 boundary). Residual settled at the **default: individual demos per WE standard page + link out** to FUI for the full catalog browse. Old Option A (WE as the single rendered surface) is recorded as **ruled out**, not a coherent branch. Single-derived-manifest invariant stands.

Spin-offs filed: the FUI manifest+catalog **build**, and the **#604 reconciliation** to the iframe boundary.

## Dependencies / coordination

- Derivation mechanism is shared with the WE pipeline ([#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/)/[#627](/backlog/627-assemble-the-web-docs-component-catalog-surface-from-the-der/)) — FUI's manifest derivation should use the same mechanism, not fork a parallel one.
- WE-side embedding reuses the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) `fuiDemo` iframe viewer (already built) — no new WE→FUI seam.
- #425 (FUI self-host Web Docs UI primitives, resolved) is the primitive set FUI's local catalog render dogfoods.
- [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) needs reconciling to the iframe boundary (see flag above).

## Acceptance (decision done when)

- [ ] The collapsed call ratified: FUI renders its own derived catalog; WE embeds via the #701 iframe, never renders FUI blocks. Single-derived-manifest invariant recorded.
- [ ] A follow-on **build** item filed to generate FUI's manifest + render FUI's local catalog from it (replacing the static 7-entry `blocks.json`).
- [ ] A follow-on item (or a note on #604) filed to reconcile #604's "WE renders real FUI blocks / `@frontierui` import" acceptance with the #700/#701 iframe boundary.
