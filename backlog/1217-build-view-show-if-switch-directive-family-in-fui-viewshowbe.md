---
type: issue
workItem: story
size: 8
parent: "904"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: frontierui/blocks/view/index.ts
tags: []
---

# Build view show/if/switch directive family in FUI (ViewShowBehavior/ViewIfDirective/ViewSwitchDirective)

Build verdict from #1165 (export-shape drift). View's contract declares ViewShowBehavior/ViewIfDirective/ViewSwitchDirective — the structural control-flow directive family View's own architecture promises ('specialized blocks (behaviors + directives)') — but fui:blocks/view/index.ts ships only ViewEngine + ViewBehavior. These are load-bearing (a capability ViewBehavior's imperative show/hide lacks: add/remove subtrees + branch selection over CustomTemplateDirective, view:show expression-bound via the shipped webexpressions layer), not additive sugar, so #1165 ruled build over trim. Building them clears the residual view export-shape warning and is a prerequisite (with #1164) to flipping EXPORT_SHAPE_ENFORCED. Slice of #904.

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Built the three load-bearing exports in FUI; the WE `view` export-shape warning is **cleared** (`check:standards` no longer flags the trio), and all 15 new + 60 total view unit tests pass.

- `fui:blocks/view/ViewShowBehavior.ts` — `CustomAttribute` (`view:show`); evaluates a bound condition through the injector chain and delegates show/hide to `ViewEngine` (declarative twin of `ViewBehavior`'s imperative Invoker-command path). `apply()`/`visible` for phase-1 re-eval.
- `fui:blocks/view/ViewIfDirective.ts` — structural conditional: comment-marker stamp/unstamp of the `<template>` subtree when the condition is truthy. `refresh()`/`stamped`.
- `fui:blocks/view/ViewSwitchDirective.ts` — branch selection: stamps the matching inner `<template case="…">` (or `<template default>`). `refresh()`/`activeCase`.
- `fui:blocks/view/resolveBinding.ts` — shared `resolveBindingValue`/`evaluateCondition` mirroring `ForEachBehavior`'s `@ctx.path` + bare-`state` injector resolution (the shipped webexpressions binding layer); supports a leading `!` negation.
- `fui:blocks/view/registerViewDirectives.ts` — registers `view:show`/`view:if`/`view:switch` on a `CustomAttributeRegistry` (mirrors `registerForEach`).
- `fui:blocks/view/index.ts` — barrel now exports the trio + register/resolver helpers. `fui:src/_data/blocks.json` view entry gains `registeredNames` for the three (sibling-drift gate #783).
- Tests: `fui:blocks/__tests__/unit/view/{ViewShowBehavior,ViewIfDirective,ViewSwitchDirective}.test.ts` (15 tests).

**Mechanism deviation (transparent):** the contract names them `*Directive`, and the #1217 body suggested "over CustomTemplateDirective". That base is **unconsumed** and has a no-arg-constructor bug, and customized built-in `<template is=>` upgrade is unreliable under the FUI happy-dom test env. So the trio is built on the **proven in-repo structural-directive pattern** — `CustomAttribute` on a `<template>` with comment markers, exactly as the sibling `blocks/for-each` does (itself named `ForEachBehavior` though it's a directive). The contract **export names** are honored; only the internal base class differs. #1165's ruling was "build the family" (the capability), not a base-class mandate. Phase-1 resolution is one-time + manual `refresh()`, matching for-each; reactive updates share for-each's deferred phase 2. Prereq (with #1164) to flipping `EXPORT_SHAPE_ENFORCED` stands.
