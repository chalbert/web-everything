---
kind: story
size: 3
parent: "1601"
locus: frontierui
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
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

## Progress (batch-2026-06-27)

Landed in `frontierui` blocks/card alongside `CardElement`:
- `fui:blocks/card/SectionCardElement.ts` — a `TransientElement` whose `resolveTag()` returns `'section'`,
  erasing to `<section class="fui-card">`. Product-agnostic: `decorate()` only adds `BASE_CLASS` (no
  title/header/footer/menu opinion — those live in product components like `standard-section`, #1608). The
  base class already transfers every non-internal attribute, so the host's `id`/`aria-*` landmark naming is
  preserved on the surviving `<section>`. Per the #1886 transient-behavior constraint, `decorate()` touches
  only the erased native element (`el`), never the vanished host (`this`).
- `fui:blocks/card/registerSectionCard.ts` — `registerSectionCard(tag = 'we-section-card')`, idempotent,
  consumer-overridable (mirrors `registerCard`, #841 bare standard name).
- Exported from `fui:blocks/card/index.ts`; self-registered at runtime in `fui:plugs/bootstrap.ts` next to
  `registerCard()`.
- Test `fui:blocks/__tests__/unit/card/SectionCardElement.test.ts` (3 tests): section erase + verbatim child
  move (no body-wrapper opinion), `id`/`aria-label` landmark preservation, no title/heading opinion.

No `fui:src/_data/blocks.json` entry change — the card block carries no `registeredNames` (parameterized, satisfied by the
#1898 register-fn rule). `check:standards` + the new + existing card/transient tests green. `locus` added (the
card lacked it; FUI-substrate primitive). Unblocks `standard-section` (#1608).
