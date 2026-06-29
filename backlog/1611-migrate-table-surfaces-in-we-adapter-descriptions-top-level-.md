---
kind: story
size: 2
parent: "1600"
status: open
blockedBy: ["1905"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-29"
tags: []
---

# Migrate table surfaces in we:adapter-descriptions + top-level pages to FUI data-table

Migrate the ~10 `<table>` surfaces in `we:src/_includes/adapter-descriptions/*.njk` + top-level `we:src/*.njk` to FUI blocks/renderers/data-table via the **transient-CE mount** (`<we-data-table>`, #1621 rule-7 model — the data-table counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Gate npm run verify + a :8080 render check.

## Pre-flight (batch-2026-06-27-1842-1720) — false `blockedBy` edge corrected; can't build yet

Claimed and grounded the mechanism. `<we-data-table>` is a **render-from-data kernel** (#1818): unlike
badge/card/code-view (whose content **is** authored light-DOM markup, so a wrap+CSS migration ships), its
content comes **only** from a resolved `rows="[[ ref ]]"` data binding — "raw author markup is **never** a
data source for this kernel shape" (#1818 precedence). For the docs' deterministic + non-interactive surfaces
the build must resolve that binding to a plain SSR `<table>` — and **that build-time evaluation harness does
not exist** (no Eleventy shortcode/transform invokes `CustomExpressionParser.evaluate()`; zero `rows="[[`
bindings authored). #1818 itself lists it as an **open impl residual**. So #1787 (the runtime transient-CE
embed + `we-data-table{}` CSS) was a **false `blockedBy`** — the real prerequisite is the build harness, now
filed as the build harness. #1867 (the design **decision**) ratified the boundary + interactive-cell format
(`#ssr-data-table-build-harness`); the build was **#1902**, now **sliced** (2026-06-28) into A=#1902 (FUI build-CLI),
B=#1904 (in-place enhancer), C=#1905 (WE Eleventy orchestration). This surface needs the full harness, so it now
`blockedBy` the integration slice **#1905**. Released unbuilt; the whole #1600 data-table family
(#1609/#1610/#1612/#1613) carries the same correction. Cascades clean once #1905 lands.
