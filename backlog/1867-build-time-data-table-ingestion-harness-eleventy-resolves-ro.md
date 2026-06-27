---
kind: decision
size: 5
parent: "1600"
status: open
dateOpened: "2026-06-27"
tags: [data-table, ssr, build-integration, embed-boundary, webexpressions]
---

> **Retyped story → decision (batch-2026-06-27 pre-flight).** Grounding the tree before building surfaced a
> stale premise + a load-bearing boundary fork the story assumed away.
>
> **Stale premise:** #1818 cites `we:plugs/webexpressions/CustomExpressionParser.ts:42-61` as the evaluator the
> Eleventy build calls — but **WE has no `plugs/` source dir** (confirmed). Both halves of the harness are
> **FUI-resident**: the evaluator (`fui:plugs/webexpressions/CustomExpressionParser.ts`, `evaluate(resolved)`)
> *and* the table renderer (`fui:blocks/renderers/data-table/renderDataTable.ts`). Per #1282 zero-impl, WE
> holds no impl; that citation predates the relocation.
>
> **The fork it forces:** WE's Eleventy build **cannot import** the FUI evaluator/renderer — a WE→FUI code
> import is a backward DAG edge ([[feedback_constellation_backward_edge_is_module_import]]; the constellation
> runs standard→WE→FUI). So "the Eleventy build invokes `evaluate()`" needs a **runtime boundary**, not a
> module import — and which boundary, plus the **serialized-context format** (a contract the whole #1609–#1613
> family inherits), is the call #1818 deferred to the build. It is **not** a silent pick:
>
> | Fork | Option | Trade |
> | --- | --- | --- |
> | **Evaluate/render boundary** | **(a) FUI build-CLI the Eleventy build shells out to** (def + deterministic context in → SSR `<table>` HTML out; the harness is *homed in FUI*, WE orchestrates via a process boundary) | DAG-safe (process boundary, not a code edge), offline/hermetic (no server at build), deterministic. Re-homes the harness to FUI; needs a typed CLI I/O contract. |
> | | (b) cross-origin / served (FUI serves rendered tables over the #1499/#1731 MaaS data route; WE build fetches) | DAG-safe, reuses the served-data pattern, but pulls a running second origin into the build for a fundamentally offline concern. |
> | | (c) published FUI runtime package WE's build depends on | **Rejected** — a WE→FUI *runtime* dependency inverts the DAG (only the type-only contracts package may cross WE→FUI). |
> | **Serialized-context format** | the inert `<script type="application/json">` payload shape carrying raw typed values for the deterministic+interactive cell | the contract #1609–#1613 inherit; fix it with the boundary, not ad-hoc. |
>
> **Recommended: (a)** — a FUI build-CLI, with the serialized-context format as its typed I/O contract, and the
> harness **re-homed to FUI** (`relatedProject`/`locus: frontierui`); WE's Eleventy calls it at build. Ratify the
> boundary + format, then the build is a clean slice. *Confidence: medium — (c) is DAG-defeated; (a) vs (b) is a
> hermetic-build-vs-reuse-the-served-path trade for the human, and the serialized-context format wants a
> deliberate sign-off since five items inherit it.*

# Build-time data-table ingestion harness — Eleventy resolves a `rows`/`config` binding to an SSR table

The open WE-side build residual of #1818 (block-data-ingestion): no Eleventy integration yet invokes `CustomExpressionParser.evaluate()` with the build context to pre-render a `<we-data-table>` `rows`/`config` web-expression binding into a plain SSR `<table>`. Three pieces per #1818 'Implementation residuals': (1) the determinism predicate (the Eleventy docs surface is trivially build-known), (2) the build-time evaluation harness (the DOM-free `evaluate()` call + table emit), (3) the serialized-context format for the deterministic+interactive cell (an inert `<script type=application/json>` island carrying raw typed values). PREREQUISITE for the entire #1600 table→data-table family ([#1609](/backlog/1609-migrate-table-surfaces-in-we-src-includes-project-to-fui-dat/), [#1610](/backlog/1610-migrate-table-surfaces-in-we-src-includes-plug-descriptions-/), [#1611](/backlog/1611-migrate-table-surfaces-in-we-adapter-descriptions-top-level-/), [#1612](/backlog/1612-migrate-table-surfaces-in-we-src-includes-block-descriptions/), [#1613](/backlog/1613-migrate-table-surfaces-in-we-src-includes-research-descripti/)): without it, replacing a `<table>` with `<we-data-table>` ships an empty surface (the deterministic data is build-known, nothing is shipped at runtime, and no SSR resolution exists). Locus: WE (build integration). #1787 delivered only the runtime transient-CE embed + `we-data-table{}` CSS baseline — NOT this harness; the family's `blockedBy: [1787]` edges were false and are repointed here.
