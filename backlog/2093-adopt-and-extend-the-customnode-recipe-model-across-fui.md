---
kind: epic
status: resolved
dateOpened: "2026-07-02"
dateResolved: "2026-07-06"
graduatedTo: none
tags: []
---

# Adopt and extend the CustomNode recipe model across FUI

Umbrella for building the ratified [#2074](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/) CustomNode recipe model in FUI (codified at we:docs/agent/block-standard.md#custom-node-recipes). Migrates the **delimiter-keyed** surfaces onto `customNodes.define(class extends CustomNode)` — webexpressions' interpolation path (value:'shown') and the comment grammar as the invisible recipes' pre-JS authoring form (CustomCommentRegistry stays the polyfill instance, per #2074's statute-overlap ruling) — and adds the new recipes: value:'hidden', invisible directive marker, region inert/live. Per ratified Fork 2, CustomTemplateType/CustomScriptType are tag/attr keyings — **framed, not migrated**. The include/outlet recipe (`{>`) is deferred behind [#1980](/backlog/1980-directive-proposal-snippet-render-named-parameterized-reusab/) (named-partial resolution semantics). The host stays a polyfill detail. Builds the standard to prove it. Sliced per we:reports/2026-07-02-backlog-split-analysis.md.
