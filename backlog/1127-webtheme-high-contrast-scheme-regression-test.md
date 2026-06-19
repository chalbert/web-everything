---
type: idea
workItem: task
parent: "1097"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webtheme: high-contrast scheme regression test

Add assertions in we:webtheme/__tests__/schemes.test.ts beyond the single @media substring check (:148): assert highContrast.bg/.fg extremes (we:webtheme/schemes.ts:277-280), the @media (prefers-contrast:more) swap (:366-373), and that the HC pair clears the contrast policy (white-on-black 21:1). Demo: vitest run webtheme green with HC assertions.
