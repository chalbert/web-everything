---
kind: story
size: 3
parent: "1254"
status: open
dateOpened: "2026-06-20"
tags: []
---

# plateau-app theme: express the proprietary theme as a DTCG token layer for FUI-enhanced markup

Re-express plateau-app's hand-rolled 93-line we:plateau:src/styles/theme.css as a DTCG design-token layer that styles FUI behavior-enhanced HTML — the single differentiator the #1253 first-party-dogfood mandate allows. Note (per the #1254 split investigation): FUI ships NO shared token base; blocks are consumer-themed, so this authors plateau's own DTCG tokens as the CSS layer over FUI markup, not a rebase onto FUI tokens. Foundation slice: underlies every surface migration, independent of any FUI block shipping. Demoable: plateau-app at :4000 renders with the DTCG-sourced theme.
