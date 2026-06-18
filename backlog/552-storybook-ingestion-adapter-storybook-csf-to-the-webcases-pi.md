---
type: idea
locus: frontierui
workItem: story
size: 3
parent: "398"
status: resolved
blockedBy: ["550"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/webdocs/adapters/storybook.ts (+ adapters/types.ts IngestionAdapter shared shape)
tags: [webdocs, frontier-ui, adapters, ingestion, storybook]
relatedProject: webdocs
crossRef: { url: /backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/, label: "Contract-shape ruling (#426, Fork 2 = A)" }
---

# Storybook ingestion adapter — Storybook (CSF) to the webcases pivot

The Storybook ingestion adapter build — successor to the #426 decision (Fork 2 = A). A plain per-source provider module { source, ingest } in FUI's webdocs/adapters/ (the we:eslint.mjs/oxlint.mjs pattern, no registry/DI): ingest maps Storybook CSF Meta/Story exports to { id, title, description, code } keyed by block id and emits WebCases directly, bypassing parseWebCase (its <!-- WEB CASE --> convention is WE-specific). Bottom-up normalization-hub shim so a customer can onboard existing Storybook component docs. Blocked on #550 (the webdocs cluster must land in FUI first so the adapter co-locates with the generator and the WebCases type). Independent of the Mintlify adapter (#429); further incumbents (Docusaurus, …) drop in as more size-3 siblings under #398.

## Progress

Resolved 2026-06-14 (batch). Built the Storybook ingestion adapter in the FUI
webdocs cluster (#550 landed it at `frontierui/webdocs/`):
- `fui:webdocs/adapters/types.ts` — the shared `IngestionAdapter<TInput>` shape (`{ source, ingest }`, no registry/DI) every incumbent adapter implements. New incumbents drop in as sibling modules.
- `fui:webdocs/adapters/storybook.ts` — `storybookAdapter` maps already-evaluated CSF modules (default `Meta` + named-export stories) into the `WebCases` pivot directly, **bypassing `parseWebCase`** (the `<!-- WEB CASE -->` header is WE-specific, absent in CSF). Block id ← `Meta.id`/slugified last title segment; one WebCase per story (id ← export name, title ← storyName/humanized export, description ← story-then-component docs, code ← `docs.source.code`/synthesized args).
- `fui:webdocs/adapters/__tests__/storybook.test.ts` — 5 tests (slug/id/humanize/merge/fallback paths).

Pure shape mapping (parsing/IO happens before the adapter), so it's testable with literal fixtures. Establishes the `adapters/` home the Mintlify sibling (#429) reuses. FUI `check:standards` green + type-clean. Per #426 Fork 2 = A.
