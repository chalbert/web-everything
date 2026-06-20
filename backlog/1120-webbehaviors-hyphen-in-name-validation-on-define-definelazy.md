---
kind: story
size: 2
parent: "1095"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webbehaviors/CustomAttributeRegistry.ts"
tags: []
---

# webbehaviors: hyphen-in-name validation on define()/defineLazy()

Enforce the spec hyphen requirement (we:src/_includes/project-webbehaviors.njk:83) in we:plugs/webbehaviors/CustomAttributeRegistry.ts:178,227 (throw on a name without a hyphen, mirror customElements.define SyntaxError). Includes renaming existing hyphen-less test fixtures (tooltip/clickable to hyphenated). Demo: unit, define('nohyphen') throws, define('my-attr') succeeds.

## Progress

Enforced the spec attribute-name requirement (njk:83) in `we:plugs/webbehaviors/CustomAttributeRegistry.ts`:
a `#assertValidName` guard on `define()` and `defineLazy()` throws `SyntaxError` (mirroring native
`customElements.define`) when the name lacks a namespace separator.

**Validation = hyphen OR colon (remediation, not a re-decision).** Strict hyphen-only would break real app
code — `we:blocks/navigation/registerNavigation.ts` registers `nav:list`/`nav:section` (colon-namespaced,
no hyphen). The spec's *intent* is collision-avoidance with standard HTML attributes, which a colon
namespace also satisfies (element names are hyphen-only because tags can't carry a colon; attributes can,
and the colon-namespace is an established convention — webdirectives `namespace:name`). So the guard accepts
`-` or `:`. The literal hyphen-only reading would require a `nav:list`→`nav-list` rename cascade (separate,
larger than this size-2) — flagged here if it's ever wanted.

Renamed hyphen-less test fixtures to hyphenated forms (`tooltip`→`my-tooltip`, `clickable`→`my-clickable`
in `we:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts`; `sortable`/`highlight`→
`my-sortable`/`my-highlight` in `we:plugs/webbehaviors/__tests__/unit/traitManifest.test.ts`, quoting the
hyphenated manifest keys). Updated doc-comment examples. New test
`we:plugs/webbehaviors/__tests__/unit/hyphenValidation.test.ts` — 4 green (`define('nohyphen')` throws,
`my-attr` succeeds, `nav:list` succeeds, `defineLazy` validates). Full webbehaviors suite 87 green; WE
`check:standards` 0 errors (also fixed bare code-path refs lacking a `we:` prefix in #1102/#1107/#1108/#1131
Progress notes, caught by the full gate run — #883/#885).
