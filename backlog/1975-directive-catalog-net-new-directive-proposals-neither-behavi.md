---
kind: epic
status: open
dateOpened: "2026-06-29"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, brainstorm, epic]
---

# Directive catalog — net-new directive proposals (neither behavior nor component)

Brainstorm home for directive candidates surfaced under #1963: markup constructs that operate on a region or tree-shape (existence, iteration, async, projection, gating, transform) — neither a behavior (CustomAttribute, decorates a connected element) nor a component (a styled, named instance). The full categorized catalog (16 categories, ~90 deduped capabilities, each tagged built/proposed/net-new and placed on the tree-shape↔computation line) lives in the linked report. This epic indexes the strongest net-new candidates as child proposals; each must clear the #1963 bar and be authored to its standards-track substrate so it deprecates and migrates to native.

## Candidate index

**Filed as child proposals (decisions — adopt at the #1963 bar):**
- **#1976** — async region (await / then / catch + suspense) 🟢
- **#1977** — defer / hydration-trigger (idle · visible · interaction · media · timer; prefetch) 🟢
- **#1978** — error boundary (catch render error → fallback) 🟢
- **#1979** — virtualized iteration (windowed list, content-visibility-backed) 🟢
- **#1980** — snippet + render (named parameterized reusable markup block) 🟢
- **#1981** — content-security zones (trusted-html / sanitize-content) 🟢

**Catalogued in the report — promote to items when prioritized:**
- render-control — memo/guard (skip unless deps change) + keyed (forced re-mount) 🟢
- native include + template-inheritance (block/extends/yield) 🟢/🟡
- scoped local-const (`@let` / `{@const}` in markup) 🟡
- region transition (enter/leave + FLIP + view-transition; pairs `moveBefore` #1969) 🟢
- resource / data (resource:loader + resource:action state machines — logic injected) 🟡
- feature/env gate (if-supported · client-only · no-ssr existence gates) 🟢
- data-view transforms (sort / filter / group-by / paginate / format / i18n) 🔴 — **app-logic line; expose as config, not free expression**

Full categorized catalog (16 categories, ~90 capabilities, framework prior-art, each tagged built/proposed/net-new
and 🟢/🟡/🔴 on the tree-shape↔computation line): the [linked report](../reports/2026-06-29-directive-catalog-brainstorm.md).
