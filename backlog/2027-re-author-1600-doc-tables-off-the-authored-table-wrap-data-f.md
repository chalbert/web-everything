---
kind: story
size: 5
status: open
blockedBy: ["1964"]
dateOpened: "2026-07-01"
tags: []
---

# Re-author #1600 doc tables off the authored-table wrap — data-fed or plain table (per ratified #1964)

## Blocked — the premise is not yet ratified (#1964 / #2007 both active, 2026-07-01 batch pre-flight)

Surfaced as batchable in a serial batch, but the body's premise — *"per **ratified** #1964"* — is **false**:
`#1964` (the *we-data-table in-place-wrap vs render-from-data* decision) is `status: active`, **not** resolved,
and the feed-mechanism **direction** it turns on is governed by `#2007` (feed-mechanism governance), also
`status: active`. `#2008` (the sibling, retired as a duplicate of #1964) is itself `blockedBy: [2007]` and states
the dual-feed question *"does not pre-judge"* the direction — *"the #2007 ruling decides"*. So the exact target
this story migrates 7 doc-table pages onto — *"we-data-table with a `rows` binding (build renders + enhancer
sorts)"* and the `registerDataTable → registerDataTableEnhancer` swap — **is precisely what is still under
contention**. Re-authoring now would build on ground that #1964/#2007 may move. Encoded `blockedBy: #1964` (the
direct determinant; #1964 is in turn downstream of #2007) so the selector stops surfacing it as agent-ready. Once
#1964 ratifies the feed identity, un-block and re-author to whatever it chose.

#1964 ratified that we-data-table never ingests an author-written table element. Migrate the #1600 doc-table surfaces (we:src/capabilities.njk, we:src/capability-pages.njk, we:src/intent-pages.njk, we:src/block-pages.njk, we:src/presets.njk, we:src/validation-rules.njk, we:src/compat.njk) off the wrap: a real sortable data-table becomes we-data-table with a rows binding (build renders plus enhancer sorts; rich cells via inert template); a presentational grid becomes a plain table.data-table with no custom element. Also swap the docs embed (fui:embed/data-table-in-document.ts) from registerDataTable to registerDataTableEnhancer (client kernel is the enhancer over build output). Undoes shipped #1610-1613. Per-page before/after visual check. Zero authored-table wraps remain.
