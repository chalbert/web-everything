---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webcontexts/Node.contexts.patch.ts"
tags: []
---

# Reconcile fui:plugs/webcontexts UP to WE (contract-anchored) — close #1117 resolveContext gap

Audit fui:plugs/webcontexts vs contract+vectors, then bring resolveContext strict/flexible parity to FUI (proven gap #1117, 4 files). Demo: webcontexts-demo.

## Progress

Reconciled `fui:plugs/webcontexts` UP to WE — FUI was wholly behind on the #1117 `resolveContext`
strict/flexible work (WE is a clean superset). Brought all 4 files to byte-identical-with-WE:

- `fui:plugs/webcontexts/Node.contexts.patch.ts` — `resolveContext(contextType, query, mode)` with
  `ContextLookupMode = 'strict' | 'flexible'` (strict → `getContext`; flexible → injector-chain walk that
  `claim()`s per scope). The #1117 gap.
- `fui:plugs/webcontexts/CustomContext.ts` — the `ContextQuery` interface + the `claim(query, context?)`
  method the flexible lookup calls.
- `fui:plugs/webcontexts/CustomContextRegistry.ts` — `#parseContextScript` (JSON-parses the
  `<script type="context">` body, warns + falls back on invalid JSON) + the async `attach(element,
  futureRoot)` path (was a bare `new Context(); attach(element)`).
- `fui:plugs/webcontexts/index.ts` — exports the `ContextQuery` type.
- Ported `__tests__/CustomContext.claim.test.ts`. FUI webcontexts tests green (64, incl. existing
  edge-cases/integration/unit — the superset is additive).

FUI `check:standards` red only on the 2 pre-existing notification/signature-pad catalog errors (unrelated,
stepped over).
