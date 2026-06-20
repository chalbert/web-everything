---
kind: story
size: 3
parent: "1245"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:conformance-vectors/text-node.vectors.ts"
tags: []
---

# Pilot block-unit-test to conformance-vector conversion (text-nodes)

Author WE-owned conformance vectors for the text-nodes block family from we:blocks/__tests__/unit/text-nodes, registered under we:conformance-vectors/ per the #817/#899 vectors-are-WE-owned ruling (FUI runs them). Establishes the block-test to vector pattern the rest of #1245's per-family deletes reuse — there is no precedent yet. Does NOT delete the text-nodes runtime (that stays bootstrap-gated) so it leaves a valid, demoable state.

## Progress

Established the block-unit-test → conformance-vector pattern (the #1245 pilot — no precedent existed for
a *block-family* suite; `validator-resolution` was the schema exemplar only).

- `we:conformance-vectors/text-node.vectors.ts` — `textNodeSuite` (standard `text-nodes`, contract
  `@webeverything/webexpressions`): 11 vectors lowered from
  `we:blocks/__tests__/unit/text-nodes/InterpolationTextNode.test.ts` — simple/nested/named-context
  references, pipe filter, empty/unparseable/literal/null, no-parser-registry degradation, idempotent
  connect, reconnect-after-disconnect. Each judges only the **observable** `renderedText` (DOM textContent)
  through driver verbs (`provideExpressionParsers`/`clearExpressionParsers`/`provideContext`/`provideFilter`/
  `setExpression`/`connect`/`disconnect`) — never impl internals (the idempotency call-count, `instanceof`
  chain, parse cache), per the #817/#899 vectors-are-WE-owned / golden-vectors model.
- `we:conformance-vectors/index.ts` — exported `textNodeSuite` and added it to `conformanceSuites` (the
  registry the #899 FUI/plateau driver enumerates).

Per #1245's gate, the **text-nodes runtime is NOT deleted** (stays bootstrap-gated) — this slice only adds
the vectors, leaving a valid demoable state. The existing schema test
(`we:conformance-vectors/__tests__/schema.test.ts` → "every shipped suite passes the schema") now
covers the new suite: 11 tests green. The per-family deletes that reuse this pattern remain open under #1245.
