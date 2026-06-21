---
kind: task
parent: "1442"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/card/CardElement.ts"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, card, frontierui]
---

# Convert card to we-card custom element (transient/A)

Behavior-free presentational control: replace the createCard factory with registerCard(tag='we-card') via the TransientElement pattern. Mechanism A by the codified guideline; tag derives cleanly by #841. Independent of the other conversions.

## Progress (batch-2026-06-21)

- Built `fui:blocks/card/CardElement.ts` (`extends TransientElement`, reusing the #1454 `decorate` hook):
  `<we-card title="…" heading-level="3">…</we-card>` self-replaces with a native `<article class="fui-card">`,
  wrapping its children as `fui-card__body` and generating a `fui-card__header`/title from the `title` attr
  (level clamped to 2–6, default 3). `createCard` kept for the richer footer/actions programmatic shape.
- `fui:blocks/card/registerCard.ts` — `registerCard(tag='we-card')`, idempotent; exported from
  `blocks/card/index.ts` (+ `BASE_CLASS`); wired into `fui:plugs/bootstrap.ts`.
- Tested `fui:blocks/__tests__/unit/card/CardElement.test.ts` — 4 tests (self-replace to article+body,
  title→header h3, heading-level honour/clamp, header omitted without title). 11/11 card suite; FUI
  `check:standards` → 0 errors.
