---
kind: story
size: 5
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
tags: [plugs, webbehaviors, naming, validation]
---

# Enforce #1120 name-validation throw in fui:webbehaviors + rename in-scope bare CustomAttribute names

Mirror WE #1120 (size 2) into `fui:plugs/webbehaviors/CustomAttributeRegistry.ts`: turn on the throwing
`#assertValidName` guard (hyphen-**OR**-colon, mirroring the `SyntaxError` of `customElements.define`).
Then rename whichever bare CustomAttribute names
[#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/) rules in-scope —
markup + companion `*-when` attrs + `querySelector` call sites. Carved out of #1333 (`/slice`
2026-06-20).

**Scope settled by [#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/)
(resolved 2026-06-21 → ruling (a), [we:docs/agent/platform-decisions.md#registry-name-guard-namespace](/docs/agent/platform-decisions.md)).**
Rename set is **CustomAttribute-only**: the parser / expression / text-node registry names
(`value`/`pipe`/`call`/`mustache`/`polymer`) **stay bare and are untouched**. This story therefore (i)
turns on the `#assertValidName` throw in `fui:plugs/webbehaviors/CustomAttributeRegistry.ts`, (ii)
renames only whichever bare *CustomAttribute* names exist (markup + companion `*-when` attrs +
`querySelector` call sites), and (iii) adds the one-line *"guard the namespace you share with the host"*
note to the base `we:plugs/core/CustomRegistry.ts` `define()` doc-comment so the rule is discoverable
there.

Demo: unit — `define('nohyphen')` throws `SyntaxError`, a hyphenated/colon name succeeds; full
`fui:plugs/webbehaviors` suite green.

## Outgrew — carried forward (batch-2026-06-20-1372-1369; re-sized 2 → 5)

The **guard itself is trivial** (the 5-line `#assertValidName` mirror on `define`/`defineLazy`, applied +
verified). What outgrew the size-2 estimate is the **rename cascade**: turning the guard on breaks **57 of
108** `fui:plugs/webbehaviors` unit tests, because the suite's fixtures register **9 bare trait names** —
`ambient`, `auto`, `clickable`, `poll`, `reveal`, `sortable`, `sticky`, `toggle`, `tooltip` — across **4
test files** (`fui:CustomAttributeRegistry.test.ts`, `fui:traitManifest.test.ts`,
`fui:CustomAttributeRegistry.visibility.test.ts`, `fui:CustomAttributeRegistry.inert.test.ts`). Most of these are
**common English words** that also appear as method names / prose / the standard `inert` attribute, so a
blind global replace is unsafe — each needs a careful, context-anchored rename (the quoted `define`/
`setAttribute`/companion `-active`/`-when`/`-delivery` forms + `[name]` selectors + HTML template attrs),
with the suite as the oracle, run-and-iterate to green. That is a focused FUI test-fixture migration, not a
batch-tail mechanical pass. Reverted the guard to keep FUI green (108 passing) and carried forward.

### Settled scope (no fork — #1347 ruling (a) governs)
Rename is **CustomAttribute-only**; parser/expression/store registry names (`value`/`pipe`/`call`/`mustache`/
`polymer`/`app`/`user`/`bracket`/`default`/`expression`) **stay bare** (different registry classes — the guard
lives only in `CustomAttributeRegistry`). `inert` is a **standard HTML attribute**, not a custom-attribute
define — leave it.

### Recipe for the focused session
1. Add `#assertValidName(name)` (hyphen-OR-colon, throw `SyntaxError`) and call it first in `define` +
   `defineLazy` in `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` (mirror `we:plugs/webbehaviors/CustomAttributeRegistry.ts:193`).
2. Rename the 9 bare fixture names → `my-*` (WE precedent: `my-tooltip`/`my-sortable`) across the 4 test
   files, including each companion `*-active` / `*-when` / `*-delivery` and `[name]` selector + HTML-string attr.
3. **Real (non-test) bare registrations** also need renaming: `fui:blocks/droplist/registerDroplistMenu.ts`
   (`anchor`/`anchored`/`selection` → e.g. `droplist-anchor`/`droplist-anchored`/`droplist-selection`; no
   external caller / no markup usage — contained to that file + `fui:registerDroplistMenu.test.ts`'s expectation
   array) and the `fui:demos/visibility-gate.ts` + `fui:visibility-gate.html` demo (`reveal`/`pulse`/`heavy` +
   their `-when` companions in the live markup). Doc-comment examples (`tooltip`/`sortable` in
   `fui:CustomAttributeRegistry.ts`/`fui:webbehaviors/index.ts`/`fui:plugs/index.ts`) → `my-*`.
4. Add a guard unit test mirroring `we:plugs/webbehaviors/__tests__/unit/hyphenValidation.test.ts`
   (`define('nohyphen')` throws, `my-attr`/`nav:list` succeed, `defineLazy` validates).
5. Task (iii): add the one-line *"guard the namespace you share with the host"* note to the base
   `we:plugs/core/CustomRegistry.ts` `define()` doc-comment (a WE-side edit — gate + commit to WE).
6. Gate: full `fui` `npm run test:unit` green + `npm run check:standards` in `../frontierui`.
