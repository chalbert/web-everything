---
kind: story
locus: frontierui
size: 3
parent: "398"
status: resolved
blockedBy: ["550"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/webdocs/adapters/mintlify.ts (MDX frontmatter + fenced-block ingest into WebCases)
tags: [webdocs, frontier-ui, adapters, ingestion, mintlify]
relatedProject: webdocs
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# Mintlify ingestion adapter — Mintlify to the webcases pivot

FUI slice of #398 (per-incumbent sub-split of the former combined adapters story, 2026-06-12). Bottom-up adapter that ingests Mintlify (MDX/docs) into the webcases pivot the generator (#424) consumes — the lossy normalization-hub direction, so a customer can onboard their existing Mintlify docs. Enhancement on the self-host floor, not the floor itself; blocked on #424 defining the pivot. Independent of the Storybook adapter (#426) and the primitives slice.

> **Unblocked 2026-06-14 (batch pre-flight).** The adapter-home fork is resolved: #426 ruled (Fork 2 = A)
> and #550 migrated the webdocs cluster (generator + WebCases type) into `frontierui/webdocs/` — both now
> `status: resolved`. So a `locus: frontierui` adapter co-locates with the generator and reaches the pivot.
> This is now an agent-ready build, identical in shape to the Storybook sibling (#552); the prior
> "blocked on #426" note was stale once #426/#550 landed.

## Progress

Resolved 2026-06-14 (batch). Built the Mintlify ingestion adapter as a sibling of
the Storybook adapter (#552), reusing `fui:webdocs/adapters/types.ts`:
- `fui:webdocs/adapters/mintlify.ts` — `mintlifyAdapter` takes `{ path, source }` MDX pages and does its own light parsing (no MDX-runtime dep): YAML-ish frontmatter (`title`/`description`/`id`) + fenced code blocks. Emits `WebCase`s directly, bypassing `parseWebCase`. Block id ← frontmatter `id`/slugified last path segment; one case per fenced block (title ← ```lang title="…"`` meta / nearest preceding heading / synthesized; description ← frontmatter on the first case only; code ← block body).
- `fui:webdocs/adapters/__tests__/mintlify.test.ts` — 5 tests (heading vs meta title, frontmatter id, synthesized title, prose-only drop, no-frontmatter fallback).

Lossy normalization-hub direction (prose/components dropped, runnable examples survive). FUI `check:standards` green + type-clean. Further incumbents (Docusaurus, …) drop in as more size-3 siblings under #398. Per #426 Fork 2 = A.
