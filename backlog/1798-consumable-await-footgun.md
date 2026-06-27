---
kind: decision
status: open
size: 3
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
tags: [webinjectors, webcontexts, consumable, dx, native-first]
relatedReport: reports/2026-06-26-consumable-await-footgun.md
---

# Consumable await footgun — pick the reactive-consume() handle shape

## Digest

**No design exists yet** — this picks the shape of a *future* reactive `consume()` handle before it is built (pre-flight under `batch-2026-06-26-1793-1697` confirmed the subject API is **not** shipped). The handle must expose the current provided value *and* let a consumer wait for / iterate future `provide()` calls. The prior survey ([we:reports/2026-06-26-consumable-await-footgun.md](reports/2026-06-26-consumable-await-footgun.md)) found the footgun in the obvious shape, and a fresh prior-art pass (TC39 Signals · async iterators · the thenable footgun class · RxJS BehaviorSubject) is published as the `/research/` topic **[reactive-consume-handle-shape](/research/reactive-consume-handle-shape/)**. **One fork** below carries a **bold default**.

## Axis-framing

The whole concern reduces to a single axis — **is the reactive handle a thenable?** — pinned to the real tree:

- `webinjectors` `Injector.consume()` is **already async and returns the provider value directly** (`async consume(): Promise<ProviderTypeMap[Key]>`, [fui:plugs/webinjectors/Injector.ts:197](../../frontierui/plugs/webinjectors/Injector.ts)) — so `await injector.consume(...)` works today and **there is no thenable to hang on**.
- `webcontexts` `CustomContext` exposes `get/set value` + **callback subscriptions** ([fui:plugs/webcontexts/CustomContext.ts:99-129](../../frontierui/plugs/webcontexts/CustomContext.ts)), not `await`/`for await`.
- The `get then()` thenable `Consumable` the report describes has **zero occurrences in non-test source** in either repo. The only in-tree `Consumable` is the *subscribe-based*, Apollo-Link interface ([we:resources/contract.ts:39](resources/contract.ts) → `subscribe(observer)`), **not** a thenable.

So the footgun is real only for a **future** reactive-consume handle. The crux: a thenable handle makes `await consumable` (after `consume()` internally called `provide()`) **hang forever** — `await` waits for the *next* provide — and you cannot even return a thenable handle from an `async consume()` because the Promise Resolution Procedure unwraps it and the returned promise *follows* its pending state.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — handle shape | **(a) eliminate the thenable** (`.value` + `await consumable.next()` + `for await…of`) | (c) wrapper `{ consumable, value }` | High |

## Fork 1 — The reactive consume() handle shape

**Fork-existence:** a thenable handle and a non-thenable handle are **mutually-exclusive shapes for the same return value** — a single object either has a `get then()` or it does not, and the presence of `then` is exactly what makes `await consumable` hang. They cannot coexist (case (a), one branch is broken). The composability probe fails on purpose: you cannot build the thenable spelling as a facade over a non-thenable kernel without re-introducing the `then` that hangs. There is **no live consumer** of the thenable handle (it is unbuilt), so the choice is free of back-compat.

**Crux + refs.** The handle must answer three reads — *current value*, *wait for next provide*, *stream future provides*. Prior art converges (see the `/research/` topic): TC39 Signals reads via `.get()` (a sync pull, not a thenable); RxJS `BehaviorSubject` exposes the latest value as `.value`; async iterators stream via `Symbol.asyncIterator` + `for await…of` driven by `next()`, **never** `then`. None of the established reactive handles is await-able-for-the-current-value. The thenable handle is the odd one out and is precisely the [thenable footgun class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) (an async return value that is a thenable causes the promise to *follow* it, hanging forever if its `then` never settles).

**Options:**

