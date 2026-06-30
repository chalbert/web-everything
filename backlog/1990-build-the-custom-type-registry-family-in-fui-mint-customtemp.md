---
kind: story
size: 8
status: active
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
tags: [webdirectives, registration, custom-type-registry, customtemplatetype, customscripttype, htmlregistry, fui]
---

# Build the Custom Type Registry family in FUI — mint CustomTemplateTypeRegistry + CustomScriptTypeRegistry, lift whenDefined into HTMLRegistry, migrate view directives off CustomAttribute

The implementation of #1986 (ratified registration mechanism). Four chunks against proven infra (HTMLRegistry, CustomCommentRegistry, applyDeclarativeInjectors all ship): (1) lift the copy-pasted whenDefined + resolver-map up into the HTMLRegistry base (fui:plugs/core/HTMLRegistry.ts); (2) mint CustomTemplateTypeRegistry as a value-space sibling whose upgrade(root) walk matches `<template>` by its type VALUE, re-prototyping onto CustomTemplateType — providing observedAttributes/attributeChangedCallback parity via the MutationObserver machinery CustomAttributeRegistry already owns; (3) build CustomScriptTypeRegistry, absorbing the applyDeclarativeInjectors boot-scan for `<script type="injector">` (fui:plugs/webinjectors/declarativeInjector.ts:107) as its upgrade() and deleting the bespoke scanner; (4) migrate view:if/view:switch/for-each off CustomAttribute (fui:blocks/view/registerViewDirectives.ts) onto CustomTemplateTypeRegistry. Spec: we:docs/agent/block-standard.md#directive-registration-mechanism. Split candidate (each chunk is independently deliverable).

## Progress

- **Status:** active — chunks 1–3 delivered (the registry-family infra); chunk 4 (view-directive migration) is **blocked on a spelling gap** (see Notes). One FUI commit per chunk.
- **Branch:** frontierui `main`.
- **Done:**
  - Chunk 1 — lifted `whenDefined` + resolver-map into `HTMLRegistry` base; drain in `set()`; migrated `CustomCommentRegistry` + `CustomAttributeRegistry` off their copies (FUI `ef206f6`).
  - Chunk 2 — minted `CustomTemplateType` + `CustomTemplateTypeRegistry` (value-space walk re-prototyping `<template>` by `type` value; MutationObserver attribute-change parity per #1986 rule 4) (FUI `c36244e`).
  - Chunk 3 — built `CustomScriptType` + `CustomScriptTypeRegistry`, rewired `applyDeclarativeInjectors` boot-scan through it, deleted the bespoke `querySelectorAll` scanner (FUI `753e87d`). Also fixed both value-space walks to use `querySelectorAll` (a filtered TreeWalker's `FILTER_SKIP` didn't descend in some DOM impls).
  - Fix — aligned the `CustomTemplateType` guard + tests with **#1987** (ratified 2026-06-30): core `type=` values are **bare** (`if`/`switch`), third-party `owner-kind` hyphen, **colon rejected** — chunk 2 had wrongly required a separator and registered `view:if` (FUI `055049e`).
  - All directive/injector/core/behavior suites green; tsc clean. (Pre-existing unrelated failures: `tools/maas` + `tools/gen-wrapper`, missing `we:src/_data/authorModeSource.json` — not my changeset.)
- **Next (BLOCKED):** Chunk 4 — migrate `view:if`/`view:switch`/`for-each` off `CustomAttribute` onto `CustomTemplateTypeRegistry`, authored as `<template type="if|switch|for-each">`.
- **Notes — chunk-4 blocker:** the directives currently read their **expression from the attribute value** of their colon name (`view:if="@state.loggedIn"`, `for-each="@items as user"`). The `type="if"` form has **no specified home** for that expression. #1987 settled the `type=` **value** spelling but did **not** enumerate the per-directive **option-attribute** names (the if-condition, the switch-selector). `for-each` is closest to specified (audit lists bare `items`/`as`/`key` sub-attrs) but if/switch are not. Picking those attribute names is **standard-authoring** (authored API) and belongs in WE, **not** invented in FUI impl ([[6. WE Holds ZERO Standard Implementation]]). Recommend carving chunk 4 into its own item blocked on a small spelling decision. `CustomElementRegistry` keeps its own `whenDefined` copy (separate family, out of #1986 scope) — candidate follow-up.
