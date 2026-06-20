---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: [router, route-view, bug, stamping, exercise-app-discovery]
crossRef: { url: /backlog/318-exercise-app-auto-insurance-lifecycle/, label: "Surfaced by auto-insurance S1 (#318)" }
---

# Router: route-view silently fails to stamp a complex inline form fragment

Surfaced building the auto-insurance quote wizard (S1, [#412](/backlog/412-ins-phase-quote-questionnaire/)).
When a `<template route="/quotes">` whose content is a **multi-fieldset form** (the wizard: `<ol>` +
several `<fieldset hidden>` with `<input required>` / `<select>` + `<button>`s) is navigated to, the
`route-view` (`we:blocks/router/elements/RouteViewElement.ts`) **unstamps the previous route and stamps
nothing** — the active view goes empty. No console error, no `pageerror`. A *simple* template (a `<div>`
stub, or `/book`'s shell) at the same route stamps fine, so it is **content-specific, not route-specific**
(confirmed: `matchRoute`/`matchAllRoutes` share one matcher and both match `/quotes`).

## Repro

In `demos/auto-insurance/`, put the full wizard markup inline in `<template route="/quotes">` and navigate
to `/quotes` via a `route:link` tab → route-view ends with only its `<template>` children, no stamped
content. Swap the wizard for a one-line stub → stamps correctly.

## Likely area

`#stampAllRoutes` (we:RouteViewElement.ts:457) clones `template.content` and `appendChild`s it; for the wizard
fragment the append yields no live children (a swallowed throw, or the cloned fragment is emptied). The
unstamp-then-stamp order (line 467) means a failure leaves the view blank.

## Workaround in place

The wizard now follows the idiomatic empty-shell + imperative-fill pattern (like `/book`): the template
carries an empty `#quote-mount`, and the app injects the wizard markup into it (`we:demos/auto-insurance/app.ts`,
tagged `// PLATFORM-GAP: #423`). This is the normal demo structure, so it is not a hack — but the
underlying route-view stamping defect should be root-caused (a form fragment is a legitimate template body).

## Done when

The route-view stamps a complex form fragment template body to live DOM (add a regression test with a
multi-fieldset template), or the limitation is documented as a contract boundary with a clear error.

## Progress (2026-06-12) — resolved via the contract-boundary path; root-cause carved to #454

Static analysis cleared the stamping path: `#stampAllRoutes` clones content, captures `nodes` *before*
`appendChild`, and accumulates correctly; `#unstampFrom` bookkeeping is sound; the wizard markup is valid
HTML. The loader `try/catch` (we:RouteViewElement.ts:345) does **not** wrap stamping, and the report says
*no console error* — so this is the **empty-clone** path (a matched, non-empty `<template>` clones to an
empty fragment → blank view, silently), not a swallowed throw. Why a valid template clones empty is not
visible statically (most likely a stamped-fragment auto-upgrade side effect — a `data-step` Stepper /
tree-select behavior clearing its container on upgrade) and needs **live-browser forensics**.

Shipped the **contract-boundary diagnostic** (the second Done-when path) in
[we:RouteViewElement.ts](../blocks/router/elements/RouteViewElement.ts#L505): a matched non-empty template
that stamps zero live nodes now logs a clear, route-identified `[Router] … (#423)` error instead of
failing silently, and `appendChild` is wrapped so a stamp-time throw surfaces with route context rather
than as an unhandled rejection. Full test suite green (2368). The **root-cause fix + regression test**
(browser repro of the wizard inlined) is carved to **#454**.
