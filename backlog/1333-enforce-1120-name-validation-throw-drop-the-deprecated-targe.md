---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# Drop the deprecated CustomAttribute `target` alias (fui:webbehaviors)

Drain the last `this.target` alias consumers in `fui:plugs/webbehaviors` and remove the `@deprecated
target` getter, completing the #1121 `target` → `ownerElement` rename in FUI. The behaviour subclasses
were already drained by the migration slices (#1330–1332); what remains is the base class's own
self-consumption plus the test/e2e surface. Closes the #1299 `target`-alias carve
(`we:reports/2026-06-20-backlog-split-analysis.md`).

## Scope (the complete remaining FUI alias surface — `/slice` 2026-06-20)

- **Base class self-consumption** — `fui:plugs/webbehaviors/CustomAttribute.ts` (5 uses: `:156-157`
  `this.target.setAttribute(...)`, `:265,:268` in `localName`). Switch these to `this.#target` /
  `this.ownerElement`. The `@deprecated target` getter (`:221`) can't be removed until the class stops
  self-consuming it.
- **Test/e2e surface** defining inline behaviours on `this.target`:
  `fui:plugs/__tests__/unplugged.e2e.test.ts` (10), `fui:plugs/__tests__/unplugged.integration.test.ts`
  (5), `fui:plugs/__tests__/e2e/webbehaviors-simple.spec.ts` (4),
  `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts` (2).
- Then **delete the `@deprecated target` getter** at `fui:plugs/webbehaviors/CustomAttribute.ts:221`.

A `extends CustomAttribute` ∧ `this.target` sweep of `fui:blocks/` returns **zero** un-migrated consumers
(#1330–1332 drained every behaviour subclass), so this is bounded to the base class + 4 test files — not
the repo-wide drain the original (batch-2026-06-20b) framing implied. Out of scope: `Injector.target`
(`fui:plugs/webinjectors/*`), `CustomContext#target`, the `portal-directive` `target` IDREF attr, and
xstate transition `target` (`fui:blocks/workflow-engine/*`) — all distinct fields, not the CustomAttribute
alias.

Demo: webbehaviors unit/e2e suite green with no `target`-getter reference remaining.

## Split note (`/slice` 2026-06-20)

Re-scoped from `size 13 → 2`. The original card welded **two orthogonal concerns** plus a buried fork:
the **#1121 alias drop** (this item) and the **#1120 throw flip** (rename bare `define()` names + turn on
the throwing `#assertValidName`). The throw flip was carved to
[#1348](/backlog/1348-enforce-1120-name-validation-throw-in-fui-webbehaviors-renam/), gated by the
naming-scope decision [#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/)
(*does #1120 validation apply beyond CustomAttribute to the parser/expression registries?*). This item is
fork-free and independent — its `blockedBy` (#1299, #1328–1332) are all resolved, so it proceeds now.
