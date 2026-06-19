---
type: idea
workItem: story
size: 3
parent: "1096"
status: resolved
blockedBy: ["1125"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts"
tags: []
---

# webexpressions: explicit-API trigger parity (detached/self-replacing HTML insertion)

Cover the genuinely-detached APIs the observer cannot see (createContextualFragment/setHTMLUnsafe/outerHTML) by calling customTextNodes.upgrade, reusing the scaffold at we:plugs/core/utils/pathInsertionMethods.ts:46-49 and the pattern in we:plugs/webcomponents/Element.insertion.patch.ts:140-157 (spec we:src/_includes/project-webexpressions.njk:85-99). MECHANISM NOD NEEDED before batch — cross-plug boundary (#817/#854): recommend extending the existing webcomponents innerHTML patch rather than duplicating it. Demo: e2e per API.

## Progress

Added a webexpressions-owned patch `we:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts`, wired into the
plug's `applyPatches()`/`removePatches()` (`we:plugs/webexpressions/index.ts`). It gives the three
explicit/self-replacing HTML-insertion APIs the same `{{ }}`/`[[ ]]` interpolation parity #1125 gave the
observer-visible insertions:

- `Range.prototype.createContextualFragment` — returns a DETACHED fragment the observer never sees; the
  patch resolves the `customTextNodes` registry from the Range's context (start) node and calls
  `upgrade(fragment)` eagerly.
- `Element.prototype.setHTMLUnsafe` (Sanitizer API) — upgrades the element after the fresh parse; guarded
  on the method's presence (absent in happy-dom / older engines).
- `Element.prototype.outerHTML` setter — SELF-REPLACING: captures the parent + sibling window before, then
  upgrades exactly the freshly-inserted siblings after (the original element's injector context is gone by
  then). A fully-detached target (no injector chain) is a no-op, deferring to the #1125 path once connected.

Mechanism nod (#817/#854): rather than duplicate parsing, every path routes through the existing public
`CustomTextNodeRegistry.upgrade()` entry point (resolved via `InjectorRoot.getProviderOf`), the same one
`upgrade()` and the #1125 observer use — webexpressions-owned, paralleling the webcomponents-owned
`we:plugs/webcomponents/Element.insertion.patch.ts`. The patch finds each method's descriptor anywhere on its prototype chain
(some engines define them on a superclass) and applies/restores a leaf-prototype shadow so it stays
reversible. Coverage: `we:plugs/webexpressions/__tests__/unit/ExplicitHTMLInsertion.patch.test.ts` (an
e2e-equivalent case per API, plus the detached no-op and `removePatch` restore). Full webexpressions suite
green; `check:standards` 0 errors.