- **(a) — bold default — eliminate the thenable.** The handle is **not** thenable (no `get then()`). Current value stays `consumable.value` (synchronous, matching Signals `.get()` / BehaviorSubject `.value`); waiting for the next provide is the *explicit* `await consumable.next()`; `for await…of` keeps working via `Symbol.asyncIterator`. The hang becomes **impossible by construction** — you cannot accidentally `await` a non-thenable into a pending state — which is the project's footgun-elimination-by-construction stance, and it aligns the handle with the value-pull + async-iterator prior art (native-first). It **retains** the value-first read; it removes only the one broken spelling (`await consumable`).
- **(b) keep `consume()` sync, document the pattern.** *Rejected* — cheapest, zero code, but it *leaves* the footgun (an `await consumable` still hangs) and only warns against it in prose, violating the eliminate-by-construction stance.
- **(c) return a wrapper `{ consumable, value }`.** *Rejected* — avoids the thenable trap but adds a clunky destructure and a second concept at every call site; `value` is a snapshot frozen at consume-time (a quiet staleness footgun) while `.value` on (a) re-reads current. No offsetting merit over (a).

**`Skeptic:` SURVIVES-WITH-AMENDMENT.** The skeptic argued (a) is *iterator-first* and gets the handle's category wrong — a consumable with a current value is a `BehaviorSubject`, which leads with `.value`, so it pushed to flip to (c). The attack's premise is false: **(a) keeps `.value`** as the synchronous current read (the report's option A and behavioral table both retain `config.value`), so (a) *is* value-first for the current read and matches `BehaviorSubject .value` / Signals `.get()` — it removes only the *thenable spelling*, not the value read. Amendment folded in: the default now states explicitly that (a) retains `.value`. The strongest surviving attack — "preserve `await consumable` but make `then` resolve to the *current* value" — is beaten on merit: a `then` resolving to *current* while `await .next()` / `for await…of` mean *next* makes now-vs-next collide silently on one object, reintroducing the exact ambiguity the footgun came from (silent instead of hanging). Default (a) holds.

## Context

---

### Survey — why this isn't a buildable bug today

Traced the real tree across WE + FUI (full detail in [we:reports/2026-06-26-consumable-await-footgun.md](reports/2026-06-26-consumable-await-footgun.md)):

- `fui:plugs/webinjectors/Injector.ts:197` — `consume()` is async, returns `Promise<ProviderTypeMap[Key]>` directly; no thenable `Consumable`.
- `fui:plugs/webcontexts/CustomContext.ts:99-129` — `get/set value` + callback subscriptions, not `await`/`for await`.
- The thenable `get then()` `Consumable` (returned by a reactive `consume()`) has **zero occurrences** in non-test source in either repo. The report's own closing note confirms it: *"consume() remains synchronous. All tests pass. This plan documents the design constraint for future resolution."*

So the footgun is real only for a **future** reactive-consume handle that doesn't exist yet. Resolving it means picking that handle's shape ahead of the build.

### Classification (per-fork pass)

- **Layer** — the handle ships *runnable code*, so the impl is FUI (`webinjectors`/`webcontexts` plugs); WE keeps only the consume/provide **contract** shape (impl-is-not-a-standard / WE-holds-zero-impl).
- **Protocol vs intent** — neither; it's a plug-API ergonomics call, no swappable-vendor interop story.
- **Fixed mechanic, not a dimension** — "footgun or not" is not a pair of legitimate end-states to expose; only one branch is correct, so it is ratified as a fixed mechanic, not an author-chosen dimension.
- **DI-injectable?** — no; the handle shape is structural to the plug.
- **Default** — the most-permissive reading is the shape that makes the hang impossible (the restriction removes a trap, it does not constrain a coherent use).
- **Seam** — sits at the `consume()`/`provide()` seam between `webinjectors` and `webcontexts`; both must agree on the handle shape.

### At graduation

Resolving go opens the build: file the FUI handle-shape implementation slice (`fui:plugs/webinjectors` + `fui:plugs/webcontexts`) as a `blockedBy: ["1798"]` story. **Registry/mint need (noted, not done):** none — no new entity, protocol, or intent; this refines an existing plug API. No shared-registry edit was made by this prep.

### Lineage

Was `kind: story` (mis-flagged batchable). Re-typed to `decision` after the survey; `relatedReport` unchanged (the 2026-06-26 report stands as the prior survey). Prior-art now published as the `/research/` topic [reactive-consume-handle-shape](/research/reactive-consume-handle-shape/).
