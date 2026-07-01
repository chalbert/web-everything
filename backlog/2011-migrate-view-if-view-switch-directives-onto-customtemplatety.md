---
kind: story
size: 3
parent: "1994"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Migrate view:if + view:switch directives onto CustomTemplateType (dead-on-site)

Slice A of #1994. Convert ViewIfDirective + ViewSwitchDirective off CustomAttribute onto CustomTemplateType (typed `<template>`, registered by type value per #1993 spelling: condition/match). Move #private marker/state init into connectedCallback (chunk-2 re-prototype constraint: upgrade() re-prototypes, runs no constructor). Drop the two define calls from registerViewDirectives (view:show stays a behavior). Both are dead-on-site (registerViewDirectives never called in either bootstrap) so no live regression is possible; tests drive a local customTemplateTypes.upgrade. Independent — batchable now.

## Progress (batch-2026-07-01, serial) — done

Both directives now **extend `fui:plugs/webdirectives/CustomTemplateType`** and are matched by `type` value:
`<template type="if" condition="…">` and `<template type="switch" match="…">` (#1993 spelling). The directive
**is** the template — `this.ownerElement`/`this.value` are gone; the operand reads from the `condition`/`match`
attribute (getters), and `this.content` supplies the stamped fragment/branches.

**Re-prototype constraint honoured (#1990 chunk 2):** removed **all** `#private` fields *and* `#private methods*
(both throw on a re-prototyped node whose constructor never ran) — marker/state (`startMarker`/`endMarker`/
`stampedNodes`/`reactive`/`activeCase`) are now ordinary properties initialized in `connectedCallback`, and the
helpers (`evaluate`/`stamp`/`unstamp`/`observeSource`/`sourceStore`/`selectBranch`) are ordinary prototype
methods. Added `static observedAttributes` + `attributeChangedCallback` on the operand for #1986-rule-4 parity.

`fui:blocks/view/registerViewDirectives.ts` drops the two behavior `define`s (kept `view:show`); added a sibling
`registerViewTemplateTypes(customTemplateTypes)` that `define`s `if`/`switch` on the value-space registry (real
registration path, still dead-on-site — no bootstrap calls it, so no live regression). Both unit suites rewritten
to author a typed `<template>` and drive a local `customTemplateTypes.upgrade`; **full view suite green (67
tests)**, FUI `check:standards` 0 errors (registered-names 16→14 = the two dropped behavior names, expected).
ForEach (the other #1994 chunk) is out of scope for this slice.
