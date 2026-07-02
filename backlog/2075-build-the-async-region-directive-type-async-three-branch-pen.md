---
kind: story
size: 5
parent: "1975"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Build the async region directive (type=async, three-branch pending/then/catch)

Build the ratified async-region directive (#1976 GO) in FUI's `webdirectives` plug. Applies
[#1983](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md) Fork 2 (a): an outer
`<template type="async" value="@promise" min-pending="…">` hosting nested inert
`<template slot="pending|then|catch">`, stamped one-at-a-time by promise state. The promise is **injected**
(not fetched in markup); resolved value + error surface via `data-bind`. Supersede the `async:boundary` spec
stub by **folding it in** (no alias). Migration target: DOM Parts `ChildNodePart`. Parent #1975; form authority
#1983; `type`-value naming per #1987.

## Scope

- Register `async` in the `CustomTemplateType` registry (built in #1990, resolved); this directive is among the
  first net-new #1975 proposals to exercise it.
- Three inert region-templates selected by promise state: `pending` (initial + until settle, honouring
  `min-pending` debounce/min-display), `then` (fulfilled — `data-bind="value"`), `catch` (rejected —
  `data-bind="error"`). Exactly one live at a time.
- `min-pending` attribute (the retained prep-skeptic amendment) — a delay/min-display timing knob on the
  directive's own attribute surface, not the injected binding.
- Fold in `async:boundary`: update the webdirectives spec stub
  ([we:src/_includes/project-webdirectives.njk:367-368](../src/_includes/project-webdirectives.njk#L367-L368))
  from the single-fallback "Complex (comment-wrapper)" entry to the three-branch `type="async"` form; remove the
  stale comment-wrapper grouping for it.

## Acceptance

- Conformance demo exercising all three branches (resolve, reject, slow-resolve → `min-pending`) in a real
  browser; committed interaction test in `tests/`.
- Only the active branch is live DOM; the other two stay inert in `template.content` (fail-closed).
- `check:standards` green.

## Notes

- Distinct from `resource:loader` (composed fetch state-machine) — `async` is the one-promise primitive it can
  build on; no statute overlap (#1976 ruling, red-teamed).
- Pairs with #1978 (sync render error boundary): `catch` handles *async* rejection, #1978 handles *synchronous
  render* errors.
