---
kind: story
size: 5
parent: "1600"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Build-time data-table ingestion harness — Eleventy resolves a `rows`/`config` binding to an SSR table

The open WE-side build residual of #1818 (block-data-ingestion): no Eleventy integration yet invokes `CustomExpressionParser.evaluate()` with the build context to pre-render a `<we-data-table>` `rows`/`config` web-expression binding into a plain SSR `<table>`. Three pieces per #1818 'Implementation residuals': (1) the determinism predicate (the Eleventy docs surface is trivially build-known), (2) the build-time evaluation harness (the DOM-free `evaluate()` call + table emit), (3) the serialized-context format for the deterministic+interactive cell (an inert `<script type=application/json>` island carrying raw typed values). PREREQUISITE for the entire #1600 table→data-table family ([#1609](/backlog/1609-migrate-table-surfaces-in-we-src-includes-project-to-fui-dat/), [#1610](/backlog/1610-migrate-table-surfaces-in-we-src-includes-plug-descriptions-/), [#1611](/backlog/1611-migrate-table-surfaces-in-we-adapter-descriptions-top-level-/), [#1612](/backlog/1612-migrate-table-surfaces-in-we-src-includes-block-descriptions/), [#1613](/backlog/1613-migrate-table-surfaces-in-we-src-includes-research-descripti/)): without it, replacing a `<table>` with `<we-data-table>` ships an empty surface (the deterministic data is build-known, nothing is shipped at runtime, and no SSR resolution exists). Locus: WE (build integration). #1787 delivered only the runtime transient-CE embed + `we-data-table{}` CSS baseline — NOT this harness; the family's `blockedBy: [1787]` edges were false and are repointed here.
