---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# root-cause route-view empty-clone on complex inline form fragments

Follow-up to #423 (which shipped the loud contract-boundary diagnostic). The route-view silently stamps nothing for a complex multi-fieldset inline form template body (auto-insurance quote wizard): the matched, non-empty `<template>` clones to an empty fragment, no throw, blank view. Static analysis cleared the stamping logic + bookkeeping and the markup is valid HTML, so the cause needs LIVE-BROWSER forensics — likely a stamped-fragment auto-upgrade side effect (a `data-step` Stepper / tree-select behavior clearing its container on upgrade). Reproduce by inlining `quoteWizardMarkup()` into `<template route=/quotes>`, then add a regression test with a multi-fieldset template body.

## Resolved 2026-06-13 (batch-2026-06-13) — root cause + fix + regression test

**Not** an upgrade side effect (the original hypothesis) and **not** the stamping bookkeeping — it was
the **patched `Node.cloneNode`**. Live-browser forensics (a `page.evaluate` clone probe on a
bootstrap-loaded page) reduced it to a single throwing line, triggered by exactly one ingredient of the
"complex inline form": a native **`<select>`** (also `<datalist>`).

**Mechanism.** `we:plugs/webcomponents/Node.cloneNode.patch.ts` walks every cloned node through
`cloneHandlerRegistry`. The `customElementHandler` matched on `'options' in node`
([we:cloneHandlers.ts](../plugs/webcomponents/cloneHandlers.ts)) — but a native `<select>`/`<datalist>`
*inherits* a **read-only** `options` accessor (`HTMLOptionsCollection`), so it wrongly matched. The
handler then tried `new HTMLSelectElement(options)` (illegal-constructor → `catch`) and the `catch` ran
`copyOptions` → `clone.options = original.options` → **`TypeError: Cannot set property options of
HTMLSelectElement which has only a getter`**. That throw escapes `cloneNode`; `route-view` clones the
template at [we:RouteViewElement.ts:539](../blocks/router/elements/RouteViewElement.ts#L539) *outside* its
try/catch, so the whole stamp aborts → blank view. Plain skeletons (no `<select>`) never hit it — which
is why only the quote wizard / FNOL form "tripped" it.

**Fix (2 lines, surgical).** A genuine `CustomElement` carries `options` as an **own** data property
(set in its constructor); native controls inherit it. So both `customElementHandler.matches` and
`copyOptions` ([we:cloneUtils.ts](../plugs/core/cloneUtils.ts)) now gate on
`Object.prototype.hasOwnProperty.call(node, 'options')` instead of `'options' in node` — native form
controls fall through to the generic prototype-fix handler. Custom-element cloning is unchanged
(112 webcomponents+core unit tests still green).

**Regression test.** [we:blocks/__tests__/e2e/router-empty-clone.spec.ts](../blocks/__tests__/e2e/router-empty-clone.spec.ts)
— in the real browser: (1) the patched `cloneNode` preserves a `<select>`-bearing multi-fieldset
template (clone byte-for-byte, no throw); (2) `route-view` stamps that body live (both fieldsets + the
`<select>`'s options present, no "Cannot set property options" / empty-fragment error).

The #423 empty-clone diagnostic in `RouteViewElement` stays as a safety net for any *other* future
empty-clone cause. Follow-up (not done here, exercise-app locus): the auto-insurance demo's
imperative-mount `#423` workarounds for the quote wizard + FNOL form can now be reverted to inline
`<template>` bodies.
