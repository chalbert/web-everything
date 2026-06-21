---
kind: story
size: 5
status: open
blockedBy: ["1363"]
dateOpened: "2026-06-21"
tags: []
---

# webisolation L3: runtime polyfill (constructable adoptedStyleSheets fallback)

The fallback conformant impl of the #1362 webisolation contract for no-build-step / dynamically-scoped cases: a runtime polyfill that applies a unique scope class and adopts a constructable CSSStyleSheet via adoptedStyleSheets (Baseline since Mar 2023). Polyfills the Layer-1 @scope isolated semantics; dropped when #11002 ships natively. Conforms to the contract ratified in #1349.
