---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# Build DelimiterCollisionError + injector-scoped delimiter registry

Build the normative DelimiterCollisionError the #2112 Fork 2 predicate defines (dispatch-key equality — open, plus regionName for regions — + longest-match-first), replacing FUI's registration-order first-match (fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts) with a single-pass multi-recipe scanner. Complete the injector-scoping in the same change: swap the flat window.customTextNodeParsers read for InjectorRoot.getProviderOf(node,'customTextNodeParsers') (webinjectors) so collision/liveness is judged per injector scope, nearest-provider-wins between scopes. #2104 minted the base+registry but not the error.
