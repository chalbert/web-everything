---
kind: story
size: 5
status: resolved
blockedBy: ["1994"]
dateOpened: "2026-06-30"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
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

## Grounding — outgrew story·3 + Safari-verification burden (batch-2026-06-30, released not resolved)

The registry API is a clean fit (`fui:plugs/webdirectives/CustomTemplateType.ts` extends `HTMLTemplateElement` and supplies `observedAttributes`/`attributeChangedCallback`/`connectedCallback`/`disconnectedCallback` parity — exactly portal's surface), and #1993 does **not** gate this (it names the `if`/`switch`/`for-each` operand words, not portal's existing `target`, and `portal` is a settled bare `type=` value per #1987). But two concrete findings push it past a batchable story·3:

- **Portal is the FIRST consumer, and the registry is built but NOT booted.** `#1990` shipped the registry *class* (chunks 1–3) but its chunk 4 — the first migration that would wire `CustomTemplateTypeRegistry` into the app boot — is **blocked** (on #1993). Grep confirms `CustomTemplateTypeRegistry` is only *exported* from `fui:plugs/webdirectives/index.ts`; it is **never instantiated or `.upgrade()`-scanned** in `fui:plugs/bootstrap.ts` (plugged) or `fui:plugs/unplugged.ts` (unplugged register-set) — unlike `new CustomAttributeRegistry()` at `fui:plugs/bootstrap.ts:196`. So migrating portal ALSO requires wiring the registry's `new …()` + `define('portal', …)` + `upgrade(document.body)` (+ dynamic observe) into **both** boot paths — chunk-4-adjacent shared-bootstrap infra the "migrate portal" framing doesn't contemplate. That is the outgrow (realistically story·5).
- **Acceptance mandates all-engine incl Safari — which the batch gate can't verify.** The migration's whole point is that `<template is=>` customized built-ins don't work in Safari; acceptance requires "existing webportals tests green in all engines (incl. Safari)". But the webportals suite is jsdom **unit** tests (`fui:plugs/webportals/__tests__/unit/`) and the FUI locus gate is static `check:standards` — neither runs webkit. Proving the acceptance needs a headless-webkit browser run (playwright/vitest-browser), i.e. a focused session, not a serial batch's static gate.

Recommend: retype to **story·5**; add `blockedBy` on the registry-boot wiring (either land #1990 chunk 4 first so the registry is already booted, or carve a "wire `CustomTemplateTypeRegistry` into plugged+unplugged boot" prerequisite); and do it in a session that can run the webkit acceptance. #1000 supersession check (whether Fork 4 *mandated* `is=` or it was an impl choice) is still owed.
