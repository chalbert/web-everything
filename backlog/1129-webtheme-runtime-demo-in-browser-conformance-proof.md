---
kind: story
size: 3
parent: "1097"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webtheme-tokens-demo.html"
tags: []
---

# webtheme: runtime demo (in-browser conformance proof)

No demos/ page for webtheme exists. Scaffold one per the new-demo skill importing defaultTokens + compileToCss + deriveSchemeRuntime/compileSchemeCss (we:webtheme/compile.ts:56-82, we:webtheme/schemes.ts:356-375), injecting emitted CSS into a live page with sample components, a light/dark switch, and the prefers-contrast:more swap; wire into the demo registry. Demo: browser page switches scheme + high-contrast.

## Progress

Added the single-file demo we:demos/webtheme-tokens-demo.html (+ we:demos/webtheme-tokens-demo.css), registered in we:src/_data/demos.json (projects: webtheme). The inline module imports defaultTokens + compileToCss + deriveSchemeRuntime/compileSchemeCss, builds the full stylesheet (`:root` token vars + scheme/accent ramp + `@media (prefers-contrast: more)` block), injects it into a live `<style>`, and renders sample components (card, accent + outline buttons, 6-step accent ramp) styled only by the emitted custom properties. Two live controls: scheme light/dark (`color-scheme`) and a high-contrast toggle (a class-gated `:root.force-hc` mirror of the HC extremes, since the media query isn't JS-toggleable). Verified headless on :3000 — emitted CSS present, 6 swatches, themed bg `oklch(1 0 0)` in light, fg flips to `rgb(0,0,0)` under HC, scheme toggles to dark, zero console errors. `npm run check:standards` green (incl. check:demos).
