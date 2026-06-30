---
kind: story
size: 3
status: open
blockedBy: ["1990"]
dateOpened: "2026-06-30"
tags: [webportals, webdirectives, directive-form, migration, customized-built-in, fui]
---

# Migrate portal off the is= customized built-in to the type= typed-template form

Per #1983 (directive form, codified we:docs/agent/block-standard.md#directive-form): migrate portal off `<template is="portal-directive">` / `CustomTemplateDirective` (`{extends:'template'}`) to the ruled `<template type="portal">`. Clean move — inert content moves, the persistent `<template>` logicalParent anchor and connect/disconnect lifecycle all carry over. Non-trivial task: replicate observedAttributes/attributeChangedCallback for target/disabled/required (fui:plugs/webportals/PortalDirective.ts:124), which the CustomTemplateType registry now provides (#1986, ratified). Also SUPERSEDES the `<template is=>` authoring detail traced to #1000 Fork 4 — verify and cite the supersession. Blocked by #1990 (the registry family must be **built** first; #1986 is resolved).

## Acceptance

- `portal` authored as `<template type="portal" target="…">` (no `is=`, no `{extends:'template'}`); `PortalDirective` no longer `extends HTMLTemplateElement` (`fui:plugs/webportals/PortalDirective.ts:123`, `fui:plugs/webportals/index.ts:54`).
- `target` / `disabled` / `required` reactivity preserved (via the `#1986` registry's `observedAttributes`/`attributeChangedCallback` equivalent, or a scoped `MutationObserver` fallback).
- Projection, `logicalParent` wiring, deferred-outlet shared-observer, and the `required` synchronous `NotFoundError` all unchanged; existing webportals tests green in all engines (incl. Safari — the whole point).
- `#1000` checked: confirm whether Fork 4 *mandated* `is=` or it was an impl choice; cite the supersession in the change.
- `CustomTemplateDirective` left unused → flag/retire per `#1986`.
