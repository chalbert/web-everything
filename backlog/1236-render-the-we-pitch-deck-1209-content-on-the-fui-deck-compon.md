---
kind: story
size: 5
parent: "1210"
status: open
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
relatedProject: webdocs
tags: [deck, dogfood, conformance, fui]
---

# Render the WE pitch deck (#1209 content) on the FUI deck components + plateau hosting

The actual deck dogfood, now unblocked by the FUI deck-component build (#1228, resolved). Assemble the real WE/constellation pitch deck — content from #1209 — on the shipped fui:blocks/deck/ components (DeckBehavior realizing #1180 doc-model / #1191 layout-template / #1179 advance), themed via webtheme tokens and hosted on plateau, so 'our own pitch runs on our own stack' becomes live conformance proof (mirrors the #777 dogfood). The #1215 readiness map confirmed all 19 deck contracts spec'd and the #765/#777 mount boundary relaxed; #1228 delivered the critical-path FUI build + green vector suites. This slice composes content+components+hosting into the rendered deck.

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
