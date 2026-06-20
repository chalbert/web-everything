---
kind: story
size: 3
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Make webscroll defer to native scroll-driven animations

Native scroll-driven animations (animation-timeline, scroll-timeline, view-timeline) are maturing across engines and are an Interop 2026 focus. The webscroll project (#014) should register them as the native-first resolver for scroll-linked behaviors, with JS scroll observers as fallback. Surfaced by the 2026-06-20 platform-standards watch (#1257).
