---
kind: story
size: 3
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Make the view-transitions standard defer to native same-document View Transitions

Same-document View Transitions became Baseline Newly Available (Oct 2025; Firefox 144). The view-transitions protocol (#015) should register the native startViewTransition plus the view-transition CSS properties as its resolver impl per native-first (#031); track cross-document view transitions as they progress. Surfaced by the 2026-06-20 platform-standards watch (#1257).
