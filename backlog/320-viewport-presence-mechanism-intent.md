---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: intent:viewport-presence
tags: [intent, scroll, observation, intersection-observer, viewport-presence]
---

# Author the viewport-presence mechanism intent

Author a thin `viewport-presence` mechanism intent owning only the in/out-of-view observe-vocabulary (`root`, `rootMargin`, `threshold`, enter/leave) — the shared `IntersectionObserver` trigger that Collection Ops `advance:auto`, Prefetch `eagerness:viewport`, and the visibility-gated trait currently triplicate. It owns the trigger, not the UX decision (fetch vs prefetch vs activate), which stays with each consumer. Ratified in #014 (Fork 2): extract the trigger to one home so a `rootMargin`-defaulting fix lands once, not three times, per the DRY / most-flexible-default bias. This is the parent the consumer re-pointing (#321) composes.

## Progress

**Status:** resolved 2026-06-12 → `intent:viewport-presence`.

Authored the **Viewport Presence Intent** (JSON-only, per design-first) in `we:src/_data/intents.json`:

- Dimensions framed as UX axes that borrow IntersectionObserver's official vocabulary in their descriptions: `reference` (→ `root`: `viewport` | `scroll-ancestor`), `margin` (→ `rootMargin`: `flush` | `anticipatory`), `coverage` (→ `threshold`: `sliver` | `partial` | `majority` | `full`).
- Events `enter` / `leave` — the two observable transitions every consumer composes.
- Description states the boundary explicitly: it owns the **trigger**, not the UX decision; the three consumers (Collection Operations `advance:auto`, Prefetch `eagerness:viewport`, the visibility-gated trait) **compose** it so a `rootMargin`-defaulting fix lands once. Kept default-less (the exact margin/threshold value lives in the consumer's platform config).
- Added the **Viewport Presence** term to `we:src/_data/semantics.json`.

Renders live at `/intents/viewport-presence/`. Follow-on: re-point the three consumers to compose it (#321).
