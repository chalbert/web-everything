---
kind: bug
size: 3
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
relatedTo: ["2102", "2098", "2016"]
tags: [eleventy, build-perf, ssr, dev-server]
---

# SSR component splice: per-page subprocess storm froze the dev server (~16 min cold build)

The `weComponentSSR` per-page Eleventy transform (#2098) shelled out to the pinned FUI component-render
CLI (`fui:dist/tools/component-render/cli.mjs`) with a **cold `node` + happy-dom start per page**. Harmless
until #2102 dogfooded backlog detail pages onto `weCard` — that put 4 `<we-card data-we-spec>` placeholders
on **every** one of ~2167 backlog item pages, so a cold `build:docs` serially spawned ~2167 subprocesses
(~16 min). The 11ty dev server (`--serve`) builds before it binds its port, so for that whole window the
Vite `/backlog/…` proxy `ECONNREFUSED`'d — the reported symptom (dev looked hung / "http proxy error").

**Fix (WE-only, output-identical):** replace the per-page transform with a single build-level splice.
Placeholders now survive into the written page and an `eleventy.after` hook (`spliceComponentsBatch` →
`renderComponents`) collects EVERY page's placeholders and renders them through the pinned FUI CLI in
**one** subprocess, paying the cold start once. Output is byte-identical (the placeholder's `data-we-spec`
is self-describing; splice logic is the same `findComponentPlaceholders` + keyed-batch + `replace` the
per-page path used, and `renderComponents` is keyed-deterministic per spec). In `--serve` the event's
`results` is only the changed pages, so a dev edit re-splices just what it touched. Same subprocess
boundary + pinned-artifact/missing-artifact hard error + per-entry isolation as before.

- we:scripts/lib/component-render-build-hook.cjs — new `spliceComponentsBatch(results, repoRoot)`.
- we:.eleventy.js — `weComponentSSR` transform → `eleventy.after` batch.
- we:scripts/lib/__tests__/component-render-build-hook.test.mjs — batch coverage (one subprocess across
  many pages, substring-skip, cross-page per-entry isolation).

**Measured:** cold `build:docs` ~16 min → **~14 s** (6601 components across 2781 pages in one subprocess);
`check:standards` 0 errors; full vitest 2147/2147.

The per-page `spliceComponents` primitive is retained (exported + unit-tested) as the building block.
</content>
