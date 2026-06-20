---
kind: story
size: 5
parent: "1038"
status: open
dateOpened: "2026-06-20"
relatedProject: webdocs
relatedReport: reports/2026-06-20-webdocs-doc-spec-generation-contract.md
tags: [webdocs, docs-as-code, generation-contract, conformance-vectors]
---

# Doc Spec WE-layer build: @webeverything/contracts/webdocs type contract + default-mapping golden vectors

Build slice graduated from the ratified #1163 Doc Spec contract decision (graduatedTo:none — the decision carved no build, its own Next says 'resolve + carve build slices'). Author the WE-layer Doc Spec: the type-only `@webeverything/contracts/webdocs` subpath on we:contracts/package.json (envelopes WebManifest `docs.*` slot, DocsPage, DocsSite per #1163 Fork-1/2/3 (A)), plus a golden conformance-vector suite over the default mapping (scope-SoT, alphabetic-fallback tiebreaker, empty-page completeness) and the v1 declarative strategy vocabulary (order/group/sort-by-field) on we:conformance-vectors/schema.ts. Runtime stays FUI (#817/#855). Closes the Doc Spec strand of the #1038 epic.
