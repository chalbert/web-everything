---
kind: story
size: 3
parent: "1601"
status: open
dateOpened: "2026-06-28"
tags: []
---

# FUI we-section-card transient primitive (CardElement-style, resolveTag section)

The FUI-substrate primitive #1886's substrate boundary spawns. `we-card` already binds the card to an
`<article>` root; `we-section-card` is its `<section>` counterpart: a `CardElement`-style `TransientElement`
whose `resolveTag()` returns `'section'`, erasing to `<section class="fui-card">` at runtime (landmark +
wrapper id preserved). Product-agnostic — no title/footer/menu opinion (those live in product components like
`standard-section`). Carries the transient-behavior constraint #1886 flagged: a custom behavior must be
delegated onto the erased native DOM, not bound to the vanished host. Lands in `frontierui` blocks/card
alongside `CardElement`; consumed by the WE website's `standard-section` (#1608).
