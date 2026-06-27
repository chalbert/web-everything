---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: webinjectors/contract.ts
tags: []
---

# Build the reactive consume() handle — non-thenable .value + await .next() + for await

Implement the reactive consume() handle ruled in #1798: a NON-thenable handle exposing current value via synchronous .value (re-reads live, like Signals .get() / RxJS BehaviorSubject.value), wait-for-next via explicit await consumable.next(), and streaming via Symbol.asyncIterator (for await…of). The hang footgun is impossible by construction — no get then(), so await consumable cannot resolve into a pending state. Impl lands in FUI plugs (fui:plugs/webinjectors + fui:plugs/webcontexts) at the consume()/provide() seam; WE keeps only the consume/provide contract shape. No new entity/protocol/intent.

## Shipped (WE half)

WE's deliverable per the #1798 classification is the **consume/provide contract shape** — the runnable handle is FUI (WE holds zero standard impl). Authored [we:webinjectors/contract.ts](../webinjectors/contract.ts): a compile-erased, types-only contract declaring the non-thenable `Consumable<T>` handle and the `Provide<T>` side at the consume()/provide() seam:

- `Consumable<T>.value` — synchronous live re-read of the current provided value (Signals `.get()` / `BehaviorSubject.value`).
- `Consumable<T>.next(): Promise<T>` — the explicit wait-for-next, replacing the removed `await consumable` spelling.
- `Consumable<T>[Symbol.asyncIterator]` — `for await…of` streaming of future provides.
- **No `then`** on the interface — the `await consumable`-hangs footgun is impossible by construction, the one restriction ruled by #1798.
- Kept distinct from the subscribe-based `we:resources/contract.ts` `Consumable` (Apollo-Link transport, #455), per #1798's axis-framing.

The contract becomes the `@webeverything/contracts/webinjectors` entry (#872/#874) FUI depends on. The FUI runtime handle (`fui:plugs/webinjectors` + `fui:plugs/webcontexts`) lands separately against this shape. No new entity/protocol/intent.
