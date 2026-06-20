---
kind: story
size: 3
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/nativeFirstWatch.json
tags: []
---

# Make webscroll defer to native scroll-driven animations

Native scroll-driven animations (animation-timeline, scroll-timeline, view-timeline) are maturing across engines and are an Interop 2026 focus. The webscroll project (#014) should register them as the native-first resolver for scroll-linked behaviors, with JS scroll observers as fallback. Surfaced by the 2026-06-20 platform-standards watch (#1257).

## Progress

Resolved 2026-06-20. **Baseline verified** via web-features: `scroll-driven-animations` is
`status.baseline: false` — maturing (an Interop 2026 focus), not yet Baseline; registered native-first now
with JS scroll observers as the fallback, default-promoted on Baseline.

Recorded in the **front-A watch ledger** (we:src/_data/nativeFirstWatch.json `scroll-driven-animations` →
`registered: true`, metric 5/6) — same home rationale as #1264: scroll-driven animation is not a
droplist/overlay-substrate capability (out of the capabilityMatrix domain), and the webscroll project
(#014) has no materialized registry def to host a resolver field, so the watch ledger (the front-A
native-first registry, #1267) is the registration home. The actual `animation-timeline` /
`scroll-timeline` / `view-timeline` wiring + JS-observer fallback is FUI impl, downstream. Gate green.
