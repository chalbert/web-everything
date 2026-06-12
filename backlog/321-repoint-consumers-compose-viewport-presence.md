---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["320"]
dateOpened: "2026-06-11"
tags: [intent, scroll, observation, intersection-observer, viewport-presence, collection-ops, prefetch, traits]
---

# Re-point Collection Ops advance:auto, Prefetch eagerness:viewport, and the visibility-gated trait to compose viewport-presence

Re-point the three current `IntersectionObserver` consumers — Collection Ops `advance:auto`, Prefetch `eagerness:viewport`, and the visibility-gated trait — to compose the new `viewport-presence` mechanism intent (#320) instead of each inlining its own observer. The UX semantics stay where they live (fetch-more, prefetch, activate); only the observe-trigger delegates to the one shared home. Ratified in #014 (Forks 2 & 3): `advance:auto` stays a Collection Operations dimension and only its trigger delegates, closing the dated pagination/scroll seam without splitting any intent across two homes. Blocked until the `viewport-presence` intent (#320) exists to compose.
