---
kind: story
size: 3
parent: "1210"
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "plateau:src/marketing/deck.ts"
relatedProject: webdocs
tags: [deck, dogfood, conformance, fui]
---

# Render the WE pitch deck (#1209 content) on the FUI deck components + plateau hosting

The **foundational deck integration shell** (re-scoped from the full dogfood — audience content carved to siblings #1424/#1359/#1360). Build the net-new plateau deck page (`plateau:src/marketing/deck.ts` `mountDeck`) mounting the shipped `fui:blocks/deck/` `DeckBehavior` (#1180 doc-model / #1191 layout-template / #1179 advance, #1228 resolved) over a minimal 2-slide `[data-slide]` placeholder, themed via `we:webtheme/tokens.ts`, wired to a `/deck` public route in `plateau:src/main.ts` (#1239 `mountLanding` pattern), and browser-verified to mount + advance on the live plateau gate. This is the shared shell all four audience decks render on; once it lands, the content slices become parallel. Mirrors the #777 dogfood ('our own pitch on our own stack' as live conformance proof).

## Split (2026-06-20 — `/split 1236`, re-sized 13 → 5)

Sliced into the **foundational integration shell + the first audience deck**; the other two audience
decks were carved as sibling stories under the same parent #1210 (this story already had a parent, so
it stays a re-sized `story`, not a new epic — see
`we:reports/2026-06-20-backlog-split-analysis.md`). **This story's scope now:** build the net-new
plateau deck page (`plateau:src/marketing/deck*.ts` `mountDeck` module + `[data-slide]` markup +
`fui:blocks/deck/` `DeckBehavior` mount), theme it via `we:webtheme/tokens.ts`, wire a `/deck` route in
`plateau:src/main.ts`, render the **strategic/vision** deck
(`we:reports/2026-06-20-deck-strategic-vision-outline.md`), and browser-verify + green plateau gate.
The shell is the hard part — once it lands, the two sibling slices add their audience markup on top.

Carved siblings: developer/technical deck + design-system/enterprise deck (both `blockedBy: 1236`).

## Re-split — strategic content carved off; this story is now the pure shell (2026-06-21, `/split 1236`, re-sized 13 → 3)

The size-13 bundled the **deck integration shell** + the **strategic/vision deck content**. The prior
split (below) had already carved the developer (#1359) and design-system/enterprise (#1360) decks as
`size:3` siblings `blockedBy: 1236` — so the architecture is *one shared shell → parallel audience decks*,
and strategic content was the one audience deck never lifted off the shell. This pass carves it out into a
new `size:3` sibling under #1210 (`blockedBy: 1236`), mirroring #1359/#1360. See
`we:reports/2026-06-21-backlog-split-analysis.md` (focused `/split 1236` section).

**This story's scope now (shell only, `size:3`):** build the net-new plateau deck page
(`plateau:src/marketing/deck.ts` `mountDeck` module mounting `fui:blocks/deck/` `DeckBehavior` over a
minimal 2-slide `[data-slide]` placeholder), theme it via `we:webtheme/tokens.ts`, wire a `/deck` public
route in `plateau:src/main.ts` (add to `PUBLIC_ROUTES` + a robust-timing mount, the #1239
`mountLanding` pattern), and browser-verify the deck mounts + advances + green plateau gate. The placeholder
is throwaway markup the first audience-content slice replaces. Once this lands, all four audience decks
(strategic / #1359 / #1360) become parallel content slices over the shared shell.

## Re-sized 5 → 13 (2026-06-21, batch pre-flight) — superseded by the re-split above

The post-split scoping note below (added the same day as the `/split` re-size to 5) found the **shell
itself** is greenfield across three repos — content authoring from four outlines + a net-new plateau page
+ webtheme theming + `/deck` route + browser-verify against the live plateau server. That exceeds a size-5
batch-tail item; bumped to 13 so it drops Tier-A and routes to a focused **/exercise-app** session, not a
deep-batch chain. No design fork — purely effort/locus (build is real, just larger than the estimate).

## Scoping (2026-06-20 — carried forward, `outgrew`)

Claimed + scoped during a batch; **released back to open** — it's a focused multi-repo integration, not a
batch-seam compose. The pieces exist but assembly is **greenfield across three repos**:

- **Content** — #1209 is resolved; its narrative/outlines live in four child docs (no consolidated slide
  data yet): #1211 (narrative spine + proof-point library), #1212 (strategic/vision outline), #1213
  (developer/technical outline), #1214 (design-system/enterprise outline). Step 1 is synthesizing these
  into concrete per-audience slide content.
- **Components** — FUI deck components are built and present: `frontierui:blocks/deck/DeckBehavior.ts` +
  `frontierui:blocks/deck/deckConformance.ts` + `frontierui:blocks/deck/index.ts` (#1228). Consumable.
- **Hosting** — plateau-app has **no deck surface today** (`grep` of `plateau-app/src` finds zero
  DeckBehavior usage / deck route): a new plateau page/route must be built to mount the deck, theme it via
  webtheme tokens, and host it.

So the real work = (1) author slide-content data from the four outlines, (2) build a plateau-app deck
page mounting `DeckBehavior` with that data, (3) webtheme theming, (4) browser-verify the rendered deck +
green plateau gate (`npm test` in ../plateau-app). That is a focused plateau-app build (locus: plateau-app),
deserving a dedicated session — not a deep-batch tail item. Recommend setting `locus: plateau-app` and
running it via /exercise-app or a focused build. No blockers remain (all three inputs ready).

## Progress (2026-06-21, batch-2026-06-21)

- Built the net-new shell: `plateau:src/marketing/deck.ts` `mountDeck(mount)` — injects a token-driven
  stylesheet (`var(--*)` DTCG layer), renders a `data-deck` host with a minimal 2-slide `[data-slide]`
  placeholder (`data-layout` title/section) + `[data-deck-next]`/`[data-deck-prev]` controls, and mounts
  the shipped FUI `DeckBehavior` via `import { DeckBehavior } from '@frontierui/blocks/deck'` (the
  `plateau:vite.config.mts` `@frontierui/blocks` alias). CSS relies on DeckBehavior's native `[hidden]`
  slide-hiding (not a custom active class).
- Wired the `/deck` public route in `plateau:src/main.ts`: added `/deck` to `PUBLIC_ROUTES`, a
  `tryMountDeck` robust-timing mount (mirrors `tryMountLanding`/#1239), the route-change dispatch, and the
  initial-load call. Added the `<template route="/deck"><div id="deck-mount">` to `plateau:index.html`.
- **Plateau gate GREEN**: `npm test` (vitest) 259/259. `plateau:src/marketing/deck.ts` transforms cleanly (verified via the
  running :4000 dev server — `plateau:src/marketing/deck.ts` + its `@frontierui/blocks/deck` resolution compile with no error).
- **Live browser mount-advance verification is BLOCKED by a concurrent-session breakage, not this code.**
  A real-browser probe (Playwright on :4000) found the plateau bootstrap 500-ing on EVERY route (`/home`
  landing fails identically) due to `fui:plugs/webvalidation/ValidationErrorSummary.ts` importing an
  unresolved `@webeverything/error-summary` (an in-flight refactor in another session — not in this
  changeset). Per the standing don't-restart-the-dev-server rule I can't clear it, and per the
  gate-red-scoped-to-own-work rule a concurrent breakage isn't this item's stop. The build is complete +
  locus-gated; the mount-advance check should pass once the concurrent `@webeverything/error-summary`
  resolve is restored (the wiring is identical to the proven `mountLanding` path + DeckBehavior is used
  per its conformance-test contract). Re-verify on a clean server.
