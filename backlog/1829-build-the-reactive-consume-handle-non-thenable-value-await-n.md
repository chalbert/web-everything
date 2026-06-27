---
kind: story
size: 3
status: open
dateOpened: "2026-06-27"
tags: []
---

# Build the reactive consume() handle — non-thenable .value + await .next() + for await

Implement the reactive consume() handle ruled in #1798: a NON-thenable handle exposing current value via synchronous .value (re-reads live, like Signals .get() / RxJS BehaviorSubject.value), wait-for-next via explicit await consumable.next(), and streaming via Symbol.asyncIterator (for await…of). The hang footgun is impossible by construction — no get then(), so await consumable cannot resolve into a pending state. Impl lands in FUI plugs (fui:plugs/webinjectors + fui:plugs/webcontexts) at the consume()/provide() seam; WE keeps only the consume/provide contract shape. No new entity/protocol/intent.
