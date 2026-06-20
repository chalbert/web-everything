---
kind: task
parent: "1095"
status: resolved
blockedBy: ["1121"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "plugs/webbehaviors/CustomAttribute.ts"
tags: []
---

# webbehaviors: apply the host-element property naming decision (rename/alias)

Mechanical rename/alias of the host-element property across we:plugs/webbehaviors/CustomAttribute.ts and references per the ratified naming decision. Blocked on the decision card. Demo: tests green under the chosen canonical name.

## Resolution (2026-06-19)

Per #1121 (Fork 1 → `ownerElement`, Fork 2 → scoped to `CustomAttribute` + its
`Attr`-derived subclasses only), did a big-bang rename of the exposed host property
`target` → `ownerElement` (the optional deprecated alias was a rollout tactic, skipped —
identical end-state). Scope held: `Injector`/`CustomContext` `target` left untouched (sibling
#1042), and `e.target`/`mutation.target`/`record.target` (event/observation targets) preserved.

Renamed:
- we:plugs/webbehaviors/CustomAttribute.ts — `get target()` → `get ownerElement()`, private
  `#target` → `#ownerElement`, internal reads; `attach(target)` param name kept (internal).
- we:plugs/webregistries/ScopedRegistryAttribute.ts — `this.target` → `this.ownerElement`.
- we:plugs/webbehaviors/index.ts, we:src/_includes/research-descriptions/custom-events.njk,
  we:src/_includes/block-descriptions/broadcast.njk, we:src/_includes/block-descriptions/view.njk
  — doc/example `this.target` → `this.ownerElement`.
- we:demos/declarative-spa.html, we:demos/declarative-spa-unplugged.html — behaviour `this.target`.
- Tests: we:plugs/webbehaviors/__tests__/unit/CustomAttribute.test.ts (incl. describe label),
  we:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts,
  we:plugs/__tests__/unplugged.e2e.test.ts, we:plugs/__tests__/unplugged.integration.test.ts,
  we:plugs/__tests__/e2e/webbehaviors-simple.spec.ts.

The spec njk (we:src/_includes/project-webbehaviors.njk) already named it `ownerElement`, so the
impl now converges on it. check:standards green (0 errors).
