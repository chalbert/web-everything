---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["1223"]
relatedProject: webdocs
locus: frontierui
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: frontierui/webdocs/generator.ts
tags: [webdocs, generator, conformance]
---

# FUI webdocs generator — conform to @webeverything/contracts/webdocs + implement declarative strategy vocabulary interpretation + imperative escape-hatch (degrade-loudly)

Implement the reference-impl side of the ratified #1163 Doc Spec contract: conform fui:webdocs/generator.ts to @webeverything/contracts/webdocs (pass the golden vectors for the default path + declarative vocabulary), implement the declarative strategy vocabulary interpretation (order/group/sort-by-field), and add the per-implementer imperative escape hatch (e.g. a JS SortStrategy) with the degrade-loudly rule (declare non-support / fall back to the declarative default, never silently differ). FUI is the reference implementer, not the engine. Blocked on the WE contract slice (#1223).

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

`fui:webdocs/generator.ts` now conforms to `@webeverything/contracts/webdocs` (#1223) and **passes all 6 golden vectors** (default path + declarative vocabulary); typecheck + 20 webdocs tests green.

- `fui:webdocs/generator.ts` — imports the WE contract types (`WebCase`/`WebCases`/`WebManifest`/`DocsPage`/`DocsSite`/`DocsStrategy`/`DocsSortKey`/`GenerateDocsSite`), **deleting the local duplicate envelopes** (re-exported for back-compat) — the FUI→WE arrow, like the other `@webeverything/contracts/*` consumers. `generateDocsSite` typed as `GenerateDocsSite`, now interprets the declarative vocabulary: `docs.order` pin (decoupled from scope) + `docs.sortBy` within-page sort; `docs.groupBy` is a rendering hint (no flat-site change). Added the imperative escape hatch — `SortStrategy` + `GenerateOptions.sortStrategies` resolved by an impl-private `docs.sortStrategy` name — with **degrade-loudly** `UnsupportedStrategyError` (never silently differs), imperative taking precedence over declarative.
- `fui:tsconfig.json` + `fui:vitest.config.ts` — added `@webeverything/contracts/webdocs` + `@webeverything/conformance-vectors/webdocs` path/alias (#804-2a sibling resolution).
- `fui:webdocs/__tests__/conformance.test.ts` — runs the WE golden-vector suite against `generateDocsSite` (conformance) + exercises the escape-hatch degrade-loudly + precedence (5 tests).

Pairs with #1223 (the WE contract): the contract is now satisfied by its reference implementer with an executable conformance proof. The 2 FUI `check:standards` errors (`blocks/notification/`, `blocks/signature-pad/` catalog completeness) pre-exist on HEAD (#358/#386), unrelated to webdocs.
