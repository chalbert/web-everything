---
kind: story
size: 3
parent: "1028"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:webpolicy/contract.ts"
tags: []
---

# webpolicy contract — DMN meta-schema types in @webeverything

Slice A of webpolicy impl epic #1028. Define the DMN contract (DMN meta-schema types) in @webeverything per the resolved #406/#407/#408 design (meta-schema already specified). Type-only crosses the seam. Foundation slice — B and C build on it.

## Progress

Extracted the #406 DMN meta-schema (already authored, but mixed into the runtime PDP/PEP in
`we:webpolicy/enforcement.ts`) into the pure-contract module `we:webpolicy/contract.ts` (compile-erased,
future `@webeverything/contracts/policy`): `HitPolicy`, `InputEntry`, `OutputEntry`, `PolicyRule`,
`PolicyRuleSet`, `Facts`, `RuleEvaluator` (the swappable seam — policy language = build choice, #093),
`Verdict`. `we:webpolicy/enforcement.ts` now `import type`s + `export type * from './contract'` (one
home, no drift; the guard contract/provider file-seam split). Runtime PDP/PEP/`comparatorEvaluator` stay
impl (→ FUI). 13 enforcement tests green; only importer (the test) preserved via re-export.
