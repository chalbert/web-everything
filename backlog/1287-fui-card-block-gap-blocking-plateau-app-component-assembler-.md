---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/card/Card.ts"
tags: [fui, gap, dogfood, plateau-app]
---

# FUI card block — gap blocking plateau-app Component Assembler dogfood

FUI has no card block (verified against fui:blocks/* — 43 blocks, none a card). The #1254 plateau-app dogfood found its Component Assembler (we:plateau:src/component-assembler/assembler.ts) hand-rolls cards (tabs + code-view already exist in FUI), so that surface is could-not-split until FUI ships a card. Per first-party-dogfood, file the gap. locus: frontierui. Unblocks the Component Assembler migration slice once shipped.

## Progress

Shipped the FUI card block, closing the gap that blocked the plateau Component Assembler migration (#1254):

- `fui:blocks/card/Card.ts` — `createCard`/`mountCard`/`mountInDocument` config factory (same shape as the
  badge/button blocks — no global tag). Renders a semantic `<article>` with an optional header (title at a
  configurable heading level + a trailing actions slot), a body (Node or HTML string), and an optional
  footer. `CARD_CSS` exported for composing hosts; consumes the host's surface/border/radius custom
  properties with literal fallbacks. Satisfies the `EmbedMountModule` mode-C contract.
- `fui:blocks/card/index.ts`, `fui:blocks/__tests__/unit/card/Card.test.ts` (7 tests green),
  `fui:demos/card-demo.html`, `fui:src/_data/blocks.json` (registered: type Module, demoFile card-demo.html).

Verified at :3001 (Playwright): the mode-C showcase + an actions card mount 4 `.fui-card` articles in a
shadow root (titles, footer, header-action button), zero console errors. FUI `check:standards` clean for
card (41 blocks, demo resolves); red only on the 2 pre-existing notification/signature-pad catalog errors
(stepped over). The plateau Component Assembler swap onto `createCard` is the follow-on #1254 slice.
