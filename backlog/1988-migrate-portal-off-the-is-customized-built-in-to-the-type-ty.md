---
kind: story
size: 3
status: open
blockedBy: ["1986"]
dateOpened: "2026-06-30"
tags: [webportals, webdirectives, directive-form, migration, customized-built-in, fui]
---

# Migrate portal off the is= customized built-in to the type= typed-template form

Per #1983 (directive form standard, codified we:docs/agent/block-standard.md#directive-form): migrate portal off `<template is="portal-directive">` / `CustomTemplateDirective` (`{extends:'template'}`) to the ruled typed-template form `<template type="portal">`. Clean move — inert content (portal MOVES `.content`, doesn't stamp a copy), the persistent `<template>` as the logicalParent declaration anchor, and connect/disconnect lifecycle all carry over. The one non-trivial task: replicate the native observedAttributes/attributeChangedCallback for target/disabled/required (fui:plugs/webportals/PortalDirective.ts:124) — the CustomTemplateType registry must provide this (#1986 registry-capability requirement). Also SUPERSEDES the `<template is=>` authoring detail traced to the ratified #1000 Fork 4 contract — verify against #1000 and cite the supersession. Blocked by #1986 (registration mechanism must land first).

## Acceptance

- `portal` authored as `<template type="portal" target="…">` (no `is=`, no `{extends:'template'}`); `PortalDirective` no longer `extends HTMLTemplateElement` (`fui:plugs/webportals/PortalDirective.ts:123`, `fui:plugs/webportals/index.ts:54`).
- `target` / `disabled` / `required` reactivity preserved (via the `#1986` registry's `observedAttributes`/`attributeChangedCallback` equivalent, or a scoped `MutationObserver` fallback).
- Projection, `logicalParent` wiring, deferred-outlet shared-observer, and the `required` synchronous `NotFoundError` all unchanged; existing webportals tests green in all engines (incl. Safari — the whole point).
- `#1000` checked: confirm whether Fork 4 *mandated* `is=` or it was an impl choice; cite the supersession in the change.
- `CustomTemplateDirective` left unused → flag/retire per `#1986`.
