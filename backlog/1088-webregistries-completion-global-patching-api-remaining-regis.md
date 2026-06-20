---
kind: epic
parent: "1042"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webregistries/CustomElementRegistry.ts"
tags: []
---

# webregistries completion: global-patching API + remaining registry types + downgrade/whenDefined

L3 completion sub-epic (parent #1042, audit §10). Complete the **webregistries-owned** runtime surface: the global-patching API is a TODO stub (we:plugs/webregistries/index.ts:48-90), and `getStandInElement`/`whenDefined`/`downgrade`/`define()`-validation are TODO on the scoped registry (we:plugs/webregistries/CustomElementRegistry.ts:80,114,134,143). Spec: we:src/_includes/project-webregistries.njk. Sliced 2026-06-19 (we:reports/2026-06-19-backlog-split-analysis.md): #A global-patching API, #B `whenDefined`, #C `getStandInElement`+stand-ins+`define()` validation; #D = `downgrade()` semantics decision (open fork — no native equivalent). NOT in scope (intentional layering, corrected from the audit's "1 of ~10 registry types" miscount): the other registries in the spec list already exist, homed in their owning plugs by design — CustomAttributeRegistry→webbehaviors, CustomContextRegistry→webcontexts, CustomStoreRegistry→webstates, parser registries→webexpressions/webbehaviors; genuine residuals CustomComment*→webdirectives #1098, CustomEventRegistry→webevents.
