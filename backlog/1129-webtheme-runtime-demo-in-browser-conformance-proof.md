---
type: idea
workItem: story
size: 3
parent: "1097"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webtheme: runtime demo (in-browser conformance proof)

No demos/ page for webtheme exists. Scaffold one per the new-demo skill importing defaultTokens + compileToCss + deriveSchemeRuntime/compileSchemeCss (we:webtheme/compile.ts:56-82, we:webtheme/schemes.ts:356-375), injecting emitted CSS into a live page with sample components, a light/dark switch, and the prefers-contrast:more swap; wire into the demo registry. Demo: browser page switches scheme + high-contrast.
