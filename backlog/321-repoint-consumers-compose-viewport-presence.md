---
type: idea
workItem: story
size: 3
status: resolved
blockedBy: ["320", "447"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [intent, scroll, observation, intersection-observer, viewport-presence, collection-ops, prefetch, traits]
---

# Re-point Collection Ops advance:auto, Prefetch eagerness:viewport, and the visibility-gated trait to compose viewport-presence

Re-point the three current `IntersectionObserver` consumers — Collection Ops `advance:auto`, Prefetch `eagerness:viewport`, and the visibility-gated trait — to compose the new `viewport-presence` mechanism intent (#320) instead of each inlining its own observer. The UX semantics stay where they live (fetch-more, prefetch, activate); only the observe-trigger delegates to the one shared home. Ratified in #014 (Forks 2 & 3): `advance:auto` stays a Collection Operations dimension and only its trigger delegates, closing the dated pagination/scroll seam without splitting any intent across two homes. Blocked until the `viewport-presence` intent (#320) exists to compose.

## Dependency correction (2026-06-13) — only one of the three consumers exists in WE today

On pickup, a repo-wide audit found **exactly one** live `new IntersectionObserver` in WE —
[we:RoutePrefetchBehavior.ts:73](../blocks/router/behaviors/RoutePrefetchBehavior.ts#L73) (Prefetch
`eagerness:viewport`). The other two named consumers are **not yet present in WE to re-point**:

- **Visibility-gated trait** — its observer is part of FU's `CustomAttributeRegistry` (the `when="visible"`
  gate, #221/#280), which only arrives in WE with the **#447** merge-up (deferred). So this consumer is
  `blockedBy #447`.
- **Collection Ops `advance:auto`** — [we:renderPagination.ts](../blocks/renderers/pagination/renderPagination.ts#L112)
  only emits a `data-role="scroll-sentinel"` div; **no observer watches it in WE yet** (the auto-advance
  observer is unbuilt). Nothing to re-point until that observer exists.

The DRY win this item exists for (#014 Fork 2 — "a `rootMargin`-defaulting fix lands once, not three
times") **requires ≥2 consumers** sharing the extracted home; with only the prefetch consumer live, a
shared utility built now would be a single-consumer move that #447's trait observer (and the future
pagination observer) would reshape — premature churn. **Held `blockedBy #447`**: once that merge lands the
visibility-gate observer (and pagination grows its observer), extract the one shared `viewport-presence`
trigger and re-point all available consumers together. (Discovered identically to #448 — #320 authored the
*intent* / UX vocabulary only; the runtime to compose comes from the consumers themselves.)

## Progress (2026-06-13) — resolved

#447 has since merged, so the **two** live consumers now both exist: Prefetch `eagerness:viewport`
([we:RoutePrefetchBehavior.ts](../blocks/router/behaviors/RoutePrefetchBehavior.ts)) and the visibility-gated
trait observer ([we:CustomAttributeRegistry.ts](../plugs/webbehaviors/CustomAttributeRegistry.ts) `#getVisibilityObserver`).
The ≥2-consumer precondition is met — extracted the shared trigger.

- **Shared home** — new [we:plugs/webbehaviors/viewportPresence.ts](../plugs/webbehaviors/viewportPresence.ts): `createViewportPresenceObserver({ root, rootMargin, threshold, onEnter, onLeave })` owns IntersectionObserver creation + the observe-vocabulary defaulting (the `rootMargin: '0px'` native default lives here once); routes each record to `onEnter`/`onLeave` by `isIntersecting`; returns `null` when IO is unavailable so each consumer keeps its own no-IO **UX** fallback.
- **Re-pointed prefetch** — one-shot on enter with its `rootMargin: '50px'` override + prefetch-immediately no-IO fallback, now via the trigger.
- **Re-pointed the visibility gate** — its single shared observer is now created by the trigger; both enter and leave route to the existing `#onIntersection` (recurring traits still re-close off-screen). Behaviour preserved — registry suite 29/29 green.
- The **third** named consumer (Collection Ops `advance:auto` pagination observer) is still **unbuilt** in WE (renderPagination only emits the sentinel div); it composes the same `createViewportPresenceObserver` when that observer is built — no work to re-point today.
- **Tests** — 6 new cases for the trigger (option defaulting, enter/leave routing, enter-only safety, null fallback). Gate green; no new tsc errors.
