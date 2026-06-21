---
kind: story
size: 5
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "frontierui:plugs/webbehaviors/CustomAttributeRegistry.ts"
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

## Resolved (2026-06-21, batch-2026-06-21-1385-1392)

Executed the recipe end-to-end. The guard's blast radius was **wider** than the body's "4 webbehaviors test
files / 9 names" estimate (the reason it had outgrown twice) — a full-suite run found bare CustomAttribute
registrations across **7 sites**. All renamed (CustomAttributeRegistry-only per #1347 (a); parser/expression/
store names left bare):

- **Guard** — added `#assertValidName` (hyphen-OR-colon → `SyntaxError`) to `define` + `defineLazy` in
  `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` (mirrors `we:plugs/webbehaviors/CustomAttributeRegistry.ts`).
- **webbehaviors test fixtures** (`my-*`) — 4 files: `fui:CustomAttributeRegistry.test.ts` (tooltip/clickable),
  `fui:traitManifest.test.ts` (sortable/highlight), `fui:CustomAttributeRegistry.visibility.test.ts`
  (reveal/poll/auto/sticky), `fui:CustomAttributeRegistry.inert.test.ts` (toggle/ambient — the `activationSurface`
  *value* `'ambient'` left untouched).
- **Production droplist** — `fui:blocks/droplist/registerDroplistMenu.ts` registered bare PUBLIC names
  `anchor`/`anchored`/`selection` → `droplist-anchor`/`droplist-anchored`/`droplist-selection` (block-prefix;
  `focus-delegation` already valid). Updated its test expectations + the `registeredNames` array in
  `fui:src/_data/blocks.json` (the #783 sibling-drift catalog). No external markup/consumer uses them
  (`registerDroplistMenu` has no live caller), so this is contained — **not a public-API fork** (an #1428
  decision was briefly filed then deleted once that was confirmed).
- **Other test fixtures** (`my-*`) — `fui:blocks/temporal/traits/__tests__/Clock.test.ts` (clock; `data-clock*`
  output markers left), `fui:plugs/__tests__/unplugged.e2e.test.ts` (counter/observer/dynamic/removable/tooltip/
  failing/success/test + their `[attr]` selectors; `id="test"` value left).
- **Demo** — `fui:demos/visibility-gate.ts` + `fui:visibility-gate.html` (reveal/pulse/heavy + `-when` companions;
  `id=` values left).
- **Guard test** — new `fui:plugs/webbehaviors/__tests__/unit/hyphenValidation.test.ts` (mirror of the WE one).
- **WE note** — added the *"guard the namespace you share with the host"* doc note to
  `we:plugs/core/CustomRegistry.ts` `define()`.

**Gates:** full FUI suite **2563 passing** (225 files) + FUI `check:standards` **0 errors**; WE
`check:standards` 0 errors.
