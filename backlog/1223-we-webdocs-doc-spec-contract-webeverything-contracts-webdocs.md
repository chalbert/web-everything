---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: contracts/webdocs.ts
tags: []
---

# WE webdocs Doc Spec contract — @webeverything/contracts/webdocs: envelopes + default mapping + minimal declarative strategy vocabulary + golden vectors

Build the ratified #1163 Doc Spec contract on the WE side: a type-only @webeverything/contracts/webdocs (WebManifest/WebCases/DocsPage/DocsSite envelopes + the default manifest->DocsSite mapping types + a MINIMAL v1 declarative strategy vocabulary — order/group/sort-by-field as data, full scope/order decouple per the ratified sub-calls) plus a golden conformance-vector suite covering the default path AND the declarative vocabulary (we:conformance-vectors kit, #899/#1016). Implementer-general + portable; imperative custom functions are NOT here (per-impl escape hatch). Ratified by #1163.

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Type-only contract + golden vectors built WE-side; typecheck + all conformance-vectors tests green; gate green.

- `we:webdocs/contract.ts` — canonical type-only module (zero runtime emit): envelopes (`WebCase`/`WebCases`/`WebManifest`/`DocsPage`/`DocsSite`), the `GenerateDocsSite` default-mapping signature (scope = `blocks` SoT, alphabetic fallback, empty-page completeness, scope-omission), the `DocsStrategy` declarative vocabulary, and the `DocSpecVector`/`DocSpecVectorSuite` golden-vector shape.
- `we:contracts/webdocs.ts` + `we:contracts/package.json` — `export type *` re-export and the `./webdocs` subpath export (package name == specifier, #239; the FUI→WE arrow, like `./positioning`).
- `we:conformance-vectors/webdocs.vectors.ts` — `webdocsDocSpecSuite` (6 golden vectors: 4 default-path + 2 declarative) + `assertDocSpecSuite` structural validator + `DocSpecSchemaError`. Exported from `we:conformance-vectors/index.ts` (kept out of the interaction-script `conformanceSuites` registry — different shape).
- `we:conformance-vectors/__tests__/webdocs.vectors.test.ts` — validates suite shape AND verifies every vector's `expect` against a **test-local reference** of the ratified mapping (WE ships no runtime impl per #817/#855, so the reference proves the golden values without crossing the seam).

**Scope note (transparent):** the v1 golden-locked declarative vocabulary is `docs.order` (page-order pin, decoupled from scope) + `docs.sortBy` (within-page case sort) — both pure output transforms. `docs.groupBy` is carried in the `DocsStrategy` type as a forward-declared **rendering hint** (it does not alter the flat `DocsSite`, so it isn't golden-vector-lockable against the transform output) — honoring #1163's named "order/group/sort-by-field" vocabulary while keeping the *locked* surface minimal and honest; group's output-affecting promotion follows #1163's grow-on-demand path. Imperative custom strategy functions remain a per-impl escape hatch (not in the contract).
