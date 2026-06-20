---
kind: story
size: 5
parent: "1038"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webdocs/contract.ts"
relatedProject: webdocs
relatedReport: reports/2026-06-20-webdocs-doc-spec-generation-contract.md
tags: [webdocs, docs-as-code, generation-contract, conformance-vectors]
---

# Doc Spec WE-layer build: @webeverything/contracts/webdocs type contract + default-mapping golden vectors

## Resolution (batch-2026-06-20) — DUPLICATE of #1223 (already built + landed)

This is a **duplicate** of the resolved **#1223** ("WE webdocs Doc Spec contract — @webeverything/contracts/webdocs:
envelopes + default mapping + minimal declarative strategy vocabulary + golden vectors"). Both graduate
from the ratified #1163 and specify the identical deliverable; #1223's build **already landed** in commit
`137a364`. Verified present + green this session:
- `we:webdocs/contract.ts` — `WebManifest { docs?: DocsStrategy }` slot + `DocsStrategy`
  (`order`/`groupBy`/`sortBy` declarative vocabulary) + `DocsPage` + `DocsSite` envelopes (#1163
  Fork-1/2/3 = A); re-exported as the type-only `@webeverything/contracts/webdocs` subpath
  (`we:contracts/webdocs.ts`).
- `we:conformance-vectors/webdocs.vectors.ts` — golden suite over the default mapping (scope-SoT,
  alphabetic fallback, empty-page completeness, scope-omission) + the declarative vocab (`docs.order` pin,
  `docs.sortBy`); registered in `we:conformance-vectors/index.ts`. **11 tests green.**

No new work — closing as a duplicate so the backlog reflects reality. graduatedTo points at the delivered
artifact (same as #1223).

Build slice graduated from the ratified #1163 Doc Spec contract decision (graduatedTo:none — the decision carved no build, its own Next says 'resolve + carve build slices'). Author the WE-layer Doc Spec: the type-only `@webeverything/contracts/webdocs` subpath on we:contracts/package.json (envelopes WebManifest `docs.*` slot, DocsPage, DocsSite per #1163 Fork-1/2/3 (A)), plus a golden conformance-vector suite over the default mapping (scope-SoT, alphabetic-fallback tiebreaker, empty-page completeness) and the v1 declarative strategy vocabulary (order/group/sort-by-field) on we:conformance-vectors/schema.ts. Runtime stays FUI (#817/#855). Closes the Doc Spec strand of the #1038 epic.
